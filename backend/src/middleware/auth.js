const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const env = require("../config/env");
const { AppError } = require("../utils/errors");
const asyncHandler = require("../utils/async-handler");

const authenticate = asyncHandler(async (req, _res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new AppError("Authentication is required.", 401);
  }

  let claims;
  try {
    claims = jwt.verify(authorization.slice(7), env.JWT_SECRET);
  } catch {
    throw new AppError("Your session is invalid or has expired. Please sign in again.", 401);
  }

  const [rows] = await pool.execute(
    "SELECT id, email, role, status, full_name FROM users WHERE id = ? LIMIT 1",
    [claims.sub]
  );
  const user = rows[0];
  if (!user || user.status !== "active") {
    throw new AppError("This account is unavailable.", 401);
  }
  req.user = user;
  next();
});

function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action.", 403));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
