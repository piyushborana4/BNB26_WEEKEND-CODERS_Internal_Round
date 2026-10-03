const { performance } = require("perf_hooks");

const DEFAULT_USER_COUNT = 20;
const DEFAULT_DELAY_MS = 100;
const DEFAULT_BASE_URL = "http://localhost:3000";

const delay = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const runNormalTraffic = async (options = {}) => {
	const userCount = Number.isInteger(options.userCount) && options.userCount > 0
		? options.userCount
		: DEFAULT_USER_COUNT;
	const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0
		? options.delayMs
		: DEFAULT_DELAY_MS;
	const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
	const runId = Date.now();
	const results = [];
	const simulationStartedAt = performance.now();

	for (let index = 0; index < userCount; index += 1) {
		if (index > 0 && delayMs > 0) {
			await delay(delayMs);
		}

		const userNumber = index + 1;
		const name = `Normal User ${runId}-${userNumber}`;
		const email = `normal-user-${runId}-${userNumber}@example.com`;
		const sessionId = `normal-traffic-${runId}-${userNumber}`;
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
			let responseBody;

			try {
				responseBody = await response.json();
			} catch (parseError) {
				responseBody = await response.text();
			}

			const requestDurationMs = performance.now() - requestStartedAt;
			results.push({
				userNumber,
				name,
				email,
				statusCode: response.status,
				result: responseBody,
				requestDurationMs,
				outcome:
					response.status >= 200 && response.status < 300
						? "successful"
						: response.status >= 400 && response.status < 500
							? "rejected"
							: "failed"
			});
		} catch (error) {
			results.push({
				userNumber,
				name,
				email,
				statusCode: null,
				result: { error: error.message },
				requestDurationMs: performance.now() - requestStartedAt,
				outcome: "failed"
			});
		}
	}

	const totalDurationMs = performance.now() - simulationStartedAt;
	const requestDurations = results.map((request) => request.requestDurationMs);

	return {
		totalRequests: results.length,
		successfulRequests: results.filter(
			(request) => request.outcome === "successful"
		).length,
		rejectedRequests: results.filter(
			(request) => request.outcome === "rejected"
		).length,
		failedRequests: results.filter(
			(request) => request.outcome === "failed"
		).length,
		totalDurationMs,
		averageRequestDurationMs:
			requestDurations.reduce((total, duration) => total + duration, 0) /
			requestDurations.length,
		results
	};
};

module.exports = {
	DEFAULT_USER_COUNT,
	DEFAULT_DELAY_MS,
	runNormalTraffic
};
