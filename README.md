# Advanced Library Management System

A full-stack campus library application built with React, Vite, Express, and MySQL. The web client uses a responsive light/dark design system; the API stores all operational data in MySQL and protects staff actions with JWT role checks.

## Features

- Admin, librarian, and student sign-in; public student registration; profile updates; and password reset with optional SMTP delivery.
- Dashboard statistics, circulation charts, collection categories, popular titles, student activity, and overdue follow-up queried from MySQL.
- Searchable book catalog with ISBN uniqueness, cover uploads, categories, authors, copy counts, pagination, and role-aware editing.
- Student directory with account deactivation and borrowing history.
- Transaction-safe book checkouts and returns, configurable borrowing limits and overdue fines, a reservation queue, payment records, and in-app notifications.
- Date-filtered borrowing, overdue, category, and payment reports with CSV export.
- Responsive sidebar navigation, mobile layout, toast feedback, empty/loading states, and a persisted dark theme.

## Requirements

- Node.js 20.19+ or 22.12+ (Node 24 is also supported).
- MySQL 8.0+ (the schema uses enforced check constraints and full-text indexes).
- npm.

## Run locally (Windows PowerShell)

1. Start MySQL and create or choose a local MySQL account that can create a database and tables.
2. Copy the backend environment template and edit its database settings:

   ```powershell
   Copy-Item .\backend\.env.example .\backend\.env
   ```

   Set `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD`. Replace `JWT_SECRET` with a random value of at least 32 characters, and set unique `SEED_*_PASSWORD` values of at least 12 characters for the local demo accounts.
3. Install dependencies from the repository root:

   ```powershell
   npm.cmd install
   ```
4. Create the MySQL schema, sample books, and demo accounts:

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
- `backend/database/seed.sql` inserts initial categories, authors, books, and repeatable sample lending records.
- `npm.cmd run db:setup` applies both SQL scripts and securely hashes configured seed passwords.

The setup account needs database-creation permissions because the schema creates `library_management` when absent. Existing records are preserved; the scripts are safe to rerun for demo setup.

## Configuration

Copy `backend/.env.example` to `backend/.env`. Key settings:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Signed API session configuration |
| `DB_*` | MySQL connection settings |
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

The backend tests cover API health and identifier generation. The database-dependent workflows require a running MySQL server and are best verified against a disposable local database using the demo accounts.

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
- Email is optional; in-app notifications are stored in MySQL.
