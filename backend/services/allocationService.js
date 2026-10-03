const database = require("../database");

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

const run = (query, parameters = []) =>
	new Promise((resolve, reject) => {
		database.run(query, parameters, function (error) {
			if (error) {
				reject(error);
				return;
			}

			resolve(this);
		});
	});

const allocateSeatInTransaction = async (userId, eventId) => {
	const user = await get("SELECT id FROM users WHERE id = ?", [userId]);

	if (!user) {
		const error = new Error("User not found");
		error.code = "USER_NOT_FOUND";
		throw error;
	}

	const queueEntry = await get(
		`SELECT status
		 FROM queue
		 WHERE event_id = ? AND user_id = ?
			AND UPPER(status) IN ('ALLOCATED', 'PROCESSING')
		 ORDER BY id
		 LIMIT 1`,
		[eventId, user.id]
	);

	if (!queueEntry) {
		const error = new Error("User is not ready for booking");
		error.code = "USER_NOT_READY";
		throw error;
	}

	const existingBooking = await get(
		`SELECT bookings.id, bookings.event_id, bookings.seat_id, seats.seat_number
		 FROM bookings
		 JOIN seats ON seats.id = bookings.seat_id
		 WHERE bookings.user_id = ? AND UPPER(bookings.booking_status) = 'CONFIRMED'
		 ORDER BY bookings.id
		 LIMIT 1`,
		[user.id]
	);

	if (existingBooking) {
		return {
			bookingId: existingBooking.id,
			userId: user.id,
			eventId: existingBooking.event_id,
			seatId: existingBooking.seat_id,
			seatNumber: existingBooking.seat_number,
			status: "ALREADY_BOOKED"
		};
	}

	const event = await get("SELECT available_seats FROM events WHERE id = ?", [
		eventId
	]);

	if (!event || event.available_seats < 1) {
		return { status: "SOLD_OUT" };
	}

	const seat = await get(
		`SELECT id, seat_number
		 FROM seats
		 WHERE event_id = ? AND UPPER(status) = 'AVAILABLE'
		 ORDER BY id
		 LIMIT 1`,
		[eventId]
	);

	if (!seat) {
		return { status: "SOLD_OUT" };
	}

	const seatUpdate = await run(
		`UPDATE seats
		 SET status = 'booked', user_id = ?
		 WHERE id = ? AND UPPER(status) = 'AVAILABLE'`,
		[user.id, seat.id]
	);

	if (seatUpdate.changes !== 1) {
		throw new Error("Unable to reserve the selected seat");
	}

	const eventUpdate = await run(
		`UPDATE events
		 SET available_seats = available_seats - 1
		 WHERE id = ? AND available_seats > 0`,
		[eventId]
	);

	if (eventUpdate.changes !== 1) {
		throw new Error("Unable to update available seats");
	}

	const booking = await run(
		`INSERT INTO bookings (event_id, user_id, seat_id, booking_status)
		 VALUES (?, ?, ?, ?)`,
		[eventId, user.id, seat.id, "confirmed"]
	);

	return {
		bookingId: booking.lastID,
		userId: user.id,
		eventId,
		seatId: seat.id,
		seatNumber: seat.seat_number,
		status: "CONFIRMED"
	};
};

const allocateSeatInternal = async (userId) => {
	await database.ready;
	await run("BEGIN IMMEDIATE TRANSACTION");

	try {
		const event = await get(
			`SELECT id
			 FROM events
			 WHERE status IN ('open', 'upcoming')
			 ORDER BY id
			 LIMIT 1`
		);

		if (!event) {
			const error = new Error("No open event found");
			error.code = "NO_OPEN_EVENT";
			throw error;
		}

		const allocation = await allocateSeatInTransaction(userId, event.id);

		if (allocation.status === "SOLD_OUT") {
			await run("ROLLBACK");
			return allocation;
		}

		await run("COMMIT");
		return allocation;
	} catch (error) {
		await run("ROLLBACK").catch(() => {});
		throw error;
	}
};

let allocationQueue = Promise.resolve();

const allocateSeat = (userId) => {
	const nextAllocation = allocationQueue.then(() => allocateSeatInternal(userId));
	allocationQueue = nextAllocation.catch(() => {});
	return nextAllocation;
};

module.exports = { allocateSeat, allocateSeatInTransaction };
