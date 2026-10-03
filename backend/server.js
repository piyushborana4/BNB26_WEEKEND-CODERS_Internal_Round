const express = require("express");
const cors = require("cors");
require("./database");

const eventRoutes = require("./routes/eventRoutes");
const queueRoutes = require("./routes/queueRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const statisticsRoutes = require("./routes/statisticsRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
	res.json({ status: "ok" });
});

app.use("/api/event", eventRoutes);
app.use("/api", queueRoutes);
app.use("/api", bookingRoutes);
app.use("/api", statisticsRoutes);
app.use("/api/bookings", bookingRoutes);

if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`Fair Drop backend listening on port ${PORT}`);
	});
}

module.exports = app;
