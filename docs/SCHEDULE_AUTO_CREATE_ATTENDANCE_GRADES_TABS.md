# Schedule → Attendance/Grades Sheets auto-create (and auto-extend)

## Goal

Previously, admins had to manually create Google Sheets “Attendance/Grades tabs” by selecting:

- Group
- Subject
- Dates
- Assignment count (HW columns for Grades)

You requested this to become automatic:

- When a lesson is added to the schedule, the corresponding Attendance sheet tab is created (if missing) and the date column is added.
- When more lessons are added later, Attendance gets new date columns and Grades gets new HW columns (one per lesson).

## Key architectural detail (why the trigger is on `Schedule`, not `Lesson`)

In this codebase, the **Monthly Schedule Builder** writes to the `Schedule` table (not directly to `Lesson`).

Also, the Google Sheets “tabs” are managed via **Sheets sync services**:

- `AttendanceSheetsSyncService.ensureTabAndDates()`
  - Creates the Attendance tab `GROUPNAME_SUBJECTNAME` if missing
  - Ensures the header row has date columns for the provided dates
  - If `assignmentCount` is provided, it also ensures the Grades tab has `HW1..HWN` columns

Because schedule changes are the source of truth for “new lessons being added”, the correct “trigger point” is:

- `backend/src/services/admin/AdminMonthlyScheduleService.ts`
  - `create()`
  - `update()`
  - `bulkCreate()`

## What changed (implementation)

### 1) Automatic Sheets ensure after schedule changes

File changed:

- `backend/src/services/admin/AdminMonthlyScheduleService.ts`

New behavior:

- After a schedule entry is created/updated/bulk-created, the service **fires an async “auto ensure”** that calls:
  - `AttendanceSheetsSyncService.ensureTabAndDates({ groupId, subjectId, dates, assignmentCount })`

This makes schedule CRUD automatically:

- Create the Attendance tab (if missing)
- Add the date column for the schedule day
- Ensure Grades tab exists and has enough `HW` columns

### 2) Assignment count is derived from schedule (monotonic)

Grades sheet HW columns require a positive integer `assignmentCount`.

To match your “1 new column per new lesson” requirement, we derive:

- `computed = number of distinct scheduled days for (groupId, subjectId)`
- `existing = GradeBook.assignmentCount (if already present)`
- `desired = max(existing, computed, 1)`

Important design choices:

- **Monotonic**: we never auto-decrease `assignmentCount`. This avoids surprising teachers by changing headers.
- **Cap at 200**: `GradesSheetsSyncService` enforces a max of 200 HW columns.

### 3) Non-fatal + non-blocking by design

Sheets integrations can be disabled or misconfigured in some environments.

So the schedule CRUD flow:

- Does **not fail** if Sheets is disabled/missing credentials
- Does **not block** the HTTP response waiting for Google API calls

Implementation detail:

- The code uses a fire-and-forget async call; all errors are swallowed intentionally.

## Behavior notes / limitations

### Column removal on schedule delete

Your original idea includes removing columns when a lesson is deleted.

Current implementation is **append-only** for Sheets columns:

- We add missing date/HW columns when needed.
- We do **not** delete sheet columns when schedule entries are removed.

Reason:

- `AttendanceSheetsSyncService.ensureTabAndDates()` is designed to _ensure_ columns exist; it does not implement safe column deletion.
- Deleting sheet columns is risky because it can destroy manually-entered data.

If you want “strict removal”, we can implement an explicit admin-only cleanup tool later (with safeguards), but it should not run automatically.

### Multiple lessons on the same day

Attendance date columns are keyed by day. If you schedule multiple entries on the same date for the same group+subject, Sheets still maps to a single date column.

## How to verify

1. Ensure env/config for Sheets is enabled (in `backend/src/config/env` via `.env`):
   - `ATTENDANCE_SHEETS_ENABLED=true`
   - `ATTENDANCE_SHEETS_SPREADSHEET_ID=...`
   - `GRADES_SHEETS_ENABLED=true`
   - `GRADES_SHEETS_SPREADSHEET_ID=...`
   - Google service account credentials (`GOOGLE_SHEETS_CLIENT_EMAIL`, private key, etc.)

2. Use the Monthly Schedule Builder to create schedule entries.

3. Confirm in Google Sheets:
   - A tab named `GROUPNAME_SUBJECTNAME` appears in Attendance spreadsheet
   - Date columns appear for the scheduled days
   - In Grades spreadsheet, a tab with the same title exists and has `HW1..HWN` headers, where $N$ grows as more lessons are scheduled.

## Files changed

- `backend/src/services/admin/AdminMonthlyScheduleService.ts`

## Why this matches the request

- “Schedule tuzsam avtomatik create bo’lsin” → The schedule CRUD now triggers tab creation.
- “Yangi lesson qo‘shilganda bittadan column qo‘shilsin” → New schedule days cause new date columns; grades HW columns grow with the count of scheduled days.
- “Ohirida .MD faylida tushuntir” → This document.
