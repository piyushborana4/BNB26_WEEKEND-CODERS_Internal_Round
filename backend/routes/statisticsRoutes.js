const express = require("express");
const database = require("../database");
const antiBotService = require("../services/antiBotService");
const simulationService = require("../services/simulationService");

const router = express.Router();

const get = (query, parameters = []) =>
	new Promise((resolve, reject) => {
		database.get(query, parameters, (error, row) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(row);
		});
	});

router.get("/statistics", (req, res) => {
	try {
		const latestSimulationResults = simulationService.getSimulationResults();

		res.json({
			antiBot: antiBotService.getSecurityStats(),
			simulations: {
				latest: latestSimulationResults,
				normalTraffic:
					simulationService.getSimulationResults("normalTraffic"),
				botAttack: simulationService.getSimulationResults("botAttack"),
				flashCrowd: simulationService.getSimulationResults("flashCrowd")
			}
		});
	} catch (error) {
		res.status(500).json({ error: "Unable to fetch statistics" });
	}
});

router.get("/core-statistics", async (req, res) => {
	try {
		await database.ready;

		const event = await get(
			`SELECT id, total_seats, available_seats
			 FROM events
			 WHERE status IN ('open', 'upcoming')
			 ORDER BY id
			 LIMIT 1`
		);

		if (!event) {
			res.json({
				totalUsers: 0,
				queueSize: 0,
				totalSeats: 0,
				allocatedSeats: 0,
				availableSeats: 0,
				totalBookings: 0
			});
			return;
		}

		const statistics = await get(
			`SELECT
				(SELECT COUNT(*) FROM users) AS totalUsers,
				(SELECT COUNT(*)
				 FROM queue
				 WHERE event_id = ? AND UPPER(status) IN ('WAITING', 'PROCESSING')) AS queueSize,
				(SELECT COUNT(*)
				 FROM seats
				 WHERE event_id = ? AND UPPER(status) = 'BOOKED') AS allocatedSeats,
				(SELECT COUNT(*) FROM bookings WHERE event_id = ?) AS totalBookings`,
			[event.id, event.id, event.id]
		);

		res.json({
			totalUsers: statistics.totalUsers,
			queueSize: statistics.queueSize,
			totalSeats: event.total_seats,
			allocatedSeats: statistics.allocatedSeats,
			availableSeats: event.available_seats,
			totalBookings: statistics.totalBookings
		});
	} catch (error) {
		res.status(500).json({ error: "Unable to fetch core statistics" });
	}
});

module.exports = router;
