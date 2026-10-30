function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  if (error.code === "23505") {
    return res.status(409).json({ message: "A record with those details already exists." });
  }
  if (error.code === "23503" && error.detail?.includes("still referenced")) {
    return res.status(409).json({ message: "This record is still in use and cannot be deleted." });
  }
  if (error.code === "23503") {
    return res.status(400).json({ message: "One of the selected related records does not exist." });
  }
  if (error.code === "23514") {
    return res.status(400).json({ message: "The submitted values do not satisfy a database constraint." });
  }
  if (error.name === "MulterError") {
    return res.status(400).json({ message: error.message });
  }
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    message: status >= 500 ? "An unexpected server error occurred." : error.message
  });
}

module.exports = { notFound, errorHandler };
