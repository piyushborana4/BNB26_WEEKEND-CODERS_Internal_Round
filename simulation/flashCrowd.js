const { performance } = require("perf_hooks");
const database = require("../backend/database");

const DEFAULT_USER_COUNT = 50000;
const DEFAULT_CONCURRENCY = 100;
const DEFAULT_BASE_URL = "http://localhost:3000";

const toPositiveInteger = (value, fallback) => {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : fallback;
};

const readResponseBody = async (response) => {
	try {
		return await response.json();
	} catch (error) {
		return await response.text();
	}
};

const run = (query, parameters = []) =>
	new Promise((resolve, reject) => {
		database.run(query, parameters, function (error) {
			if (error) {
				reject(error);
				return;
			}

			resolve(this);
		});
	});

const findSimulationUsers = (emailPrefix) =>
	new Promise((resolve, reject) => {
		database.all(
			"SELECT id FROM users WHERE email LIKE ?",
			[`${emailPrefix}%@example.com`],
			(error, users) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(users);
			}
		);
	});

const cleanupSimulationUsers = async (emailPrefix) => {
	await database.ready;
	const users = await findSimulationUsers(emailPrefix);
	const userIds = users.map((user) => user.id);

	if (userIds.length === 0) {
		return;
	}

	const placeholders = userIds.map(() => "?").join(", ");
	await run(`DELETE FROM queue WHERE user_id IN (${placeholders})`, userIds);
	await run(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
};

const runFlashCrowd = async (options = {}) => {
	const userCount = toPositiveInteger(options.userCount, DEFAULT_USER_COUNT);
	const concurrency = toPositiveInteger(
		options.concurrency,
		DEFAULT_CONCURRENCY
	);
	const batchSize = Math.min(concurrency, userCount);
	const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
	const runId = options.runId || Date.now();
	const emailPrefix = `flash-user-${runId}-`;
	const collectResults = options.collectResults === true;
	const results = collectResults ? [] : null;
	let successfulRequests = 0;
	let rejectedRequests = 0;
	let failedRequests = 0;
	let totalRequestDurationMs = 0;
	const simulationStartedAt = performance.now();

	try {
		for (let start = 0; start < userCount; start += batchSize) {
			const end = Math.min(start + batchSize, userCount);
			const batchResults = await Promise.all(
				Array.from({ length: end - start }, async (_, offset) => {
					const userNumber = start + offset + 1;
					const name = `Flash User ${runId}-${userNumber}`;
					const email = `${emailPrefix}${userNumber}@example.com`;
					const sessionId = `flash-crowd-${runId}-${userNumber}`;
					const requestStartedAt = performance.now();

					try {
						const response = await fetch(`${baseUrl}/api/join`, {
							method: "POST",
							headers: {
								"content-type": "application/json",
								"x-session-id": sessionId
							},
							body: JSON.stringify({ name, email })
						});
						const responseBody = await readResponseBody(response);
						const requestDurationMs = performance.now() - requestStartedAt;
						const outcome =
							response.status >= 200 && response.status < 300
								? "successful"
								: response.status >= 400 && response.status < 500
									? "rejected"
									: "failed";

						return {
							userNumber,
							statusCode: response.status,
							result: responseBody,
							requestDurationMs,
							outcome
						};
					} catch (error) {
						return {
							userNumber,
							statusCode: null,
							result: { error: error.message },
							requestDurationMs: performance.now() - requestStartedAt,
							outcome: "failed"
						};
					}
				})
			);

			batchResults.forEach((result) => {
				totalRequestDurationMs += result.requestDurationMs;

				if (result.outcome === "successful") {
					successfulRequests += 1;
				} else if (result.outcome === "rejected") {
					rejectedRequests += 1;
				} else {
					failedRequests += 1;
				}
			});

			if (collectResults) {
				results.push(...batchResults);
			}
		}
	} finally {
		if (options.cleanup !== false) {
			await cleanupSimulationUsers(emailPrefix);
		}
	}

	const totalDurationMs = performance.now() - simulationStartedAt;

	return {
		totalSimulatedUsers: userCount,
		requestsAttempted: userCount,
		successfulRequests,
		rejectedRequests,
		failedRequests,
		totalDurationMs,
		averageRequestDurationMs: totalRequestDurationMs / userCount,
		throughputRequestsPerSecond:
			totalDurationMs > 0
				? userCount / (totalDurationMs / 1000)
				: userCount,
		concurrency: batchSize,
		collectResults,
		results
	};
};

module.exports = {
	DEFAULT_USER_COUNT,
	DEFAULT_CONCURRENCY,
	runFlashCrowd
};
