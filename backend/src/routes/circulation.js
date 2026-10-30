const { Router } = require("express");
const pool = require("../config/database");
const env = require("../config/env");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");
const { makeId } = require("../utils/identifiers");
const { createNotification } = require("../utils/notifications");

const router = Router();
router.use(authenticate);
const staff = authorize("admin", "librarian");

router.get("/issues", asyncHandler(async (req, res) => {
  const studentFilter = req.user.role === "student"
    ? "AND s.user_id = ?"
    : (req.query.student_id ? "AND i.student_id = ?" : "");
  const params = req.user.role === "student" ? [req.user.id] : (req.query.student_id ? [req.query.student_id] : []);
  const status = req.query.status;
  const statusFilters = {
    issued: "AND i.status = 'issued' AND i.due_at >= CURRENT_DATE",
    overdue: "AND (i.status = 'overdue' OR (i.status = 'issued' AND i.due_at < CURRENT_DATE))",
    returned: "AND i.status = 'returned'"
  };
  if (status && !statusFilters[status]) throw new AppError("Invalid loan status filter.", 400);
  const statusFilter = status ? statusFilters[status] : "";
  const [rows] = await pool.execute(
    `SELECT i.id, i.issue_code, i.issued_at, i.due_at, i.returned_at,
            CASE WHEN i.status = 'issued' AND i.due_at < CURRENT_DATE THEN 'overdue' ELSE i.status END AS status,
            b.id AS book_id, b.title AS book_title, b.book_code, b.cover_image,
            s.id AS student_id, s.student_code, u.full_name AS student_name,
            COALESCE(f.amount, GREATEST(CURRENT_DATE - i.due_at, 0) * ?) AS fine_amount,
            COALESCE(f.paid_amount, 0) AS paid_amount
     FROM book_issues i JOIN books b ON b.id = i.book_id
     JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
     LEFT JOIN fines f ON f.issue_id = i.id
     WHERE 1=1 ${studentFilter} ${statusFilter}
     ORDER BY i.issued_at DESC LIMIT 250`,
    [env.FINE_PER_DAY, ...params]
  );
  res.json(rows);
}));

router.post("/issues", staff, asyncHandler(async (req, res) => {
  const bookId = Number(req.body.book_id);
  const studentId = Number(req.body.student_id);
  const dueAt = req.body.due_at;
  const validDueDate = typeof dueAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueAt) &&
    !Number.isNaN(Date.parse(`${dueAt}T00:00:00.000Z`)) &&
    new Date(`${dueAt}T00:00:00.000Z`).toISOString().slice(0, 10) === dueAt;
  if (!Number.isInteger(bookId) || !Number.isInteger(studentId) ||
      bookId < 1 || studentId < 1 || !validDueDate || dueAt < new Date().toISOString().slice(0, 10)) {
    throw new AppError("Select a book, student, and a valid due date.", 400);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [bookRows] = await connection.execute("SELECT id, title, available_copies FROM books WHERE id = ? FOR UPDATE", [bookId]);
    if (!bookRows[0]) throw new AppError("Book not found.", 404);
    if (Number(bookRows[0].available_copies) < 1) throw new AppError("No copies of this book are currently available.", 409);
    const [studentRows] = await connection.execute(
      `SELECT s.id, s.user_id, u.full_name, u.status FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? FOR UPDATE`,
      [studentId]
    );
    if (!studentRows[0] || studentRows[0].status !== "active") throw new AppError("Active student account not found.", 404);
    const [activeRows] = await connection.execute(
      "SELECT COUNT(*) AS count FROM book_issues WHERE student_id = ? AND status IN ('issued','overdue')",
      [studentId]
    );
    if (Number(activeRows[0].count) >= env.MAX_BORROWED_BOOKS) {
      throw new AppError(`This student has reached the ${env.MAX_BORROWED_BOOKS}-book borrowing limit.`, 409);
    }
    const [reservationRows] = await connection.execute(
      `SELECT id, student_id FROM reservations
       WHERE book_id = ? AND (status = 'pending' OR (status = 'ready' AND expires_at > CURRENT_TIMESTAMP))
       ORDER BY CASE status WHEN 'ready' THEN 0 ELSE 1 END, queued_at
       LIMIT 1 FOR UPDATE`,
      [bookId]
    );
    if (reservationRows[0] && Number(reservationRows[0].student_id) !== studentId) {
      throw new AppError("This copy is reserved for the next student in the queue.", 409);
    }
    const [issue] = await connection.execute(
      "INSERT INTO book_issues (issue_code, book_id, student_id, issued_by, due_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [makeId("ISS"), bookId, studentId, req.user.id, dueAt]
    );
    await connection.execute("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?", [bookId]);
    if (reservationRows[0]) {
      await connection.execute("UPDATE reservations SET status = 'fulfilled' WHERE id = ?", [reservationRows[0].id]);
    }
    await createNotification(connection, studentRows[0].user_id, "issue", "Book checked out",
      `${bookRows[0].title} has been issued to you. Please return it by ${dueAt}.`);
    await connection.commit();
    res.status(201).json({ id: issue.insertId, message: "Book issued successfully." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post("/issues/:id/return", staff, asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT i.id, i.book_id, i.student_id, i.status, i.due_at, b.title, s.user_id
       FROM book_issues i JOIN books b ON b.id = i.book_id JOIN students s ON s.id = i.student_id
       WHERE i.id = ? FOR UPDATE`,
      [req.params.id]
    );
    const issue = rows[0];
    if (!issue) throw new AppError("Loan record not found.", 404);
    if (!["issued", "overdue"].includes(issue.status)) throw new AppError("This book has already been returned.", 409);
    await connection.execute(
      "UPDATE book_issues SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE id = ?",
      [issue.id]
    );
    await connection.execute("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [issue.book_id]);
    const [fineRows] = await connection.execute(
      "SELECT GREATEST(CURRENT_DATE - ?, 0) * ? AS amount",
      [issue.due_at, env.FINE_PER_DAY]
    );
    const fineAmount = Number(fineRows[0].amount);
    if (fineAmount > 0) {
      await connection.execute(
        `INSERT INTO fines (issue_id, student_id, amount, status) VALUES (?, ?, ?, 'pending')
         ON CONFLICT (issue_id) DO UPDATE SET amount = GREATEST(fines.amount, EXCLUDED.amount)`,
        [issue.id, issue.student_id, fineAmount]
      );
    }
    const [readyRows] = await connection.execute(
      "SELECT COUNT(*) AS count FROM reservations WHERE book_id = ? AND status = 'ready' AND expires_at > CURRENT_TIMESTAMP",
      [issue.book_id]
    );
    const [availableRows] = await connection.execute("SELECT available_copies FROM books WHERE id = ?", [issue.book_id]);
    const [reservationRows] = Number(availableRows[0].available_copies) > Number(readyRows[0].count)
      ? await connection.execute(
        `SELECT r.id, r.student_id, s.user_id FROM reservations r JOIN students s ON s.id = r.student_id
         WHERE r.book_id = ? AND r.status = 'pending' ORDER BY r.queued_at LIMIT 1 FOR UPDATE`,
        [issue.book_id]
      )
      : [[]];
    if (reservationRows[0]) {
      const expiryDays = env.RESERVATION_EXPIRY_DAYS;
      await connection.execute(
        "UPDATE reservations SET status = 'ready', expires_at = CURRENT_TIMESTAMP + make_interval(days => ?), notified_at = CURRENT_TIMESTAMP WHERE id = ?",
        [expiryDays, reservationRows[0].id]
      );
      await createNotification(connection, reservationRows[0].user_id, "reservation",
        "Your reserved book is ready", `${issue.title} is now available. Please collect it within ${expiryDays} days.`);
    }
    await createNotification(connection, issue.user_id, "return", "Book returned", `${issue.title} has been checked in.`);
    await connection.commit();
    res.json({ message: "Book returned successfully.", fineAmount });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/fines", asyncHandler(async (req, res) => {
  const own = req.user.role === "student";
  const [rows] = await pool.execute(
    `SELECT f.id, f.issue_id, f.amount, f.paid_amount, f.status, f.created_at,
            i.issue_code, i.due_at, b.title AS book_title, s.id AS student_id,
            s.student_code, u.full_name AS student_name
     FROM fines f JOIN book_issues i ON i.id = f.issue_id JOIN books b ON b.id = i.book_id
     JOIN students s ON s.id = f.student_id JOIN users u ON u.id = s.user_id
     WHERE (? = 0 OR s.user_id = ?) ORDER BY f.created_at DESC`,
    [own ? 1 : 0, req.user.id]
  );
  res.json(rows);
}));

router.post("/fines/:id/payments", staff, asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  const method = req.body.method || "cash";
  if (!Number.isFinite(amount) || amount <= 0 || !["cash", "bank_transfer", "other"].includes(method)) {
    throw new AppError("Enter a positive payment amount and a valid payment method.", 400);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM fines WHERE id = ? FOR UPDATE", [req.params.id]);
    const fine = rows[0];
    if (!fine) throw new AppError("Fine not found.", 404);
    const outstanding = Number(fine.amount) - Number(fine.paid_amount);
    if (amount > outstanding) throw new AppError(`Payment cannot exceed the outstanding balance of ${outstanding.toFixed(2)}.`, 400);
    await connection.execute(
      "INSERT INTO payments (fine_id, recorded_by, amount, method, reference) VALUES (?, ?, ?, ?, ?)",
      [fine.id, req.user.id, amount, method, req.body.reference || null]
    );
    const newPaid = Number(fine.paid_amount) + amount;
    await connection.execute("UPDATE fines SET paid_amount = ?, status = ? WHERE id = ?", [
      newPaid, newPaid >= Number(fine.amount) ? "paid" : "partial", fine.id
    ]);
    await connection.commit();
    res.status(201).json({ message: "Fine payment recorded.", remaining: Number(fine.amount) - newPaid });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/payments", staff, asyncHandler(async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT p.id, p.amount, p.method, p.reference, p.paid_at,
            u.full_name AS student_name, s.student_code, b.title AS book_title
     FROM payments p JOIN fines f ON f.id = p.fine_id
     JOIN students s ON s.id = f.student_id JOIN users u ON u.id = s.user_id
     JOIN book_issues i ON i.id = f.issue_id JOIN books b ON b.id = i.book_id
     ORDER BY p.paid_at DESC LIMIT 250`
  );
  res.json(rows);
}));

module.exports = router;
