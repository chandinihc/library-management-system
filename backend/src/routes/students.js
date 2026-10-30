const { Router } = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");
const { makeId } = require("../utils/identifiers");

const router = Router();
router.use(authenticate, authorize("admin", "librarian"));

router.get("/", asyncHandler(async (req, res) => {
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
  const status = req.query.status || null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const filters = [search, search, search, search, search, status, status];
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM students s JOIN users u ON u.id = s.user_id
     WHERE (? IS NULL OR u.full_name LIKE ? OR u.email LIKE ? OR s.student_code LIKE ? OR s.department LIKE ?)
       AND (? IS NULL OR u.status = ?)`,
    filters
  );
  const [[summary]] = await pool.execute(
    `SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'active') AS active_students,
      (SELECT COUNT(DISTINCT department) FROM students) AS departments,
      (SELECT COALESCE(SUM(amount - paid_amount), 0) FROM fines WHERE status IN ('pending','partial')) AS outstanding_fines`
  );
  const [rows] = await pool.execute(
    `SELECT s.id, s.student_code, s.department, s.course, s.year_of_study, s.address,
            u.id AS user_id, u.email, u.full_name, u.phone, u.status, u.created_at,
            (SELECT COUNT(*) FROM book_issues i WHERE i.student_id = s.id AND i.status IN ('issued','overdue')) AS active_loans,
            (SELECT COALESCE(SUM(f.amount - f.paid_amount), 0) FROM fines f
             WHERE f.student_id = s.id AND f.status IN ('pending','partial')) AS outstanding_fines
     FROM students s JOIN users u ON u.id = s.user_id
     WHERE (? IS NULL OR u.full_name LIKE ? OR u.email LIKE ? OR s.student_code LIKE ? OR s.department LIKE ?)
       AND (? IS NULL OR u.status = ?)
     ORDER BY u.full_name`,
    [...filters, limit, (page - 1) * limit]
  );
  res.json({ items: rows, page, limit, total: Number(countRows[0].total), summary });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { email, password, full_name: fullName, phone, department, course, year_of_study: yearOfStudy, address } = req.body;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" || password.length < 8 ||
      typeof fullName !== "string" || fullName.trim().length < 2 ||
      typeof department !== "string" || !department.trim() ||
      typeof course !== "string" || !course.trim()) {
    throw new AppError("Provide a valid email, password (8+ characters), name, department, and course.", 400);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const hash = await bcrypt.hash(password, 12);
    const [user] = await connection.execute(
      "INSERT INTO users (email, password_hash, role, full_name, phone) VALUES (?, ?, 'student', ?, ?)",
      [email.trim().toLowerCase(), hash, fullName.trim(), phone || null]
    );
    const [student] = await connection.execute(
      "INSERT INTO students (user_id, student_code, department, course, year_of_study, address) VALUES (?, ?, ?, ?, ?, ?)",
      [user.insertId, makeId("STU"), department.trim(), course.trim(), yearOfStudy || null, address || null]
    );
    await connection.commit();
    res.status(201).json({ id: student.insertId, message: "Student registered successfully." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/:id/history", asyncHandler(async (req, res) => {
  const [student] = await pool.execute("SELECT id FROM students WHERE id = ?", [req.params.id]);
  if (!student[0]) throw new AppError("Student not found.", 404);
  const [rows] = await pool.execute(
    `SELECT i.id, i.issue_code, i.issued_at, i.due_at, i.returned_at, i.status,
            b.title, b.isbn, f.amount AS fine_amount, f.paid_amount, f.status AS fine_status
     FROM book_issues i JOIN books b ON b.id = i.book_id
     LEFT JOIN fines f ON f.issue_id = i.id
     WHERE i.student_id = ? ORDER BY i.issued_at DESC`,
    [req.params.id]
  );
  res.json(rows);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { email, full_name: fullName, phone, department, course, year_of_study: yearOfStudy, address, status } = req.body;
  if (typeof fullName !== "string" || fullName.trim().length < 2 ||
      typeof department !== "string" || typeof course !== "string") {
    throw new AppError("Name, department, and course are required.", 400);
  }
  if (status !== undefined && !["active", "inactive"].includes(status)) throw new AppError("Invalid account status.", 400);
  if (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new AppError("Enter a valid email address.", 400);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT user_id FROM students WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!rows[0]) throw new AppError("Student not found.", 404);
    if (status === "inactive") {
      const [[active]] = await connection.execute(
        "SELECT COUNT(*) AS count FROM book_issues WHERE student_id = ? AND status IN ('issued','overdue')",
        [req.params.id]
      );
      if (Number(active.count)) throw new AppError("Students with active loans cannot be deactivated.", 409);
      await connection.execute(
        "UPDATE reservations SET status = 'cancelled' WHERE student_id = ? AND status IN ('pending','ready')",
        [req.params.id]
      );
    }
    await connection.execute(
      "UPDATE users SET email = COALESCE(?, email), full_name = ?, phone = ?, status = COALESCE(?, status) WHERE id = ?",
      [email || null, fullName.trim(), phone || null, status || null, rows[0].user_id]
    );
    await connection.execute(
      "UPDATE students SET department = ?, course = ?, year_of_study = ?, address = ? WHERE id = ?",
      [department.trim(), course.trim(), yearOfStudy || null, address || null, req.params.id]
    );
    await connection.commit();
    res.json({ message: "Student profile updated." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.delete("/:id", authorize("admin"), asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT user_id FROM students WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!rows[0]) throw new AppError("Student not found.", 404);
    const [active] = await connection.execute(
      "SELECT COUNT(*) AS count FROM book_issues WHERE student_id = ? AND status IN ('issued','overdue')",
      [req.params.id]
    );
    if (Number(active[0].count)) throw new AppError("Students with active loans cannot be deactivated.", 409);
    await connection.execute(
      "UPDATE reservations SET status = 'cancelled' WHERE student_id = ? AND status IN ('pending','ready')",
      [req.params.id]
    );
    await connection.execute("UPDATE users SET status = 'inactive' WHERE id = ?", [rows[0].user_id]);
    await connection.commit();
    res.json({ message: "Student account deactivated." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
