async function getMonthlyCirculation(executor, months) {
  const interval = Math.max(0, Math.floor(months) - 1);
  const [rows] = await executor.execute(
    `SELECT month, SUM(issues) AS issues, SUM(returns_count) AS returns_count
     FROM (
       SELECT DATE_FORMAT(issued_at, '%Y-%m') AS month, COUNT(*) AS issues, 0 AS returns_count
       FROM book_issues
       WHERE issued_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(issued_at, '%Y-%m')
       UNION ALL
       SELECT DATE_FORMAT(returned_at, '%Y-%m') AS month, 0 AS issues, COUNT(*) AS returns_count
       FROM book_issues
       WHERE returned_at IS NOT NULL
         AND returned_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(returned_at, '%Y-%m')
     ) activity
     GROUP BY month ORDER BY month`,
    [interval, interval]
  );
  return rows;
}

module.exports = { getMonthlyCirculation };
