const { Router } = require("express");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, type, title, message, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
    [req.user.id]
  );
  res.json(rows);
}));

router.patch("/read-all", asyncHandler(async (req, res) => {
  await pool.execute("UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL", [req.user.id]);
  res.json({ message: "Notifications marked as read." });
}));

router.patch("/:id/read", asyncHandler(async (req, res) => {
  const [result] = await pool.execute(
    "UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );
  if (!result.affectedRows) throw new AppError("Notification not found.", 404);
  res.json({ message: "Notification marked as read." });
}));

module.exports = router;
