const express = require("express");
const {
	getQueueStatus,
	joinQueue,
	processNextUser
} = require("../services/queueService");

const router = express.Router();

router.post("/join", async (req, res) => {
	const { name, email } = req.body || {};

	if (!name || !email) {
		res.status(400).json({ error: "name and email are required" });
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
