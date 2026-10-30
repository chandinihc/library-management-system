const { Router } = require("express");
const authRoutes = require("./auth");
const bookRoutes = require("./books");
const directoryRoutes = require("./directory");
const studentRoutes = require("./students");
const circulationRoutes = require("./circulation");
const reservationRoutes = require("./reservations");
const notificationRoutes = require("./notifications");
const dashboardRoutes = require("./dashboard");
const reportRoutes = require("./reports");

const router = Router();
router.use("/auth", authRoutes);
router.use("/books", bookRoutes);
router.use("/directory", directoryRoutes);
router.use("/students", studentRoutes);
router.use("/", circulationRoutes);
router.use("/reservations", reservationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportRoutes);

module.exports = router;
