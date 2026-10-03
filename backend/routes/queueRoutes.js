const express = require("express");
const {
	getQueueStatus,
	joinQueue,
	processNextUser
} = require("../services/queueService");
const { checkRequest, recordRequest } = require("../services/antiBotService");

const router = express.Router();

router.post("/join", async (req, res) => {
	const { name, email } = req.body || {};

	if (!name || !email) {
		res.status(400).json({ error: "name and email are required" });
		return;
	}

	const requesterId =
		req.body.sessionId ||
		req.get("x-session-id") ||
		req.ip ||
		req.socket.remoteAddress;
	const requestCheck = checkRequest(requesterId);

	const recordedRequest = recordRequest(requesterId);

	if (
		requestCheck.reason === "BLOCKED" ||
		recordedRequest.reason === "BLOCKED" ||
		recordedRequest.blocked
	) {
		res.status(429).json({ error: "Requester is temporarily blocked" });
		return;
	}

	if (requestCheck.reason === "RATE_LIMITED") {
		res.status(429).json({ error: "Too many requests" });
		return;
	}

	if (!requestCheck.allowed || !recordedRequest.recorded) {
		res.status(400).json({ error: "Invalid requester identifier" });
		return;
	}

	try {
		const queueEntry = await joinQueue(name.trim(), email.trim());
		res.json(queueEntry);
	} catch (error) {
		if (error.code === "NO_OPEN_EVENT") {
			res.status(404).json({ error: error.message });
			return;
		}

		res.status(500).json({ error: "Unable to join the queue" });
	}
});

router.get("/queue/:userId", async (req, res) => {
	try {
		const queueStatus = await getQueueStatus(req.params.userId);
		res.json(queueStatus);
	} catch (error) {
		if (
			error.code === "USER_NOT_FOUND" ||
			error.code === "QUEUE_ENTRY_NOT_FOUND" ||
			error.code === "NO_OPEN_EVENT"
		) {
			res.status(404).json({ error: error.message });
			return;
		}

		res.status(500).json({ error: "Unable to fetch queue status" });
	}
});

router.post("/queue/process-next", async (req, res) => {
	try {
		const processedUser = await processNextUser();

		if (!processedUser) {
			res.status(404).json({ error: "No waiting users" });
			return;
		}

		res.json(processedUser);
	} catch (error) {
		if (error.code === "NO_OPEN_EVENT") {
			res.status(404).json({ error: error.message });
			return;
		}

		res.status(500).json({ error: "Unable to process the next user" });
	}
});

router.post("/queue/process", async (req, res) => {
	try {
		const processedUser = await processNextUser();

		if (!processedUser) {
			res.json({ status: "NO_USERS_WAITING" });
			return;
		}

		res.json(processedUser);
	} catch (error) {
		if (error.code === "NO_OPEN_EVENT") {
			res.status(404).json({ error: error.message });
			return;
		}

		res.status(500).json({ error: "Unable to process the queue" });
	}
});

module.exports = router;
