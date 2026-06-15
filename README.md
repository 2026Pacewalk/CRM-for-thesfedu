# theSFedu CRM — Immigration & Consultancy CRM

Foundation build (v0.1) of the multi-branch immigration & education consultancy CRM
described in `CRM_Blueprint_v1.0`. This release implements the **Lead Management core**
plus the organization, authentication, and role-based access control (RBAC) backbone
that the rest of the system builds on.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma ORM** — SQLite for local dev (zero setup); PostgreSQL-ready for production
- Lightweight **JWT cookie** authentication with role-based access control

## Modules implemented

- **Auth, RBAC & security** — login, session, route protection; 14 roles (Section 1.2)
  with lead-visibility scopes (own / team / branch / partner / all). **TOTP two-factor
  auth** (authenticator app, with QR setup), **password policy**, **change password**,
  and optional **admin IP allowlisting** (Section 7.7 / 7.11).
- **Lead management** (Section 2) — all blueprint fields, lead sources, multi-select
  services, vertical, branch, dual-counselor assignment, real-time duplicate
  detection (7.2), enforced status workflow with mandatory reasons (2.5), and
  interaction logging (7.1).
- **Bulk lead import** (Section 7.6) — paste CSV, validation, dedup, import summary.
- **Enrollment, packages & payments** (Section 3.2–3.3) — enroll onto priced service
  packages with tax/discount, record payments, auto payment-status, enrolled-students
  list, **online payment links via Razorpay** (simulation-mode until keys are set,
  with webhook settlement), and **printable PDF receipts**.
- **Backend country pipeline** (Section 4) — per-country applications, ST-1→ST-7 stage
  workflow with stage-specific fields, team assignment (backend/admissions/filling),
  pipeline progress, and visa outcome that flows back to the lead status.
- **Document management** (Section 4.5 / 7.5) — versioned uploads against leads and
  applications, type checklist, 20 MB limit, authenticated downloads.
- **B2B partners** (Section 5) — partner CRUD, assigned BDM, assessment log, and
  commission tracking (owed/paid).
- **Admin & configuration** (Section 7.7–7.8) — user management, branches, service
  packages, institutions, and a read-only audit-log viewer.
- **Communications & integrations** (Section 7.10) — WhatsApp Business API, email
  (SMTP), and SMS, with admin-managed message templates, per-lead send panel,
  message logging against the lead profile, and auto-sends on enrollment & visa
  outcome. Runs in **simulation mode** until provider credentials are added (see
  `.env`), then sends live with no code change.
- **Tasks** (7.3), **notifications** (7.4, with header bell), **dashboard** (7.9), and
  **reports** (Section 6 — funnel, sources, services, status, pipeline, revenue), with
  **CSV exports** (Excel-compatible) and **scheduled email digests** (daily/weekly,
  delivered via a cron endpoint — Section 6.7).
- **Audit log** of key actions across all modules (Section 7.7).

## Getting started

```bash
npm install
npm run setup     # prisma generate + create SQLite DB + seed demo data
npm run dev       # http://localhost:3000
```

### Demo logins (password for all: `Password123!`)

| Email | Role |
|-------|------|
| admin@thesfedu.com | System Administrator |
| vp@thesfedu.com | VP / Management |
| manager@thesfedu.com | Branch Manager |
| reception@thesfedu.com | Reception Staff |
| counselor.direct@thesfedu.com | B2C Counselor (Direct) |
| counselor.career@thesfedu.com | B2C Counselor (Career Desk) |
| backend.canada@thesfedu.com | Backend Country Counselor |
| admissions@thesfedu.com | Admissions Officer |
| filling@thesfedu.com | Filling Team Member |
| bdm@thesfedu.com | Business Development Manager |
| b2b@thesfedu.com | B2B Backend Counselor |

Log in as different roles to see how lead visibility and permissions change.

## Switching to PostgreSQL (production)

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL` in `.env` to your Postgres connection string.
3. Run `npm run db:push` then `npm run db:seed`.

The schema avoids SQLite-only features and native enums, so it ports cleanly.

## Useful scripts

- `npm run dev` — start the dev server
- `npm run db:studio` — open Prisma Studio to browse data
- `npm run db:seed` — re-seed demo data
- `npm run build` — production build

## Remaining / future enhancements

All blueprint modules are implemented, including WhatsApp/email/SMS integrations
(live once credentials are set). Still to come:

1. **Remaining integrations** (Section 7.10) — Google/Outlook calendar sync and
   Facebook/Instagram lead-form ingestion.
2. **Document checklist completion indicators & expiry alerts** (Section 7.5).
3. **Versioned DB migrations** (`prisma migrate`) for production schema changes.
