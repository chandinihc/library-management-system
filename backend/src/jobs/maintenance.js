const pool = require("../config/database");
const env = require("../config/env");
const { createNotification } = require("../utils/notifications");

async function runMaintenance() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [expired] = await connection.execute(
      "UPDATE reservations SET status = 'expired' WHERE status = 'ready' AND expires_at <= UTC_TIMESTAMP()"
    );
    const [availableBooks] = await connection.execute(
      `SELECT b.id, b.title FROM books b
       WHERE b.available_copies > (
         SELECT COUNT(*) FROM reservations r
         WHERE r.book_id = b.id AND r.status = 'ready' AND r.expires_at > UTC_TIMESTAMP()
       )`
    );
    for (const book of availableBooks) {
      const [[ready]] = await connection.execute(
        "SELECT COUNT(*) AS count FROM reservations WHERE book_id = ? AND status = 'ready' AND expires_at > UTC_TIMESTAMP()",
        [book.id]
      );
      let slots = Number(book.available_copies) - Number(ready.count);
      while (slots > 0) {
        const [waiting] = await connection.execute(
          `SELECT r.id, s.user_id FROM reservations r JOIN students s ON s.id = r.student_id
           WHERE r.book_id = ? AND r.status = 'pending' ORDER BY r.queued_at LIMIT 1 FOR UPDATE`,
          [book.id]
        );
        if (!waiting[0]) break;
        await connection.execute(
          "UPDATE reservations SET status = 'ready', expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY), notified_at = UTC_TIMESTAMP() WHERE id = ?",
          [env.RESERVATION_EXPIRY_DAYS, waiting[0].id]
        );
        await createNotification(connection, waiting[0].user_id, "reservation",
          "Your reserved book is ready", `${book.title} is now available. Please collect it within ${env.RESERVATION_EXPIRY_DAYS} days.`);
        slots -= 1;
      }
    }
    const [newlyOverdue] = await connection.execute(
      `SELECT i.id, i.issue_code, i.due_at, b.title, s.user_id
       FROM book_issues i JOIN books b ON b.id = i.book_id JOIN students s ON s.id = i.student_id
       WHERE i.status = 'issued' AND i.due_at < CURRENT_DATE FOR UPDATE`
    );
    for (const issue of newlyOverdue) {
      await connection.execute("UPDATE book_issues SET status = 'overdue' WHERE id = ?", [issue.id]);
      await createNotification(connection, issue.user_id, "overdue", "Book is overdue",
        `${issue.title} was due on ${issue.due_at}. Please return it as soon as possible.`);
    }
    if (newlyOverdue.length) {
      const [staff] = await connection.execute("SELECT id FROM users WHERE role IN ('admin','librarian') AND status = 'active'");
      for (const issue of newlyOverdue) {
        for (const member of staff) {
          await createNotification(connection, member.id, "overdue", "An issued book is overdue",
            `${issue.title} (${issue.issue_code}) is overdue since ${issue.due_at}.`);
        }
      }
    }
    await connection.execute(
      `INSERT INTO fines (issue_id, student_id, amount, status)
       SELECT i.id, i.student_id, GREATEST(DATEDIFF(CURRENT_DATE, i.due_at), 0) * ?, 'pending'
       FROM book_issues i WHERE i.status = 'overdue'
       ON DUPLICATE KEY UPDATE amount = GREATEST(amount, VALUES(amount))`,
      [env.FINE_PER_DAY]
    );
    const [dueSoon] = await connection.execute(
      `SELECT i.issue_code, i.due_at, b.title, s.user_id
       FROM book_issues i JOIN books b ON b.id = i.book_id JOIN students s ON s.id = i.student_id
       WHERE i.status = 'issued' AND i.due_at BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY)`
    );
    for (const issue of dueSoon) {
      const message = `Loan ${issue.issue_code}: ${issue.title} is due on ${issue.due_at}.`;
      const [existing] = await connection.execute(
        "SELECT id FROM notifications WHERE user_id = ? AND type = 'reminder' AND message = ? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY) LIMIT 1",
        [issue.user_id, message]
      );
      if (!existing[0]) {
        await createNotification(connection, issue.user_id, "reminder", "Book due soon", message);
      }
    }
    if (newlyOverdue.length || expired.affectedRows || dueSoon.length) console.log(
      `Maintenance: ${newlyOverdue.length} newly overdue loan(s), ${expired.affectedRows} expired reservation(s), ${dueSoon.length} upcoming due date(s).`
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Library maintenance job failed:", error);
  } finally {
    connection.release();
  }
}

module.exports = { runMaintenance };
