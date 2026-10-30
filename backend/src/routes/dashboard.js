const { Router } = require("express");
const pool = require("../config/database");
const env = require("../config/env");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { getMonthlyCirculation } = require("../models/analytics");

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    const [studentRows] = await pool.execute("SELECT id FROM students WHERE user_id = ?", [req.user.id]);
    const studentId = studentRows[0]?.id;
    if (!studentId) return res.json({ role: "student", stats: {}, recentIssues: [], dueSoon: [] });
    const [[stats]] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM book_issues WHERE student_id = ? AND status IN ('issued','overdue')) AS activeLoans,
        (SELECT COUNT(*) FROM book_issues WHERE student_id = ? AND status IN ('issued','overdue') AND due_at < CURRENT_DATE) AS overdueLoans,
        (SELECT COUNT(*) FROM reservations WHERE student_id = ? AND status IN ('pending','ready')) AS reservations,
        (SELECT COALESCE(SUM(amount - paid_amount), 0) FROM fines WHERE student_id = ? AND status IN ('pending','partial')) AS outstandingFines`,
      [studentId, studentId, studentId, studentId]
    );
    const [recentIssues] = await pool.execute(
      `SELECT i.id, i.issue_code, i.due_at, i.returned_at, i.status, b.title AS book_title,
              CASE WHEN i.status = 'issued' AND i.due_at < CURRENT_DATE THEN 'overdue' ELSE i.status END AS display_status
       FROM book_issues i JOIN books b ON b.id = i.book_id
       WHERE i.student_id = ? ORDER BY i.issued_at DESC LIMIT 6`,
      [studentId]
    );
    const [dueSoon] = await pool.execute(
      `SELECT b.title AS book_title, i.due_at, DATEDIFF(i.due_at, CURRENT_DATE) AS days_remaining
       FROM book_issues i JOIN books b ON b.id = i.book_id
       WHERE i.student_id = ? AND i.status = 'issued' AND i.due_at >= CURRENT_DATE AND i.due_at <= DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY)
       ORDER BY i.due_at`,
      [studentId]
    );
    return res.json({ role: "student", stats, recentIssues, dueSoon });
  }

  const [[stats]] = await pool.execute(
    `SELECT
      (SELECT COUNT(*) FROM books) AS totalTitles,
      (SELECT COALESCE(SUM(total_copies),0) FROM books) AS totalCopies,
      (SELECT COALESCE(SUM(available_copies),0) FROM books) AS availableCopies,
      (SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'active') AS totalStudents,
      (SELECT COUNT(*) FROM book_issues WHERE status IN ('issued','overdue')) AS activeLoans,
      (SELECT COUNT(*) FROM book_issues WHERE status IN ('issued','overdue') AND due_at < CURRENT_DATE) AS overdueBooks,
      (SELECT COUNT(*) FROM reservations WHERE status IN ('pending','ready')) AS pendingReservations,
      (SELECT COALESCE(SUM(amount),0) FROM payments) AS finesCollected`
  );
  const [recentTransactions] = await pool.execute(
    `SELECT i.id, i.issue_code AS reference, 'issue' AS type, i.issued_at AS occurred_at,
            u.full_name AS student_name, b.title AS book_title
     FROM book_issues i JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
     JOIN books b ON b.id = i.book_id
     UNION ALL
     SELECT i.id, i.issue_code AS reference, 'return' AS type, i.returned_at AS occurred_at,
            u.full_name AS student_name, b.title AS book_title
     FROM book_issues i JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
     JOIN books b ON b.id = i.book_id WHERE i.returned_at IS NOT NULL
     ORDER BY occurred_at DESC LIMIT 8`
  );
  const monthly = await getMonthlyCirculation(pool, 6);
  const [categories] = await pool.execute(
    `SELECT c.name, COUNT(DISTINCT b.id) AS count FROM categories c
     LEFT JOIN books b ON b.category_id = c.id GROUP BY c.id ORDER BY count DESC LIMIT 6`
  );
  const [popularBooks] = await pool.execute(
    `SELECT b.id, b.title, COUNT(i.id) AS borrow_count FROM books b
     LEFT JOIN book_issues i ON i.book_id = b.id GROUP BY b.id ORDER BY borrow_count DESC, b.title LIMIT 5`
  );
  const [studentActivity] = await pool.execute(
    `SELECT u.full_name AS name, COUNT(i.id) AS borrow_count FROM students s
     JOIN users u ON u.id = s.user_id LEFT JOIN book_issues i ON i.student_id = s.id
     GROUP BY s.id ORDER BY borrow_count DESC LIMIT 5`
  );
  const [overdue] = await pool.execute(
    `SELECT i.id, i.issue_code, i.due_at, b.title AS book_title, u.full_name AS student_name,
            GREATEST(DATEDIFF(CURRENT_DATE, i.due_at), 0) * ? AS fine_amount
     FROM book_issues i JOIN books b ON b.id = i.book_id
     JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
     WHERE i.status IN ('issued','overdue') AND i.due_at < CURRENT_DATE ORDER BY i.due_at LIMIT 8`,
    [env.FINE_PER_DAY]
  );
  res.json({ role: req.user.role, stats, recentTransactions, monthly, categories, popularBooks, studentActivity, overdue });
}));

module.exports = router;
