# Advanced Library Management System

A full-stack campus library application built with React, Vite, Express, and Supabase PostgreSQL. The web client uses a responsive light/dark design system; the API connects to Supabase PostgreSQL and protects staff actions with JWT role checks.

## Features

- Admin, librarian, and student sign-in; public student registration; profile updates; and password reset with optional SMTP delivery.
- Dashboard statistics, circulation charts, collection categories, popular titles, student activity, and overdue follow-up queried from PostgreSQL.
- Searchable book catalog with ISBN uniqueness, cover uploads, categories, authors, copy counts, pagination, and role-aware editing.
- Student directory with account deactivation and borrowing history.
- Transaction-safe book checkouts and returns, configurable borrowing limits and overdue fines, a reservation queue, payment records, and in-app notifications.
- Date-filtered borrowing, overdue, category, and payment reports with CSV export.
- Responsive sidebar navigation, mobile layout, toast feedback, empty/loading states, and a persisted dark theme.

## Requirements

- Node.js 20.19+ or 22.12+ (Node 24 is also supported).
- A Supabase project with PostgreSQL (the schema uses identity columns, check constraints, and a GIN search index).
- npm.

## Run locally (Windows PowerShell)

1. Create a Supabase project and retrieve its PostgreSQL connection string from **Project Settings > Database**. Use the session pooler connection string for hosted/backend deployments.
2. Copy the backend environment template and configure its Supabase connection:

   ```powershell
   Copy-Item .\backend\.env.example .\backend\.env
   ```

   Set `DATABASE_URL` to the Supabase PostgreSQL connection string, keep `DATABASE_SSL=true`, and replace `JWT_SECRET` with a random value of at least 32 characters. Set unique `SEED_*_PASSWORD` values of at least 12 characters for demo accounts.
3. Install dependencies from the repository root:

   ```powershell
   npm.cmd install
   ```
4. Create the PostgreSQL schema, sample books, and demo accounts:

   ```powershell
   npm.cmd run db:setup
   ```
5. Start the API and Vite development server:

   ```powershell
   npm.cmd run dev
   ```

   The frontend is at `http://localhost:5173`; the API health check is at `http://localhost:4000/api/health`.

The API reads `backend/.env`; Vite can optionally read `frontend/.env` with `VITE_API_URL=http://localhost:4000/api`. The API allows requests only from `CLIENT_URL`.

## Demo accounts

The setup script creates accounts using the configured `SEED_*` environment values:

| Role | Default email |
| --- | --- |
| Admin | `admin@library.local` |
| Librarian | `librarian@library.local` |
| Student | `student@library.local` |

The setup script uses the passwords configured in `backend/.env`; no demo passwords are included in the repository. Seeded sample books and borrowing activity are repeatable. Existing account passwords are not overwritten on subsequent database setup runs.

## Database scripts

- `backend/database/schema.sql` creates the normalized schema, keys, constraints, and indexes.
- `backend/database/seed.sql` inserts repeatable sample categories, authors, books, student lending, reservations, fines, payments, and notifications. Demo users are created first by `npm.cmd run db:setup` using bcrypt-hashed passwords configured in `backend/.env`.
- `npm.cmd run db:setup` applies both SQL scripts and securely hashes configured seed passwords.

The database user must have permission to create tables and indexes in the selected database schema. The scripts use `IF NOT EXISTS` and `ON CONFLICT` to preserve existing records and can be rerun. The backend connects directly to PostgreSQL using `DATABASE_URL`; Supabase URL/API keys and the service-role key are not used by this server connection and should not be exposed in the browser. If your environment does not trust the Supabase database certificate, download the project's CA certificate from **Database Settings > SSL Configuration** and set `DATABASE_SSL_CA_PATH` to its path relative to `backend/`; certificate verification remains enabled.

## Configuration

Copy `backend/.env.example` to `backend/.env`. Key settings:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Signed API session configuration |
| `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_SSL_CA_PATH` | Supabase PostgreSQL transaction-pooler connection and verified TLS |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Optional project metadata for Supabase integrations |
| `FINE_PER_DAY` | Fine assessed for each overdue day |
| `MAX_BORROWED_BOOKS` | Maximum active loans per student |
| `RESERVATION_EXPIRY_DAYS` | Collection window for a ready reservation |
| `SMTP_*` | Optional password-reset email delivery |
| `SEED_*` | Local demo account emails and initial passwords |

Without SMTP, forgot-password returns a development-only reset token while `NODE_ENV` is not `production`. In production, configure SMTP so reset instructions can be delivered; the API response does not reveal whether an account exists.

Book covers accept JPG, PNG, and WebP files up to 5 MB and are stored locally under `backend/uploads`. For a multi-instance deployment, replace local disk storage with shared object storage.

## Tests and production build

```powershell
npm.cmd test
npm.cmd run build
```

The backend tests cover API health and identifier generation. The database-dependent workflows require a Supabase PostgreSQL project and are best verified using the demo accounts.

## API overview

All API routes are under `/api`. Authenticated requests use `Authorization: Bearer <token>`.

| Area | Routes |
| --- | --- |
| Authentication | `/auth/login`, `/auth/register`, `/auth/me`, `/auth/profile`, `/auth/forgot-password`, `/auth/reset-password` |
| Catalog | `/books`, `/books/:id`, `/directory/categories`, `/directory/authors` |
| Students | `/students`, `/students/:id/history` |
| Lending | `/issues`, `/issues/:id/return`, `/reservations` |
| Fines | `/fines`, `/fines/:id/payments`, `/payments` |
| Operations | `/dashboard`, `/notifications`, `/reports` |

## Implementation notes

- Admins can manage all modules. Librarians can manage catalog and circulation but cannot delete books, students, categories, or authors. Students only see their own account, loans, reservations, fines, and notifications.
- Loan creation and returns lock database rows and update the loan and available-copy count in a single transaction.
- A background maintenance task marks overdue loans, accrues fines, expires ready reservations, and creates student notifications.
- Fine payments are manual records only; no external payment gateway is connected.
- Email is optional; in-app notifications are stored in PostgreSQL.
