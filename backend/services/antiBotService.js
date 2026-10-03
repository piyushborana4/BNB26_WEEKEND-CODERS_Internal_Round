const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const REPEAT_WINDOW_MS = 1000;
const HIGH_FREQUENCY_WINDOW_MS = 2 * 1000;
const HIGH_FREQUENCY_REQUEST_COUNT = 3;
const BLOCK_SCORE_THRESHOLD = 5;
const BLOCK_DURATION_MS = 30 * 1000;

const requesterStates = new Map();

const securityStats = {
	allowedRequests: 0,
	rateLimitedRequests: 0,
	suspiciousRequests: 0,
	blockedRequests: 0,
	repeatedRequests: 0
};

const getRequesterKey = (requesterId) => {
	if (typeof requesterId !== "string" && typeof requesterId !== "number") {
		return null;
	}

	const key = String(requesterId).trim();
	return key.length > 0 ? key : null;
};

const getRequesterState = (requesterKey) => {
	let state = requesterStates.get(requesterKey);

	if (!state) {
		state = {
			requestTimestamps: [],
			lastRequestAt: 0,
			suspiciousScore: 0,
			blockedUntil: 0
		};
		requesterStates.set(requesterKey, state);
	}

	return state;
};

const removeExpiredRequests = (state, now) => {
	state.requestTimestamps = state.requestTimestamps.filter(
		(timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
	);
};

const isBlocked = (requesterId) => {
	const requesterKey = getRequesterKey(requesterId);

	if (!requesterKey) {
		return false;
	}

	const state = requesterStates.get(requesterKey);
	return Boolean(state && state.blockedUntil > Date.now());
};

const checkRequest = (requesterId) => {
	const requesterKey = getRequesterKey(requesterId);

	if (!requesterKey) {
		return {
			allowed: false,
			reason: "INVALID_REQUESTER"
		};
	}

	const now = Date.now();
	const state = getRequesterState(requesterKey);

	if (state.blockedUntil <= now) {
		state.blockedUntil = 0;
	}

	if (state.blockedUntil > now) {
		securityStats.blockedRequests += 1;
		return {
			allowed: false,
			reason: "BLOCKED",
			blockedUntil: state.blockedUntil
		};
	}

	removeExpiredRequests(state, now);

	if (state.requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
		securityStats.rateLimitedRequests += 1;
		return {
			allowed: false,
			reason: "RATE_LIMITED",
			retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - state.requestTimestamps[0])
		};
	}

	securityStats.allowedRequests += 1;
	return {
		allowed: true,
		remainingRequests: MAX_REQUESTS_PER_WINDOW - state.requestTimestamps.length
	};
};

const recordRequest = (requesterId) => {
	const requesterKey = getRequesterKey(requesterId);

	if (!requesterKey) {
		return {
			recorded: false,
			reason: "INVALID_REQUESTER"
		};
	}

	const now = Date.now();
	const state = getRequesterState(requesterKey);

	if (state.blockedUntil > now) {
		securityStats.blockedRequests += 1;
		return {
			recorded: false,
			reason: "BLOCKED",
			blockedUntil: state.blockedUntil
		};
	}

	removeExpiredRequests(state, now);

	const wasRepeated =
		state.lastRequestAt > 0 && now - state.lastRequestAt < REPEAT_WINDOW_MS;
	const wasHighFrequency =
		state.requestTimestamps.filter(
			(timestamp) => now - timestamp < HIGH_FREQUENCY_WINDOW_MS
		).length >= HIGH_FREQUENCY_REQUEST_COUNT - 1;

	if (wasRepeated) {
		securityStats.repeatedRequests += 1;
	}

	if (wasRepeated || wasHighFrequency) {
		state.suspiciousScore += 1;
		securityStats.suspiciousRequests += 1;
	}

	state.requestTimestamps.push(now);
	state.lastRequestAt = now;

	if (state.suspiciousScore >= BLOCK_SCORE_THRESHOLD) {
		state.blockedUntil = now + BLOCK_DURATION_MS;
	}

	return {
		recorded: true,
		repeated: wasRepeated,
		suspicious: wasRepeated || wasHighFrequency,
		blocked: state.blockedUntil > now,
		suspiciousScore: state.suspiciousScore
	};
};

const getSecurityStats = () => ({
	...securityStats,
	trackedRequesters: requesterStates.size,
	configuration: {
		rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
		maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
		repeatWindowMs: REPEAT_WINDOW_MS,
		highFrequencyWindowMs: HIGH_FREQUENCY_WINDOW_MS,
		highFrequencyRequestCount: HIGH_FREQUENCY_REQUEST_COUNT,
		blockScoreThreshold: BLOCK_SCORE_THRESHOLD,
		blockDurationMs: BLOCK_DURATION_MS
	}
});

const resetSecurityStats = () => {
	requesterStates.clear();
	Object.keys(securityStats).forEach((statName) => {
		securityStats[statName] = 0;
	});
};

module.exports = {
	RATE_LIMIT_WINDOW_MS,
	MAX_REQUESTS_PER_WINDOW,
	REPEAT_WINDOW_MS,
	HIGH_FREQUENCY_WINDOW_MS,
	HIGH_FREQUENCY_REQUEST_COUNT,
	BLOCK_SCORE_THRESHOLD,
	BLOCK_DURATION_MS,
	checkRequest,
	recordRequest,
	isBlocked,
	getSecurityStats,
	resetSecurityStats
};
