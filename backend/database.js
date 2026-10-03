const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databaseDirectory = path.join(__dirname, "database");
const databasePath = path.join(databaseDirectory, "fair-drop.db");

fs.mkdirSync(databaseDirectory, { recursive: true });

let resolveDatabaseReady;
let rejectDatabaseReady;
const databaseReady = new Promise((resolve, reject) => {
	resolveDatabaseReady = resolve;
	rejectDatabaseReady = reject;
});

const database = new sqlite3.Database(databasePath, (error) => {
	if (error) {
		console.error("Unable to connect to SQLite:", error.message);
		rejectDatabaseReady(error);
		return;
	}

	console.log("Connected to SQLite");
});

database.ready = databaseReady;

const seedSeats = (eventId, done) => {
	const seatStatement = database.prepare(
		"INSERT OR IGNORE INTO seats (event_id, seat_number, status) VALUES (?, ?, ?)"
	);

	for (let seatIndex = 1; seatIndex <= 500; seatIndex += 1) {
		const seatNumber = `A-${String(seatIndex).padStart(3, "0")}`;
		seatStatement.run(eventId, seatNumber, "available");
	}

	seatStatement.finalize(done);
};

database.serialize(() => {
	database.run("PRAGMA foreign_keys = ON");

	database.run(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL,
			session_id TEXT,
			status TEXT NOT NULL DEFAULT 'waiting',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			total_seats INTEGER NOT NULL,
			available_seats INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'upcoming'
		)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS seats (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id INTEGER NOT NULL,
			seat_number TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'available',
			user_id INTEGER,
			FOREIGN KEY (event_id) REFERENCES events (id),
			FOREIGN KEY (user_id) REFERENCES users (id),
			UNIQUE (event_id, seat_number)
		)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			position INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'waiting',
			joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (event_id) REFERENCES events (id),
			FOREIGN KEY (user_id) REFERENCES users (id)
		)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS bookings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			seat_id INTEGER NOT NULL,
			booking_status TEXT NOT NULL DEFAULT 'pending',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (event_id) REFERENCES events (id),
			FOREIGN KEY (user_id) REFERENCES users (id),
			FOREIGN KEY (seat_id) REFERENCES seats (id)
		)
	`);

	database.get(
		"SELECT id FROM events WHERE name = ?",
		["TechFest 2026"],
		(error, event) => {
			if (error) {
				console.error("Unable to find sample event:", error.message);
				rejectDatabaseReady(error);
				return;
			}

			if (event) {
				seedSeats(event.id, (seedError) => {
					if (seedError) {
						console.error("Unable to create sample seats:", seedError.message);
						rejectDatabaseReady(seedError);
						return;
					}

					resolveDatabaseReady(event);
				});
				return;
			}

			database.run(
				`INSERT INTO events (name, total_seats, available_seats, status)
				 VALUES (?, ?, ?, ?)`,
				["TechFest 2026", 500, 500, "upcoming"],
				function (insertError) {
					if (insertError) {
						console.error("Unable to create sample event:", insertError.message);
						rejectDatabaseReady(insertError);
						return;
					}

					seedSeats(this.lastID, (seedError) => {
						if (seedError) {
							console.error("Unable to create sample seats:", seedError.message);
							rejectDatabaseReady(seedError);
							return;
						}

						resolveDatabaseReady({ id: this.lastID });
					});
				}
			);
		}
	);
});

module.exports = database;
