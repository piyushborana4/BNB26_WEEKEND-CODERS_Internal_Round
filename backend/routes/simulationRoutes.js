const express = require("express");
const {
	runNormalTraffic,
	runBotAttack,
	runFlashCrowd
} = require("../services/simulationService");

const router = express.Router();

router.post("/start", async (req, res) => {
	const body = req.body || {};
	const { type, ...options } = body;

	if (!["normal", "bot", "flash"].includes(type)) {
		res.status(400).json({
			error: "simulation type must be normal, bot, or flash"
		});
		return;
	}

	try {
		const simulation = {
			normal: runNormalTraffic,
			bot: runBotAttack,
			flash: runFlashCrowd
		}[type];

		const results = await simulation(options);
		res.json(results);
	} catch (error) {
		res.status(500).json({ error: "Unable to start simulation" });
	}
});

module.exports = router;
