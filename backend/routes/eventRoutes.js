const express = require("express");
const database = require("../database");

const router = express.Router();

router.get("/", (req, res) => {
	database.ready
		.then(() => {
			database.get(
				`SELECT id, name, total_seats, available_seats, status
				 FROM events
				 ORDER BY id
				 LIMIT 1`,
				(error, event) => {
					if (error) {
						res.status(500).json({ error: "Unable to fetch event" });
						return;
					}

					if (!event) {
						res.status(404).json({ error: "Event not found" });
						return;
					}

					res.json(event);
				}
			);
		})
		.catch(() => {
			res.status(500).json({ error: "Database is not ready" });
		});
});

module.exports = router;
