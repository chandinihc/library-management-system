const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1).default("library_management"),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  FINE_PER_DAY: z.coerce.number().nonnegative().default(2),
  MAX_BORROWED_BOOKS: z.coerce.number().int().positive().default(5),
  RESERVATION_EXPIRY_DAYS: z.coerce.number().int().positive().default(2),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.string().optional().default("false"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default("Library Management <no-reply@example.com>"),
  SEED_ADMIN_EMAIL: z.string().email().default("admin@library.local"),
  SEED_ADMIN_PASSWORD: z.string().default(""),
  SEED_LIBRARIAN_EMAIL: z.string().email().default("librarian@library.local"),
  SEED_LIBRARIAN_PASSWORD: z.string().default(""),
  SEED_STUDENT_EMAIL: z.string().email().default("student@library.local"),
  SEED_STUDENT_PASSWORD: z.string().default("")
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment configuration:", result.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = result.data;
