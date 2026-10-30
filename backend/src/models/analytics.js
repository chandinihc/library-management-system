async function getMonthlyCirculation(executor, months) {
  const interval = Math.max(0, Math.floor(months) - 1);
  const [rows] = await executor.execute(
    `SELECT month, SUM(issues) AS issues, SUM(returns_count) AS returns_count
     FROM (
       SELECT to_char(issued_at, 'YYYY-MM') AS month, COUNT(*) AS issues, 0 AS returns_count
       FROM book_issues
       WHERE issued_at >= date_trunc('month', CURRENT_DATE) - make_interval(months => ?)
       GROUP BY to_char(issued_at, 'YYYY-MM')
       UNION ALL
       SELECT to_char(returned_at, 'YYYY-MM') AS month, 0 AS issues, COUNT(*) AS returns_count
       FROM book_issues
       WHERE returned_at IS NOT NULL
         AND returned_at >= date_trunc('month', CURRENT_DATE) - make_interval(months => ?)
       GROUP BY to_char(returned_at, 'YYYY-MM')
     ) activity
     GROUP BY month ORDER BY month`,
    [interval, interval]
  );
  return rows;
}

module.exports = { getMonthlyCirculation };
