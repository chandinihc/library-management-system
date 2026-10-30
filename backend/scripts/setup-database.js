require("dotenv").config();
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const env = require("../src/config/env");

async function run() {
  const seedPasswords = [
    ["SEED_ADMIN_PASSWORD", env.SEED_ADMIN_PASSWORD],
    ["SEED_LIBRARIAN_PASSWORD", env.SEED_LIBRARIAN_PASSWORD],
    ["SEED_STUDENT_PASSWORD", env.SEED_STUDENT_PASSWORD]
  ];
  const missingPasswords = seedPasswords
    .filter(([, password]) => password.length < 12)
    .map(([name]) => name);
  if (missingPasswords.length) {
    throw new Error(`Set unique seed passwords of at least 12 characters in backend/.env: ${missingPasswords.join(", ")}`);
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true
  });
  try {
    const schema = await fs.readFile(path.join(__dirname, "..", "database", "schema.sql"), "utf8");
    const seed = await fs.readFile(path.join(__dirname, "..", "database", "seed.sql"), "utf8");
    await connection.query(schema);
    const accounts = [
      { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD, role: "admin", name: "Library Administrator" },
      { email: env.SEED_LIBRARIAN_EMAIL, password: env.SEED_LIBRARIAN_PASSWORD, role: "librarian", name: "Library Librarian" },
      { email: env.SEED_STUDENT_EMAIL, password: env.SEED_STUDENT_PASSWORD, role: "student", name: "Alex Morgan" }
    ];
    for (const account of accounts) {
      const passwordHash = await bcrypt.hash(account.password, 12);
      await connection.execute(
        `INSERT INTO library_management.users (email, password_hash, role, full_name)
         VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [account.email, passwordHash, account.role, account.name]
      );
    }
    await connection.query(seed.replaceAll("student@library.local", env.SEED_STUDENT_EMAIL));
    console.log(`Database initialized. Admin: ${env.SEED_ADMIN_EMAIL}; librarian: ${env.SEED_LIBRARIAN_EMAIL}; student: ${env.SEED_STUDENT_EMAIL}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Database setup failed:", error.message);
  process.exit(1);
});
