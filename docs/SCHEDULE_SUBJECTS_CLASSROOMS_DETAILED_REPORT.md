# Schedule + Subjects + Classrooms (Scoped) — Detailed Report

Date: 2026-03-16

## Goals covered

- **Subjects** must be scoped like Groups: **Department (ParentGroup) + Cohort**.
- Schedule sidebar must list **Subjects** similarly (grouped by Department → Cohort).
- Fix UI: schedule **badge width** too small.
- Improve Classrooms UX: group rooms by **floor** (101 → 1-qavat, 410 → 4-qavat; manual rooms go to Other).
- Fix schedule builder glitch: **read-only ↔ edit mode** switch can leave a loading overlay stuck.
- Add **.toml** docs to make schedule structure easy to understand.

## Data model / DB

### Prisma changes

- `Subject` now supports optional relations:
  - `cohortId` → `Cohort` (onDelete: SetNull)
  - `parentGroupId` → `ParentGroup` (department) (onDelete: SetNull)
- Reverse relations added:
  - `Cohort.subjects`
  - `ParentGroup.subjects`
- Indexes added on both foreign keys.

### Migration

- Migration created/applied:
  - `backend/prisma/migrations/20260316061409_subject_cohort_parentgroup/`

## Backend API (admin)

- Admin Subjects endpoints now accept/return `cohortId` + `parentGroupId`.
- `list()` / `getById()` include `cohort` and `parentGroup` so UI can render labels without extra lookups.

## Admin UI

### Subjects CRUD

- Create / Edit pages now require selecting:
  - **Department** (ParentGroup)
  - **Cohort**
- Subject detail shows Department + Cohort badges.
- Subjects list view is refactored to a **Department → Cohort** tree for readability.

### Schedule builder

- Sidebar **Subjects** are now shown as a **Department → Cohort** collapsible tree, and each subject is draggable.
- Sidebar **Classrooms** are now shown as a **Floor → Rooms** collapsible tree:
  - Floor derived from a 3-digit number in the room name (e.g. 101 → floor 1)
  - Rooms without a 3-digit number stay under **Other**
- Department grid badge width fix:
  - badge no longer artificially constrained; can expand to available space.

### Loading overlay glitch

- When switching routes/search params or toggling read-only/edit, the schedule builder now auto-clears `pageBusy` so the overlay doesn’t remain stuck after navigation.

## TOML documentation

- Added schedule structure reference:
  - `config/schedule.structure.toml`

This file documents:

- Fixed department row order
- Cohort list + year display intent (`23 (2023)`)
- Department-specific group lists
- Room floor grouping rule

## Verification

- Backend: `npm run build` (TypeScript compile) succeeded.
- Admin: `npm run build` succeeded.
  - Noted ESLint warnings in `admin/components/grades/GradesTabEditView.tsx` (pre-existing / unrelated).

## Notes / Follow-ups

- If you want the app to _enforce_ schedule rules (e.g. “IT groups only in IT row”) at drag/drop time, we can codify `config/schedule.structure.toml` into runtime validation next.
- If you want Subjects to be **strictly non-null** for cohort/department at DB level, we can follow up with a data backfill + migration to make both fields required.
