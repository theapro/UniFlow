# UniFlow – Implementation Report

This report summarizes the completed production-grade refactor/fixes requested after the "System Logic" changes.

## 1) Google Sheets: Admin-configurable Spreadsheet IDs

### What changed

- Spreadsheet IDs are no longer env-only. They can be stored in DB (singleton settings) and overridden from the Admin panel.
- Backend uses a consistent "effective spreadsheet id" strategy:
  - **DB value (if present)** → otherwise **ENV fallback** (backward compatible).
- Health endpoints now return clearer, admin-friendly Google Sheets connection errors (wrong ID / not shared / permission / rate-limit).

### Backend

- Added DB model: `SheetsSettings` (singleton) storing spreadsheet IDs for:
  - Students
  - Teachers
  - Attendance
  - Grades
- Added settings service + masking helper + friendly error formatter.
- Refactored Sheets controllers/services/workers to accept an optional `spreadsheetId` override and to resolve effective IDs via settings.

### API endpoints (Admin)

- `PATCH /admin/students-sheets/config` → `{ spreadsheetId }`
- `PATCH /admin/teachers-sheets/config` → `{ spreadsheetId }`
- `PATCH /admin/attendance-sheets/config` → `{ spreadsheetId }`
- `PATCH /admin/grades-sheets/config` → `{ spreadsheetId }`

### Admin UI

- All Sheets pages now include:
  - **Spreadsheet ID** input
  - **Connect** button (calls the PATCH endpoint)
  - Query invalidation so Health/Status refresh immediately

## 2) Students/Teachers/Attendance/Grades Sheets: Consistency fixes

### Highlights

- Students Sheets conflict resolution was fixed to work correctly with DB-configured spreadsheet IDs:
  - Conflicts are resolved using the conflict’s stored `spreadsheetId` (no env-only mismatch).
- Attendance/Grades workflows were updated end-to-end (controllers + sync services + worker where applicable) so that:
  - operations run against the configured sheet
  - internal cross-sheet dependencies (e.g., reading roster for grades) use the effective Students sheet ID

## 3) Derived relations: Auto-sync after schedule writes

### Goal

Keep derived relations consistent system-wide after schedule edits, specifically:

- Subject ↔ Teacher links
- `Student.teacherIds`

### What changed

- Derived sync now considers **monthly schedule** rows (in addition to weekly schedule entries/lessons).
- Derived sync is triggered automatically after schedule write operations:
  - Monthly schedule create/update/delete/bulk-create
  - Weekly schedule entry create/update/delete

## 4) Seed improvements (fake data)

### What changed

- `backend/prisma/seed.ts` now generates realistic data:
  - Turkish-style names
  - `@apro.edu` emails
  - ~20 Subjects spread across Parent Groups
  - Teachers (with multi-subject assignments)
  - Rooms
  - Students: **10 per Group**

## 5) Required follow-ups to run in your environment

### Prisma migration (SheetsSettings)

A DB migration is required for the new `SheetsSettings` model.

From `backend/`:

1. Set `DATABASE_URL` in your local env (see `backend/.env.example`).
2. Run:
   - `npm install`
   - `npx prisma migrate dev --name sheets_settings`
   - `npx prisma generate`

### Seed

From `backend/`:

- `npx prisma db seed`

### Manual sanity checks

- Admin → each Sheets page:
  - paste Spreadsheet ID → **Connect** → verify **Health** shows OK
- Trigger a sync and confirm:
  - Students/Teachers/Attendance/Grades sync runs against the configured spreadsheet
- Create/update schedule entries and confirm derived relations auto-sync (no manual step required).
