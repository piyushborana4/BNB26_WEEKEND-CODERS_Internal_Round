const { performance } = require("perf_hooks");
const antiBotService = require("./antiBotService");

const simulationResults = new Map();

const toPositiveInteger = (value, fallback) => {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : fallback;
};

const toNonNegativeInteger = (value, fallback) => {
	const number = Number(value);
	return Number.isInteger(number) && number >= 0 ? number : fallback;
};

const delay = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const simulateRequest = (requesterId) => {
	const check = antiBotService.checkRequest(requesterId);

	if (!check.allowed) {
		return {
			allowed: false,
			reason: check.reason
		};
	}

	const recorded = antiBotService.recordRequest(requesterId);

	if (!recorded.recorded) {
		return {
			allowed: false,
			reason: recorded.reason
		};
	}

	return {
		allowed: true,
		suspicious: recorded.suspicious
	};
};

const simulateBotRequest = (requesterId) => {
	const result = simulateRequest(requesterId);

	if (!result.allowed && result.reason === "RATE_LIMITED") {
		antiBotService.recordRequest(requesterId);
	}

	return result;
};

const runNormalTraffic = async (options = {}) => {
	const requestCount = toPositiveInteger(options.requestCount, 20);
	const intervalMs = toNonNegativeInteger(options.intervalMs, 10);
	const requesterPrefix = options.requesterPrefix || "normal-user";
	const responseTimes = [];
let successfulRequests = 0;
	let rejectedRequests = 0;
	const startedAt = performance.now();

	antiBotService.resetSecurityStats();

	for (let index = 0; index < requestCount; index += 1) {
		if (intervalMs > 0 && index > 0) {
			await delay(intervalMs);
		}

		const requestStartedAt = performance.now();
		const result = simulateRequest(`${requesterPrefix}-${index + 1}`);
		responseTimes.push(performance.now() - requestStartedAt);

		if (result.allowed) {
			successfulRequests += 1;
		} else {
			rejectedRequests += 1;
		}
	}

	const durationMs = performance.now() - startedAt;
	const result = {
		scenario: "normalTraffic",
		totalRequests: requestCount,
		successfulRequests,
		rejectedRequests,
		averageResponseTimeMs:
			responseTimes.reduce((total, time) => total + time, 0) /
			responseTimes.length,
		durationMs,
		metricsAreSimulated: true
	};

	simulationResults.set("normalTraffic", result);
	return result;
};

const runBotAttack = async (options = {}) => {
	const requesterCount = toPositiveInteger(options.requesterCount, 3);
	const requestsPerRequester = toPositiveInteger(
		options.requestsPerRequester,
		20
	);
	const requesterPrefix = options.requesterPrefix || "bot-requester";
	const totalBotRequests = requesterCount * requestsPerRequester;
const startedAt = performance.now();

	antiBotService.resetSecurityStats();

	for (let requestIndex = 0; requestIndex < requestsPerRequester; requestIndex += 1) {
		for (let requesterIndex = 0; requesterIndex < requesterCount; requesterIndex += 1) {
			simulateBotRequest(`${requesterPrefix}-${requesterIndex + 1}`);
		}
	}

	const durationMs = performance.now() - startedAt;
	const securityStats = antiBotService.getSecurityStats();
	const result = {
		scenario: "botAttack",
		totalBotRequests,
		allowedRequests: securityStats.allowedRequests,
		rateLimitedRequests: securityStats.rateLimitedRequests,
		suspiciousRequests: securityStats.suspiciousRequests,
		blockedRequests: securityStats.blockedRequests,
		durationMs,
		metricsAreSimulated: true
	};

	simulationResults.set("botAttack", result);
	return result;
};

const runFlashCrowd = async (options = {}) => {
	const userCount = toPositiveInteger(options.userCount, 50000);
	const concurrency = Math.min(
		toPositiveInteger(options.concurrency, 500),
		userCount
	);
	const requesterPrefix = options.requesterPrefix || "flash-user";
let successfulRequests = 0;
	let rejectedRequests = 0;
const startedAt = performance.now();

	antiBotService.resetSecurityStats();

	for (let start = 0; start < userCount; start += concurrency) {
		const end = Math.min(start + concurrency, userCount);
		const results = await Promise.all(
			Array.from({ length: end - start }, (_, offset) =>
				Promise.resolve(
					simulateRequest(`${requesterPrefix}-${start + offset + 1}`)
				)
			)
		);

		results.forEach((result) => {
			if (result.allowed) {
				successfulRequests += 1;
			} else {
				rejectedRequests += 1;
			}
		});
	}

	const processingDurationMs = performance.now() - startedAt;
	const result = {
		scenario: "flashCrowd",
		totalSimulatedUsers: userCount,
		successfulRequests,
		rejectedRequests,
		processingDurationMs,
		throughputUsersPerSecond:
			processingDurationMs > 0
				? userCount / (processingDurationMs / 1000)
				: userCount,
		metricsAreSimulated: true,
			concurrency
	};

	simulationResults.set("flashCrowd", result);
	return result;
};

const getSimulationResults = (scenario) => {
	if (scenario) {
		return simulationResults.get(scenario) || null;
	}

	return Object.fromEntries(simulationResults);
};

module.exports = {
	runNormalTraffic,
	runBotAttack,
	runFlashCrowd,
	getSimulationResults
};
