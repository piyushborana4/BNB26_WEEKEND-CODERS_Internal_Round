const { performance } = require("perf_hooks");
const antiBotService = require("../backend/services/antiBotService");

const DEFAULT_BOT_COUNT = 5;
const DEFAULT_REQUESTS_PER_BOT = 10;
const DEFAULT_CONCURRENCY = 1;
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

const runBotAttack = async (options = {}) => {
	const botCount = toPositiveInteger(options.botCount, DEFAULT_BOT_COUNT);
	const requestsPerBot = toPositiveInteger(
		options.requestsPerBot,
		DEFAULT_REQUESTS_PER_BOT
	);
	const concurrency = toPositiveInteger(
		options.concurrency,
		DEFAULT_CONCURRENCY
	);
	const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
	const runId = options.runId || Date.now();
	const totalBotRequests = botCount * requestsPerBot;
	const results = [];
	const securityStatsBefore = antiBotService.getSecurityStats();
	const simulationStartedAt = performance.now();

	for (let start = 0; start < totalBotRequests; start += concurrency) {
		const end = Math.min(start + concurrency, totalBotRequests);
		const batchResults = await Promise.all(
			Array.from({ length: end - start }, async (_, offset) => {
				const requestNumber = start + offset;
				const botNumber = (requestNumber % botCount) + 1;
				const botSessionId = `bot-attack-${runId}-${botNumber}`;
				const name = `Bot User ${runId}-${botNumber}`;
				const email = `bot-user-${runId}-${botNumber}@example.com`;
				const requestStartedAt = performance.now();

				try {
					const response = await fetch(`${baseUrl}/api/join`, {
						method: "POST",
						headers: {
							"content-type": "application/json",
							"x-session-id": botSessionId
						},
						body: JSON.stringify({ name, email })
					});
					const responseBody = await readResponseBody(response);

					return {
						requestNumber: requestNumber + 1,
						botNumber,
						statusCode: response.status,
						result: responseBody,
						requestDurationMs: performance.now() - requestStartedAt,
						outcome:
							response.status >= 200 && response.status < 300
								? "allowed"
								: response.status === 429 &&
									  responseBody.error ===
										"Requester is temporarily blocked"
									? "blocked"
									: response.status === 429
										? "rateLimited"
										: "failed"
					};
				} catch (error) {
					return {
						requestNumber: requestNumber + 1,
						botNumber,
						statusCode: null,
						result: { error: error.message },
						requestDurationMs: performance.now() - requestStartedAt,
						outcome: "failed"
					};
				}
			})
		);

		results.push(...batchResults);
	}

	const totalDurationMs = performance.now() - simulationStartedAt;
	const requestDurations = results.map((request) => request.requestDurationMs);
	const securityStatsAfter = antiBotService.getSecurityStats();

	return {
		botCount,
		requestsPerBot,
		totalBotRequests,
		allowedRequests: results.filter(
			(request) => request.outcome === "allowed"
		).length,
		rateLimitedRequests: results.filter(
			(request) => request.outcome === "rateLimited"
		).length,
		blockedRequests: results.filter(
			(request) => request.outcome === "blocked"
		).length,
		failedRequests: results.filter(
			(request) => request.outcome === "failed"
		).length,
		totalDurationMs,
		averageRequestDurationMs:
			requestDurations.reduce((total, duration) => total + duration, 0) /
			requestDurations.length,
		suspiciousRequests:
			securityStatsAfter.suspiciousRequests -
			securityStatsBefore.suspiciousRequests,
			antiBotStats: {
				suspiciousRequests:
					securityStatsAfter.suspiciousRequests -
					securityStatsBefore.suspiciousRequests,
				repeatedRequests:
					securityStatsAfter.repeatedRequests -
					securityStatsBefore.repeatedRequests
			},
		results
	};
};

module.exports = {
	DEFAULT_BOT_COUNT,
	DEFAULT_REQUESTS_PER_BOT,
	DEFAULT_CONCURRENCY,
	runBotAttack
};
