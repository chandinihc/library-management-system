const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { rateLimit } = require("express-rate-limit");
const pool = require("../config/database");
const env = require("../config/env");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");
const { makeId } = require("../utils/identifiers");

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please wait a few minutes and try again." }
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please wait before trying again." }
});

router.post("/login", loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    throw new AppError("Email and password are required.", 400);
  }
  const [rows] = await pool.execute(
    "SELECT id, email, password_hash, role, full_name, status FROM users WHERE email = ? LIMIT 1",
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError("The email or password is incorrect.", 401);
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  delete user.password_hash;
  res.json({ token, user });
}));

router.post("/register", asyncHandler(async (req, res) => {
  const { email, password, full_name: fullName, phone, department, course, year_of_study: yearOfStudy } = req.body;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("Enter a valid email address.", 400);
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new AppError("Password must contain at least 8 characters.", 400);
  }
  if (typeof fullName !== "string" || fullName.trim().length < 2 ||
      typeof department !== "string" || !department.trim() ||
      typeof course !== "string" || !course.trim()) {
    throw new AppError("Name, department, and course are required.", 400);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const passwordHash = await bcrypt.hash(password, 12);
    const [userResult] = await connection.execute(
      "INSERT INTO users (email, password_hash, role, full_name, phone) VALUES (?, ?, 'student', ?, ?) RETURNING id",
      [email.trim().toLowerCase(), passwordHash, fullName.trim(), phone?.trim() || null]
    );
    const studentCode = makeId("STU");
    await connection.execute(
      "INSERT INTO students (user_id, student_code, department, course, year_of_study) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [userResult.insertId, studentCode, department.trim(), course.trim(), yearOfStudy || null]
    );
    await connection.commit();
    res.status(201).json({ message: "Student account created. You can now sign in." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.email, u.role, u.full_name, u.phone, u.status, u.created_at,
            s.id AS student_id, s.student_code, s.department, s.course, s.year_of_study, s.address
     FROM users u LEFT JOIN students s ON s.user_id = u.id WHERE u.id = ?`,
    [req.user.id]
  );
  res.json(rows[0]);
}));

router.patch("/profile", authenticate, asyncHandler(async (req, res) => {
  const { full_name: fullName, phone, department, course, year_of_study: yearOfStudy, address } = req.body;
  if (typeof fullName !== "string" || fullName.trim().length < 2) {
    throw new AppError("Enter your full name.", 400);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE users SET full_name = ?, phone = ? WHERE id = ?", [
      fullName.trim(), typeof phone === "string" ? phone.trim() : null, req.user.id
    ]);
    if (req.user.role === "student") {
      await connection.execute(
        "UPDATE students SET department = COALESCE(?, department), course = COALESCE(?, course), year_of_study = COALESCE(?, year_of_study), address = ? WHERE user_id = ?",
        [department || null, course || null, yearOfStudy || null, address || null, req.user.id]
      );
    }
    await connection.commit();
    res.json({ message: "Profile updated successfully." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post("/forgot-password", resetLimiter, asyncHandler(async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const genericMessage = "If an active account exists for that email, password reset instructions have been sent.";
  if (!email) return res.json({ message: genericMessage });
  const [rows] = await pool.execute("SELECT id, email FROM users WHERE email = ? AND status = 'active'", [email]);
  if (!rows[0]) return res.json({ message: genericMessage });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await pool.execute(
    "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '30 minutes')",
    [rows[0].id, tokenHash]
  );
  if (env.SMTP_HOST && env.SMTP_USER) {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
    });
    const url = `${env.CLIENT_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: rows[0].email,
      subject: "Reset your library account password",
      text: `Use this link within 30 minutes to reset your password: ${url}`
    });
  }
  res.json({
    message: genericMessage,
    ...(process.env.NODE_ENV !== "production" && !env.SMTP_HOST ? { developmentResetToken: token } : {})
  });
}));

router.post("/reset-password", asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== "string" || token.length < 20 || typeof password !== "string" || password.length < 8) {
    throw new AppError("A valid reset token and a password of at least 8 characters are required.", 400);
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1 FOR UPDATE",
      [tokenHash]
    );
    if (!rows[0]) throw new AppError("This reset link is invalid or has expired.", 400);
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, rows[0].user_id]);
    await connection.execute("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL", [rows[0].user_id]);
    await connection.commit();
    res.json({ message: "Password reset successfully. Please sign in." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
