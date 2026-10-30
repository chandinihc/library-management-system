const { Router } = require("express");
const pool = require("../config/database");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");

const router = Router();
router.use(authenticate);
const staff = authorize("admin", "librarian");

router.get("/categories", asyncHandler(async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT c.id, c.name, c.description, COUNT(DISTINCT b.id) AS book_count
     FROM categories c LEFT JOIN books b ON b.category_id = c.id
     GROUP BY c.id ORDER BY c.name`
  );
  res.json(rows);
}));

router.post("/categories", staff, asyncHandler(async (req, res) => {
  if (typeof req.body.name !== "string" || !req.body.name.trim()) throw new AppError("Category name is required.", 400);
  const [result] = await pool.execute("INSERT INTO categories (name, description) VALUES (?, ?) RETURNING id", [
    req.body.name.trim(), req.body.description || null
  ]);
  res.status(201).json({ id: result.insertId, message: "Category created." });
}));

router.put("/categories/:id", staff, asyncHandler(async (req, res) => {
  if (typeof req.body.name !== "string" || !req.body.name.trim()) throw new AppError("Category name is required.", 400);
  const [result] = await pool.execute("UPDATE categories SET name = ?, description = ? WHERE id = ?", [
    req.body.name.trim(), req.body.description || null, req.params.id
  ]);
  if (!result.affectedRows) throw new AppError("Category not found.", 404);
  res.json({ message: "Category updated." });
}));

router.delete("/categories/:id", authorize("admin"), asyncHandler(async (req, res) => {
  const [result] = await pool.execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError("Category not found.", 404);
  res.json({ message: "Category deleted. Books in this category remain uncategorized." });
}));

router.get("/authors", asyncHandler(async (req, res) => {
  const term = req.query.search ? `%${String(req.query.search).trim()}%` : null;
  const [rows] = await pool.execute(
    `SELECT a.id, a.name, a.bio, COUNT(DISTINCT ba.book_id) AS book_count,
            string_agg(DISTINCT b.title, ', ' ORDER BY b.title) AS books
     FROM authors a LEFT JOIN book_authors ba ON ba.author_id = a.id
     LEFT JOIN books b ON b.id = ba.book_id
     WHERE CAST(? AS text) IS NULL OR a.name ILIKE ?
     GROUP BY a.id ORDER BY a.name`,
    [term, term]
  );
  res.json(rows);
}));

router.post("/authors", staff, asyncHandler(async (req, res) => {
  if (typeof req.body.name !== "string" || !req.body.name.trim()) throw new AppError("Author name is required.", 400);
  const [result] = await pool.execute("INSERT INTO authors (name, bio) VALUES (?, ?) RETURNING id", [
    req.body.name.trim(), req.body.bio || null
  ]);
  res.status(201).json({ id: result.insertId, message: "Author created." });
}));

router.put("/authors/:id", staff, asyncHandler(async (req, res) => {
  if (typeof req.body.name !== "string" || !req.body.name.trim()) throw new AppError("Author name is required.", 400);
  const [result] = await pool.execute("UPDATE authors SET name = ?, bio = ? WHERE id = ?", [
    req.body.name.trim(), req.body.bio || null, req.params.id
  ]);
  if (!result.affectedRows) throw new AppError("Author not found.", 404);
  res.json({ message: "Author updated." });
}));

router.delete("/authors/:id", authorize("admin"), asyncHandler(async (req, res) => {
  const [used] = await pool.execute("SELECT COUNT(*) AS count FROM book_authors WHERE author_id = ?", [req.params.id]);
  if (Number(used[0].count)) throw new AppError("Remove this author from their books before deleting them.", 409);
  const [result] = await pool.execute("DELETE FROM authors WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError("Author not found.", 404);
  res.json({ message: "Author deleted." });
}));

module.exports = router;
