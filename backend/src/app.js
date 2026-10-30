const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("node:path");
const env = require("./config/env");
const apiRouter = require("./routes");
const { notFound, errorHandler } = require("./middleware/error-handler");
const asyncHandler = require("./utils/async-handler");
const pool = require("./config/database");

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "library-management-api" }));
app.get("/api/health/database", asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", database: "connected" });
}));
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
