const crypto = require("crypto");
const database = require("../database");
const { allocateSeatInTransaction } = require("./allocationService");

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

const joinQueue = async (name, email) => {
	await database.ready;

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

	await run("BEGIN IMMEDIATE TRANSACTION");

	try {
		let user = await get(
			"SELECT id, session_id FROM users WHERE email = ? ORDER BY id LIMIT 1",
			[email]
		);

		if (!user) {
			const sessionId = crypto.randomUUID();
			const result = await run(
				`INSERT INTO users (name, email, session_id, status)
				 VALUES (?, ?, ?, ?)`,
				[name, email, sessionId, "waiting"]
			);

			user = { id: result.lastID, session_id: sessionId };
		} else if (!user.session_id) {
			user.session_id = crypto.randomUUID();
			await run("UPDATE users SET session_id = ? WHERE id = ?", [
				user.session_id,
				user.id
			]);
		}

		const existingEntry = await get(
			`SELECT position, status
			 FROM queue
			 WHERE event_id = ? AND user_id = ?
			 ORDER BY id
			 LIMIT 1`,
			[event.id, user.id]
		);

		if (existingEntry) {
			await run("COMMIT");
			return {
				userId: user.id,
				sessionId: user.session_id,
				queuePosition: existingEntry.position,
				status: existingEntry.status
			};
		}

		const nextPosition = await get(
			"SELECT COALESCE(MAX(position), 0) + 1 AS position FROM queue WHERE event_id = ?",
			[event.id]
		);

		await run(
			`INSERT INTO queue (event_id, user_id, position, status)
			 VALUES (?, ?, ?, ?)`,
			[event.id, user.id, nextPosition.position, "waiting"]
		);
		await run("COMMIT");

		return {
			userId: user.id,
			sessionId: user.session_id,
			queuePosition: nextPosition.position,
			status: "waiting"
		};
	} catch (error) {
		await run("ROLLBACK").catch(() => {});
		throw error;
	}
};

const getQueueStatus = async (userId) => {
	await database.ready;

	const user = await get("SELECT id FROM users WHERE id = ?", [userId]);

	if (!user) {
		const error = new Error("User not found");
		error.code = "USER_NOT_FOUND";
		throw error;
	}

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

	const queueEntry = await get(
		`SELECT position, status
		 FROM queue
		 WHERE event_id = ? AND user_id = ?
		 ORDER BY id
		 LIMIT 1`,
		[event.id, user.id]
	);

	if (!queueEntry) {
		const error = new Error("User is not in the queue");
		error.code = "QUEUE_ENTRY_NOT_FOUND";
		throw error;
	}

	return {
		userId: user.id,
		queuePosition: queueEntry.position,
		status: queueEntry.status.toUpperCase()
	};
};

const processNextUserInternal = async () => {
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
		const nextUser = await get(
			`SELECT queue.id AS queue_id,
					users.id AS user_id,
					users.name,
					users.email,
					users.session_id,
					queue.position
			 FROM queue
			 JOIN users ON users.id = queue.user_id
			 WHERE queue.event_id = ? AND UPPER(queue.status) = 'WAITING'
			 ORDER BY queue.position, queue.joined_at, queue.id
			 LIMIT 1`,
			[event.id]
		);

		if (!nextUser) {
			await run("COMMIT");
			return null;
		}

		await run("UPDATE queue SET status = 'processing' WHERE id = ?", [
			nextUser.queue_id
		]);

		const allocation = await allocateSeatInTransaction(
			nextUser.user_id,
			event.id
		);

		if (allocation.status === "SOLD_OUT") {
			await run("UPDATE queue SET status = 'sold_out' WHERE id = ?", [
				nextUser.queue_id
			]);
			await run("COMMIT");

			return {
				userId: nextUser.user_id,
				name: nextUser.name,
				email: nextUser.email,
				sessionId: nextUser.session_id,
				queuePosition: nextUser.position,
				status: "SOLD_OUT"
			};
		}

		await run("UPDATE queue SET status = 'allocated' WHERE id = ?", [
			nextUser.queue_id
		]);
		await run("COMMIT");

		return {
			userId: nextUser.user_id,
			name: nextUser.name,
			email: nextUser.email,
			sessionId: nextUser.session_id,
			queuePosition: nextUser.position,
			status: "ALLOCATED",
			bookingId: allocation.bookingId,
			seatNumber: allocation.seatNumber
		};
	} catch (error) {
		await run("ROLLBACK").catch(() => {});
		throw error;
	}
};

let processingQueue = Promise.resolve();

const processNextUser = () => {
	const nextProcessing = processingQueue.then(() => processNextUserInternal());
	processingQueue = nextProcessing.catch(() => {});
	return nextProcessing;
};

module.exports = { joinQueue, getQueueStatus, processNextUser };
