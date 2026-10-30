const { Router } = require("express");
const pool = require("../config/database");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");
const { getMonthlyCirculation } = require("../models/analytics");

const router = Router();
router.use(authenticate, authorize("admin", "librarian"));

function dateRange(query) {
  const start = query.start_date || null;
  const end = query.end_date || null;
  const valid = (value) => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
  if (!valid(start) || !valid(end) || (start && end && start > end)) {
    throw new AppError("Provide a valid date range.", 400);
  }
  return { start, end };
}

router.get("/", asyncHandler(async (req, res) => {
  const { start, end } = dateRange(req.query);
  const [[inventory]] = await pool.execute(
    `SELECT COUNT(*) AS titles, COALESCE(SUM(total_copies),0) AS total_copies,
            COALESCE(SUM(available_copies),0) AS available_copies
     FROM books`
  );
  const [borrowed] = await pool.execute(
    `SELECT i.issue_code, i.issued_at, i.due_at, i.returned_at, i.status,
            b.title AS book_title, s.student_code, u.full_name AS student_name
     FROM book_issues i JOIN books b ON b.id = i.book_id
     JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
     WHERE (CAST(? AS date) IS NULL OR DATE(i.issued_at) >= ?) AND (CAST(? AS date) IS NULL OR DATE(i.issued_at) <= ?)
     ORDER BY i.issued_at DESC LIMIT 1000`,
    [start, start, end, end]
  );
  const [overdue] = await pool.execute(
    `SELECT i.issue_code, i.due_at, b.title AS book_title, s.student_code, u.full_name AS student_name,
            GREATEST(CURRENT_DATE - i.due_at, 0) AS days_overdue
     FROM book_issues i JOIN books b ON b.id = i.book_id
     JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
     WHERE i.status IN ('issued','overdue') AND i.due_at < CURRENT_DATE
     ORDER BY i.due_at LIMIT 1000`
  );
  const [fines] = await pool.execute(
    `SELECT p.paid_at, p.amount, p.method, p.reference, u.full_name AS student_name, b.title AS book_title
     FROM payments p JOIN fines f ON f.id = p.fine_id
     JOIN students s ON s.id = f.student_id JOIN users u ON u.id = s.user_id
     JOIN book_issues i ON i.id = f.issue_id JOIN books b ON b.id = i.book_id
     WHERE (CAST(? AS date) IS NULL OR DATE(p.paid_at) >= ?) AND (CAST(? AS date) IS NULL OR DATE(p.paid_at) <= ?)
     ORDER BY p.paid_at DESC LIMIT 1000`,
    [start, start, end, end]
  );
  const [categories] = await pool.execute(
    `SELECT c.name AS category, COUNT(DISTINCT b.id) AS titles,
            COALESCE(SUM(b.total_copies),0) AS copies,
            COUNT(DISTINCT i.id) AS loans
     FROM categories c LEFT JOIN books b ON b.category_id = c.id
     LEFT JOIN book_issues i ON i.book_id = b.id
       AND (CAST(? AS date) IS NULL OR DATE(i.issued_at) >= ?) AND (CAST(? AS date) IS NULL OR DATE(i.issued_at) <= ?)
     GROUP BY c.id ORDER BY c.name`,
    [start, start, end, end]
  );
  const [leastBorrowed] = await pool.execute(
    `SELECT b.id, b.title, COUNT(i.id) AS loan_count FROM books b
     LEFT JOIN book_issues i ON i.book_id = b.id
     GROUP BY b.id ORDER BY loan_count, b.title LIMIT 10`
  );
  const monthly = await getMonthlyCirculation(pool, 12);
  res.json({ inventory, borrowed, overdue, fines, categories, leastBorrowed, monthly, range: { start, end } });
}));

router.get("/students/:id/history", asyncHandler(async (req, res) => {
  const { start, end } = dateRange(req.query);
  const [rows] = await pool.execute(
    `SELECT i.issue_code, i.issued_at, i.due_at, i.returned_at, i.status, b.title AS book_title,
            COALESCE(f.amount,0) AS fine, COALESCE(f.paid_amount,0) AS paid
     FROM book_issues i JOIN books b ON b.id = i.book_id
     LEFT JOIN fines f ON f.issue_id = i.id
     WHERE i.student_id = ? AND (CAST(? AS date) IS NULL OR DATE(i.issued_at) >= ?) AND (CAST(? AS date) IS NULL OR DATE(i.issued_at) <= ?)
     ORDER BY i.issued_at DESC`,
    [req.params.id, start, start, end, end]
  );
  res.json(rows);
}));

module.exports = router;
