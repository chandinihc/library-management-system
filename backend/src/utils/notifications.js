async function createNotification(executor, userId, type, title, message) {
  await executor.execute(
    "INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)",
    [userId, type, title, message]
  );
}

module.exports = { createNotification };
