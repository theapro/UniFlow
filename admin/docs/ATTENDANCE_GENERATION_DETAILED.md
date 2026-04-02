# Attendance (DB-first) — Generation & Editing (Detailed)

This document describes how UniFlow generates and edits Attendance in a **100% DB-first** approach.

## Goals

- **Source of truth = DB**: Attendance/Grades are edited and stored in PostgreSQL via Prisma models.
- **Sheets is optional**: Google Sheets exists only as an optional helper/sync tool (not the primary editor).
- **Minimal, fast UI**: Admin UI uses a matrix/table editor (student rows × lesson-day columns) with dropdown statuses.

## Data model (DB)

Attendance is stored using these key tables (Prisma models):

- `Student` — student identity (`id`, `fullName`, `studentNumber`, ...)
- `Group` — group/cohort container
- `StudentGroup` — membership of students in groups
  - A membership is considered **active** if `leftAt` is `NULL` **or** in the future.
- `Subject` — subject reference
- `ScheduleEntry` — weekly schedule definition
  - fields: `groupId`, `subjectId`, `weekday`, `timeSlotId`, `teacherId`, `effectiveFrom`, `effectiveTo`
- `Lesson` — concrete instance of a lesson on a calendar date/time
  - fields: `groupId`, `subjectId`, `teacherId`, `startsAt`, `endsAt`, `room`
- `Attendance` — the mark for a student for a lesson
  - unique: `(lessonId, studentId)`
  - status: `PRESENT | ABSENT | LATE | EXCUSED`

## How the Attendance table (matrix) is generated

The Attendance editor needs to show:

- Rows: all students currently in a given `groupId`
- Columns: lesson days for the selected date range (`from`..`to`) for a given `subjectId`

### Step 1 — Validate inputs

The backend requires:

- `groupId` and `subjectId`
- `from` and `to` as `YYYY-MM-DD`
- `to >= from`

### Step 2 — Resolve roster (students)

Roster query is DB-first:

- Find students where `StudentGroup.some({ groupId, leftAt: NULL OR leftAt > now })`
- Sort by `studentNumber`, then `fullName`

This guarantees the table shows **all users/students in the group** according to DB memberships.

### Step 3 — Generate lesson-day columns from DB schedule (not Sheets)

Columns are generated using `ScheduleEntry`:

- Load all `ScheduleEntry` rows for `{ groupId, subjectId }`.
- For every date `d` from `from` to `to`:
  - Compute weekday of `d` (UTC-based)
  - Date is included as a column if **any** schedule entry matches:
    - `weekday == weekday(d)`
    - and `effectiveFrom/effectiveTo` (if provided) cover date `d`

A safety cap of **62 columns** is applied to prevent huge tables.

### Why this is the correct source of truth

- The website schedule (DB) defines **when lessons should happen**.
- Lessons/attendance may not yet exist in DB for a future date; we still must show the date column so teachers/admin can fill it.

## How cell values are computed

For each included date column:

1. Try to find a `Lesson` for `{ groupId, subjectId }` on that day.
2. If lesson exists:
   - Read `Attendance` rows for that `lessonId`
   - For each student, set status for the cell
3. If lesson does not exist yet:
   - Cell is `null` (UI shows `-`)

## How saving works (editing)

When a user selects a dropdown value:

- UI sends records like `{ studentId, date, status }`
  - status can be short form: `P/A/L/E`

Backend save behavior:

1. Validate student belongs to group (active membership)
2. For each date:
   - Ensure a `Lesson` exists for `{ groupId, subjectId, date }`
   - If missing, create it using:
     - teacher from `ScheduleEntry` for that weekday if available
     - fallback teacher from subject-teacher mapping
     - fallback start/end time (09:00–10:00 UTC) if schedule time not available
3. Upsert `Attendance` by unique key `(lessonId, studentId)`

## Status mapping

UI short forms map to DB enum:

- `P` → `PRESENT`
- `A` → `ABSENT`
- `L` → `LATE`
- `E` → `EXCUSED`

## Cohort constraints

If a `cohortId` is provided:

- Backend asserts `group.cohortId === cohortId`
- Otherwise request fails with `COHORT_MISMATCH`

## Notes / operational guidance

- If columns appear empty, confirm `ScheduleEntry` exists for the selected group+subject.
- If students are missing from roster, confirm `StudentGroup.leftAt` is `NULL` or in the future.
- If saving fails with missing teacher, ensure subject has a linked teacher or schedule entries include `teacherId`.
