const { Router } = require("express");
const pool = require("../config/database");
const { authenticate, authorize } = require("../middleware/auth");
const env = require("../config/env");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");
const { makeId } = require("../utils/identifiers");
const { createNotification } = require("../utils/notifications");

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const isStudent = req.user.role === "student";
  const [rows] = await pool.execute(
    `SELECT r.id, r.reservation_code, r.status, r.queued_at, r.expires_at,
            b.id AS book_id, b.title AS book_title, b.cover_image,
            s.id AS student_id, s.student_code, u.full_name AS student_name,
            CASE WHEN r.status = 'pending' THEN (
              SELECT COUNT(*) + 1 FROM reservations earlier
              WHERE earlier.book_id = r.book_id AND earlier.status = 'pending' AND earlier.queued_at < r.queued_at
            ) ELSE NULL END AS queue_position
     FROM reservations r JOIN books b ON b.id = r.book_id
     JOIN students s ON s.id = r.student_id JOIN users u ON u.id = s.user_id
     WHERE (? = 0 OR u.id = ?) ORDER BY r.queued_at DESC LIMIT 300`,
    [isStudent ? 1 : 0, req.user.id]
  );
  res.json(rows);
}));

router.post("/", authorize("student"), asyncHandler(async (req, res) => {
  const bookId = Number(req.body.book_id);
  if (!Number.isInteger(bookId)) throw new AppError("Select a valid book to reserve.", 400);
  const [students] = await pool.execute("SELECT id FROM students WHERE user_id = ?", [req.user.id]);
  if (!students[0]) throw new AppError("Student profile not found.", 404);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [books] = await connection.execute(
      `SELECT b.id, b.title,
       GREATEST(b.available_copies - (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready' AND r.expires_at > CURRENT_TIMESTAMP), 0) AS available_copies
       FROM books b WHERE b.id = ? FOR UPDATE`,
      [bookId]
    );
    if (!books[0]) throw new AppError("Book not found.", 404);
    if (Number(books[0].available_copies) > 0) throw new AppError("This book is available now. Check it out from the library.", 409);
    const [existing] = await connection.execute(
      "SELECT id FROM reservations WHERE book_id = ? AND student_id = ? AND status IN ('pending','ready')",
      [bookId, students[0].id]
    );
    if (existing[0]) throw new AppError("You already have an active reservation for this book.", 409);
    const [result] = await connection.execute(
      "INSERT INTO reservations (reservation_code, book_id, student_id) VALUES (?, ?, ?) RETURNING id",
      [makeId("RES"), bookId, students[0].id]
    );
    await connection.commit();
    res.status(201).json({ id: result.insertId, message: "Your reservation has been added to the queue." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [referenceRows] = await connection.execute("SELECT book_id FROM reservations WHERE id = ?", [req.params.id]);
    if (!referenceRows[0]) throw new AppError("Reservation not found.", 404);
    const [bookRows] = await connection.execute("SELECT id, title, available_copies FROM books WHERE id = ? FOR UPDATE", [referenceRows[0].book_id]);
    const [rows] = await connection.execute(
      "SELECT r.id, r.status, s.user_id FROM reservations r JOIN students s ON s.id = r.student_id WHERE r.id = ? FOR UPDATE",
      [req.params.id]
    );
    const reservation = rows[0];
    if (!reservation) throw new AppError("Reservation not found.", 404);
    if (req.user.role === "student" && Number(reservation.user_id) !== Number(req.user.id)) {
      throw new AppError("You cannot cancel another student's reservation.", 403);
    }
    if (!["pending", "ready"].includes(reservation.status)) throw new AppError("This reservation can no longer be cancelled.", 409);
    await connection.execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [reservation.id]);
    if (reservation.status === "ready") {
      const [[readyCount]] = await connection.execute(
        "SELECT COUNT(*) AS count FROM reservations WHERE book_id = ? AND status = 'ready' AND expires_at > CURRENT_TIMESTAMP",
        [referenceRows[0].book_id]
      );
      if (Number(bookRows[0].available_copies) > Number(readyCount.count)) {
        const [waiting] = await connection.execute(
          `SELECT r.id, s.user_id FROM reservations r JOIN students s ON s.id = r.student_id
           WHERE r.book_id = ? AND r.status = 'pending' ORDER BY r.queued_at LIMIT 1 FOR UPDATE`,
          [referenceRows[0].book_id]
        );
        if (waiting[0]) {
          await connection.execute(
            "UPDATE reservations SET status = 'ready', expires_at = CURRENT_TIMESTAMP + make_interval(days => ?), notified_at = CURRENT_TIMESTAMP WHERE id = ?",
            [env.RESERVATION_EXPIRY_DAYS, waiting[0].id]
          );
          await createNotification(connection, waiting[0].user_id, "reservation",
            "Your reserved book is ready", `${bookRows[0].title} is now available. Please collect it within ${env.RESERVATION_EXPIRY_DAYS} days.`);
        }
      }
    }
    await connection.commit();
    res.json({ message: "Reservation cancelled." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
