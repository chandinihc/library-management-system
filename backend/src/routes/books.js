const { Router } = require("express");
const multer = require("multer");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const pool = require("../config/database");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { AppError } = require("../utils/errors");
const { makeId } = require("../utils/identifiers");

const router = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "..", "..", "uploads"),
    filename: (_req, file, done) => {
      done(null, `${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, done) => {
    const supported = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp"
    };
    if (supported[path.extname(file.originalname).toLowerCase()] !== file.mimetype) {
      return done(new AppError("Cover images must be JPG, PNG, or WebP.", 400));
    }
    return done(null, true);
  }
});

async function validateCover(req, _res, next) {
  if (!req.file) return next();
  let file;
  try {
    file = await fs.open(req.file.path, "r");
    const header = Buffer.alloc(12);
    await file.read(header, 0, header.length, 0);
    await file.close();
    file = null;
    const extension = path.extname(req.file.originalname).toLowerCase();
    const valid = extension === ".png"
      ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === ".webp"
        ? header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP"
        : header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (!valid) {
      await fs.unlink(req.file.path);
      return next(new AppError("The uploaded file is not a valid image of the selected type.", 400));
    }
    return next();
  } catch (error) {
    if (file) await file.close();
    await fs.unlink(req.file.path).catch(() => {});
    return next(error);
  }
}

function parseAuthors(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return value.split(",").map(Number);
    }
  }
  return [];
}

function parseBook(body, file, previous = {}) {
  const get = (key) => body[key] !== undefined ? body[key] : previous[key];
  const title = get("title");
  const isbn = get("isbn");
  const totalCopies = Number(get("total_copies"));
  const authors = parseAuthors(body.author_ids ?? body.authors);
  if (typeof title !== "string" || title.trim().length < 2) throw new AppError("Book title is required.", 400);
  if (typeof isbn !== "string" || !isbn.trim()) throw new AppError("ISBN is required.", 400);
  if (!Number.isInteger(totalCopies) || totalCopies < 1) throw new AppError("Total copies must be a positive whole number.", 400);
  if (authors.some((authorId) => !Number.isInteger(authorId) || authorId < 1) ||
      new Set(authors).size !== authors.length) {
    throw new AppError("Select valid, unique authors.", 400);
  }
  const rawCategoryId = get("category_id");
  const categoryId = rawCategoryId ? Number(rawCategoryId) : null;
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) {
    throw new AppError("Select a valid category.", 400);
  }
  const rawYear = get("publication_year");
  const publicationYear = rawYear ? Number(rawYear) : null;
  if (publicationYear !== null && (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > 2200)) {
    throw new AppError("Enter a valid publication year.", 400);
  }
  if (previous.available_copies !== undefined && totalCopies < Number(previous.total_copies) - (Number(previous.available_copies))) {
    throw new AppError("Total copies cannot be lower than the number of copies currently on loan.", 409);
  }
  return {
    title: title.trim(),
    isbn: isbn.trim(),
    categoryId,
    publisher: get("publisher") || null,
    publicationYear,
    edition: get("edition") || null,
    description: get("description") || null,
    totalCopies,
    availableCopies: previous.available_copies === undefined
      ? totalCopies
      : totalCopies - (Number(previous.total_copies) - Number(previous.available_copies)),
    coverImage: file ? `/uploads/${file.filename}` : (body.remove_cover === "true" ? null : (previous.cover_image || null)),
    authors
  };
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  if (req.query.search) {
    const term = `%${String(req.query.search).trim()}%`;
    conditions.push("(b.title LIKE ? OR b.isbn LIKE ? OR b.publisher LIKE ? OR EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id AND a.name LIKE ?))");
    params.push(term, term, term, term);
  }
  if (req.query.category_id) {
    conditions.push("b.category_id = ?");
    params.push(Number(req.query.category_id));
  }
  if (req.query.availability === "available") conditions.push("GREATEST(b.available_copies - (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready' AND r.expires_at > UTC_TIMESTAMP()), 0) > 0");
  if (req.query.availability === "unavailable") conditions.push("GREATEST(b.available_copies - (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready' AND r.expires_at > UTC_TIMESTAMP()), 0) = 0");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM books b ${where}`, params);
  const [rows] = await pool.execute(
    `SELECT b.id, b.book_code, b.isbn, b.title, b.category_id, c.name AS category,
            b.publisher, b.publication_year, b.edition, b.description, b.cover_image,
            b.total_copies,
            GREATEST(b.available_copies - (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready' AND r.expires_at > UTC_TIMESTAMP()), 0) AS available_copies,
            b.created_at,
            GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS authors
     FROM books b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN book_authors ba ON ba.book_id = b.id
     LEFT JOIN authors a ON a.id = ba.author_id
     ${where}
     GROUP BY b.id
     ORDER BY b.title
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  res.json({ items: rows, page, limit, total: countRows[0].total });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT b.*, c.name AS category,
            GREATEST(b.available_copies - (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready' AND r.expires_at > UTC_TIMESTAMP()), 0) AS free_copies
     FROM books b
     LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = ?`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError("Book not found.", 404);
  const book = rows[0];
  book.available_copies = book.free_copies;
  delete book.free_copies;
  const [authors] = await pool.execute(
    "SELECT a.id, a.name FROM authors a JOIN book_authors ba ON ba.author_id = a.id WHERE ba.book_id = ? ORDER BY a.name",
    [req.params.id]
  );
  book.authors = authors;
  res.json(book);
}));

router.post("/", authenticate, authorize("admin", "librarian"), upload.single("cover"), validateCover, asyncHandler(async (req, res) => {
  const book = parseBook(req.body, req.file);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO books (book_code, isbn, title, category_id, publisher, publication_year,
       edition, description, cover_image, total_copies, available_copies)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [makeId("BK"), book.isbn, book.title, book.categoryId, book.publisher, book.publicationYear,
        book.edition, book.description, book.coverImage, book.totalCopies, book.availableCopies]
    );
    for (const authorId of book.authors) {
      await connection.execute("INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)", [result.insertId, authorId]);
    }
    await connection.commit();
    res.status(201).json({ id: result.insertId, message: "Book added successfully." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.put("/:id", authenticate, authorize("admin", "librarian"), upload.single("cover"), validateCover, asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute("SELECT * FROM books WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!existingRows[0]) throw new AppError("Book not found.", 404);
    const book = parseBook(req.body, req.file, existingRows[0]);
    await connection.execute(
      `UPDATE books SET isbn = ?, title = ?, category_id = ?, publisher = ?, publication_year = ?,
       edition = ?, description = ?, cover_image = ?, total_copies = ?, available_copies = ? WHERE id = ?`,
      [book.isbn, book.title, book.categoryId, book.publisher, book.publicationYear, book.edition,
        book.description, book.coverImage, book.totalCopies, book.availableCopies, req.params.id]
    );
    await connection.execute("DELETE FROM book_authors WHERE book_id = ?", [req.params.id]);
    for (const authorId of book.authors) {
      await connection.execute("INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)", [req.params.id, authorId]);
    }
    await connection.commit();
    res.json({ message: "Book updated successfully." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.delete("/:id", authenticate, authorize("admin"), asyncHandler(async (req, res) => {
  const [usage] = await pool.execute(
    `SELECT
      (SELECT COUNT(*) FROM book_issues WHERE book_id = ?) +
      (SELECT COUNT(*) FROM reservations WHERE book_id = ?) AS count`,
    [req.params.id, req.params.id]
  );
  if (Number(usage[0].count)) throw new AppError("This book has circulation history or reservations and cannot be deleted.", 409);
  const [result] = await pool.execute("DELETE FROM books WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError("Book not found.", 404);
  res.json({ message: "Book deleted successfully." });
}));

module.exports = router;
