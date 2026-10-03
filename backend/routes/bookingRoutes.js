const express = require("express");
const { allocateSeat } = require("../services/allocationService");
const database = require("../database");

const router = express.Router();

router.get("/booking/:userId", async (req, res) => {
	const userId = Number(req.params.userId);

	if (!Number.isInteger(userId) || userId < 1) {
		res.status(400).json({ error: "userId must be a positive integer" });
		return;
	}

	try {
		await database.ready;

		database.get(
			`SELECT bookings.id AS bookingId,
					bookings.user_id AS userId,
					events.name AS eventName,
					seats.seat_number AS seatNumber,
					UPPER(bookings.booking_status) AS bookingStatus,
					bookings.created_at AS createdAt
			 FROM bookings
			 JOIN events ON events.id = bookings.event_id
			 JOIN seats ON seats.id = bookings.seat_id
			 WHERE bookings.user_id = ?
				AND UPPER(bookings.booking_status) = 'CONFIRMED'
			 ORDER BY bookings.id
			 LIMIT 1`,
			[userId],
			(error, booking) => {
				if (error) {
					res.status(500).json({ error: "Unable to fetch booking" });
					return;
				}

				if (!booking) {
					res.status(404).json({ error: "Confirmed booking not found" });
					return;
				}

				res.json(booking);
			}
		);
	} catch (error) {
		res.status(500).json({ error: "Database is not ready" });
	}
});

router.post("/book/:userId", async (req, res) => {
	const userId = Number(req.params.userId);

	if (!Number.isInteger(userId) || userId < 1) {
		res.status(400).json({ error: "userId must be a positive integer" });
		return;
	}

	try {
		const allocation = await allocateSeat(userId);

		if (allocation.status === "SOLD_OUT") {
			res.status(409).json({ bookingStatus: "SOLD_OUT" });
			return;
		}

		res.json({
			bookingId: allocation.bookingId,
			userId: allocation.userId,
			seatNumber: allocation.seatNumber,
			bookingStatus: "CONFIRMED"
		});
	} catch (error) {
		if (
			error.code === "USER_NOT_FOUND" ||
			error.code === "USER_NOT_READY" ||
			error.code === "NO_OPEN_EVENT"
		) {
			res.status(404).json({ error: error.message });
			return;
		}

		res.status(500).json({ error: "Unable to create booking" });
	}
});

router.post("/allocate", async (req, res) => {
	const { userId } = req.body || {};

	if (!userId) {
		res.status(400).json({ error: "userId is required" });
		return;
	}

	try {
		const allocation = await allocateSeat(userId);
		res.json(allocation);
	} catch (error) {
		if (
			error.code === "USER_NOT_FOUND" ||
			error.code === "USER_NOT_READY" ||
			error.code === "NO_OPEN_EVENT"
		) {
			res.status(404).json({ error: error.message });
			return;
		}

		res.status(500).json({ error: "Unable to allocate a seat" });
	}
});

module.exports = router;
