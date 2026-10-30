const fs = require("node:fs/promises");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");
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

  try {
    const schema = await fs.readFile(path.join(__dirname, "..", "database", "schema.sql"), "utf8");
    const seed = await fs.readFile(path.join(__dirname, "..", "database", "seed.sql"), "utf8");
    await pool.query(schema);
    const accounts = [
      { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD, role: "admin", name: "Library Administrator" },
      { email: env.SEED_LIBRARIAN_EMAIL, password: env.SEED_LIBRARIAN_PASSWORD, role: "librarian", name: "Library Librarian" },
      { email: env.SEED_STUDENT_EMAIL, password: env.SEED_STUDENT_PASSWORD, role: "student", name: "Alex Morgan" }
    ];
    for (const account of accounts) {
      const passwordHash = await bcrypt.hash(account.password, 12);
      await pool.execute(
        `INSERT INTO users (email, password_hash, role, full_name)
         VALUES (?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`,
        [account.email, passwordHash, account.role, account.name]
      );
    }
    const seedStudentEmail = env.SEED_STUDENT_EMAIL.replaceAll("'", "''");
    await pool.query(seed.replaceAll("'student@library.local'", `'${seedStudentEmail}'`));
    console.log(`Database initialized. Admin: ${env.SEED_ADMIN_EMAIL}; librarian: ${env.SEED_LIBRARIAN_EMAIL}; student: ${env.SEED_STUDENT_EMAIL}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Database setup failed:", error.message);
  process.exit(1);
});
