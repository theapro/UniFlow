# UniFlow — Sync & Architecture (Detailed)

This document explains how UniFlow works end-to-end, with a focus on Google Sheets synchronization and the data flow between the Admin UI, the Backend API, the Database, and Sheets.

> Notes
>
> - This doc references environment variable **names** only. Do **not** commit real secrets/keys.
> - All URLs/ports below assume local development defaults.

## 1) Repo layout (high-level)

- `backend/` — Express API + Prisma (PostgreSQL). Owns database, auth, and all sync logic.
- `admin/` — Next.js Admin Dashboard (manages students, groups, teachers, subjects, schedule, attendance, Sheets status).
- `user/` — Next.js User App (end-user portal).
- `sheets-sync/` — additional code (not the primary sync path; the backend owns the runtime sync today).

## 2) Runtime architecture

### Components

- **DB**: PostgreSQL accessed through Prisma (`backend/src/config/prisma.ts`).
- **API**: Express app (`backend/src/app.ts`) mounted at `/api`.
- **Admin UI**: Next.js client calls backend via Axios (`admin/lib/axios.ts`).
- **User UI**: Similar approach in `user/` (not covered deeply here).
- **Google Sheets**: Accessed via service account (Google APIs) from the backend.

### Ports (dev defaults)

- Backend: `http://localhost:3001`
- Admin: Next.js dev server uses an available port (commonly `3000`, but may hop if busy).
- User: Next.js dev server uses an available port.

Important: Next.js will auto-pick a free port (e.g. `3003`, `3004`). The backend CORS is implemented to allow **any** `http://localhost:<port>` in development to prevent “random port” breakages.

## 3) Authentication model

- Backend issues JWT tokens (see `backend/src/routes/auth.routes.ts`).
- Admin UI stores token in `localStorage` and also writes a `token` cookie for Next.js middleware usage.
  - Admin client code: `admin/lib/api.ts` + `admin/lib/axios.ts`
  - Middleware reads cookies (not localStorage), so the cookie exists mainly for route protection.
- Backend protects Admin endpoints via:
  - `authMiddleware` (validates JWT)
  - `roleMiddleware([ADMIN])`
  - Router: `backend/src/routes/admin.routes.ts`

## 4) Data model overview (conceptual)

- Students belong to a Group.
- Teachers can be linked to multiple Subjects (many-to-many).
- ScheduleEntries map Group + Subject + Weekday (+ teacher + timeslot + room).
- Lessons represent a specific class session with `startsAt/endsAt` and link Group + Subject + Teacher.
- Attendance records are keyed by `(lessonId, studentId)`.

## 5) Google Sheets sync — overview

UniFlow supports three distinct spreadsheet sync systems:

1. **Students Sheets** (tabs = Groups)
2. **Teachers Sheets** (tabs = Subjects)
3. **Attendance Sheets** (tabs = `GROUPNAME_SUBJECTNAME`)

All sync logic is implemented in backend services. Sync can run in three ways:

- **Worker loop** (polling) — runs inside the backend process in dev (or as a separate process in prod).
- **Manual API trigger** — admin dashboard “Force Sync”.
- **Webhook trigger** — Google Apps Script can POST to backend on sheet edits.

## 6) Students Sheets sync (tabs = Groups)

### Purpose

- Treat each sheet tab as a **Group**.
- Treat rows as **Students**.
- Keep DB roster updated and optionally push DB changes back to Sheets.

### Key backend pieces

- Service: `backend/src/services/students-sheets/StudentsSheetsSyncService.ts`
- Worker: `backend/src/services/students-sheets/StudentsSheetsWorker.ts`
- Admin endpoints: `backend/src/controllers/admin/AdminStudentsSheetsController.ts`
- Webhook endpoint: `POST /api/webhooks/students-sheets` (`backend/src/routes/webhooks.routes.ts`)

### Conflict system

- The sync intentionally avoids destructive updates when it detects ambiguous identity situations.
- When a conflict is detected (e.g. duplicate identifiers across tabs), records may be **skipped** until the conflict is resolved.
- Admin UI provides conflict resolution endpoints (see Students Sheets conflicts routes under `/api/admin/students-sheets/conflicts`).

### Environment variables

- `GOOGLE_SHEETS_STUDENTS_ENABLED`
- `GOOGLE_SHEETS_STUDENTS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_STUDENTS_WORKER_ENABLED`
- `GOOGLE_SHEETS_STUDENTS_WORKER_INTERVAL_MS`
- `GOOGLE_SHEETS_STUDENTS_DB_TO_SHEETS_ENABLED`
- `GOOGLE_SHEETS_STUDENTS_WEBHOOK_SECRET`
- (Optional filters)
  - `GOOGLE_SHEETS_STUDENTS_GROUP_TABS_ALLOW_REGEX`
  - `GOOGLE_SHEETS_STUDENTS_GROUP_TABS_DENY_REGEX`

## 7) Teachers Sheets sync (tabs = Subjects)

### Purpose

- Spreadsheet tabs are treated as **Subjects**.
- Each tab contains a list of **Teachers** that teach that Subject.
- Sync ensures:
  - Subjects exist in DB
  - Teachers exist in DB
  - Teacher ↔ Subject links match what is in Sheets

### Key backend pieces

- Service: `backend/src/services/teachers-sheets/TeachersSheetsSyncService.ts`
- Worker: `backend/src/services/teachers-sheets/TeachersSheetsWorker.ts`
- Admin endpoints: `backend/src/controllers/admin/AdminTeachersSheetsController.ts`

### Important behaviors

- Sheets → DB:
  - Detects subject tabs from spreadsheet metadata.
  - Creates DB Subjects via `subject.createMany(..., skipDuplicates: true)`.
  - Upserts teachers and sets their `subjects` relation.
- DB → Sheets (optional):
  - Ensures each DB Subject has a tab.
  - Ensures header row exists.
  - Writes teacher roster into the appropriate subject tab.

### Subject rename handling

When a subject is renamed in the Admin UI:

- Backend attempts to rename the corresponding sheet tab (best-effort).
- Logic is wired from `AdminSubjectController` to `TeachersSheetsSyncService`.

### Environment variables

- `GOOGLE_SHEETS_TEACHERS_ENABLED`
- `GOOGLE_SHEETS_TEACHERS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_TEACHERS_WORKER_ENABLED`
- `GOOGLE_SHEETS_TEACHERS_WORKER_INTERVAL_MS`
- `GOOGLE_SHEETS_TEACHERS_DB_TO_SHEETS_ENABLED`
- (Optional filters)
  - `GOOGLE_SHEETS_TEACHERS_SUBJECT_TABS_ALLOW_REGEX`
  - `GOOGLE_SHEETS_TEACHERS_SUBJECT_TABS_DENY_REGEX`

## 8) Attendance sync (tabs = GROUPNAME_SUBJECTNAME)

### Spreadsheet format

- Each attendance tab name must look like: `GROUPNAME_SUBJECTNAME`
  - The parser splits by the **last** underscore.
  - Example: `23C_Introduction to Programming`

### Columns

- A: `student_uuid`
- B: `student_number`
- C: `fullname`
- D+ : dates (header row cells). Supported header formats:
  - `YYYY-MM-DD`
  - `MM/DD` or `DD/MM` (optionally with year)

### Status encoding in cells

- `P` → PRESENT
- `A` → ABSENT
- `L` → LATE
- `E` → EXCUSED
- empty → no record (treated as clear/delete)

### Key backend pieces

- Service: `backend/src/services/attendance-sheets/AttendanceSheetsSyncService.ts`
- Worker: `backend/src/services/attendance-sheets/AttendanceSheetsWorker.ts`
- Admin endpoints: `backend/src/controllers/admin/AdminAttendanceSheetsController.ts`
- Webhook endpoint: `POST /api/webhooks/attendance-sheets`

### Two-way intent

- Sheets → DB:
  - Reads attendance cells for each date column and upserts DB Attendance.
  - Clearing a cell deletes the DB record for that student/day.
- DB → Sheets:
  - Roster (A-C) can be kept in sync from DB to Sheets (enabled by env).
  - Additionally, **Admin UI saves** push the selected day’s attendance back to Sheets (DB → Sheets) so Sheets stays consistent with what admins enter in the dashboard.

### Admin attendance editing flow

1. Admin selects `groupId`, `subjectId`, `date`.
2. Frontend calls `GET /api/admin/attendance/by-date` to load existing statuses.
3. Admin edits statuses and clicks Save.
4. Frontend calls `POST /api/admin/attendance/by-date/bulk`.
5. Backend:
   - Finds (or creates) a `Lesson` for that day.
   - Upserts/deletes Attendance records per student.
   - Best-effort pushes that day’s statuses to the relevant Attendance Sheet tab.

### Environment variables

- `GOOGLE_SHEETS_ATTENDANCE_ENABLED`
- `GOOGLE_SHEETS_ATTENDANCE_SPREADSHEET_ID`
- `GOOGLE_SHEETS_ATTENDANCE_WORKER_ENABLED`
- `GOOGLE_SHEETS_ATTENDANCE_WORKER_INTERVAL_MS`
- `GOOGLE_SHEETS_ATTENDANCE_DB_TO_SHEETS_ENABLED`
- `GOOGLE_SHEETS_ATTENDANCE_DATE_FORMAT` (`MM/DD` or `DD/MM`)
- `GOOGLE_SHEETS_ATTENDANCE_WEBHOOK_SECRET`
- (Optional filters)
  - `GOOGLE_SHEETS_ATTENDANCE_TABS_ALLOW_REGEX`
  - `GOOGLE_SHEETS_ATTENDANCE_TABS_DENY_REGEX`

## 9) Workers vs production deployment

### Dev mode

- It is convenient to run workers inside the backend API process.
- This is controlled via `*_WORKER_ENABLED` env vars.

### Production recommendation

- Run the API as one process (stateless, scalable).
- Run workers as separate processes (or scheduled jobs) so they don’t interfere with API latency.
  - Example for students sheets: `npm run students-sheets:worker`
  - Similar pattern can be applied for teachers/attendance worker scripts.

### Webhooks in production

- Prefer webhooks for near-real-time updates.
- Set `GOOGLE_SHEETS_*_WEBHOOK_SECRET` and configure Apps Script to send `x-uniflow-webhook-secret`.

## 10) Local development: start everything

On Windows, you can use the repo root script:

- `dev.bat`

It opens three terminals:

- Backend: `backend/npm run dev`
- Admin: `admin/npm run dev`
- User: `user/npm run dev`

## 11) Troubleshooting (common)

### “Subjects” or other pages stuck on Loading

Most common causes:

- Backend not running on `localhost:3001`.
- Port hopping: Admin/User running on `3003+` while backend CORS is too strict.
- Invalid/expired JWT token → requests return 401 and UI redirects to login.

### Teachers Sheets shows subjects, but Subjects page is empty

- If backend cannot reach DB, Subjects API will fail.
- If teachers sheets sync is disabled, Subjects might not be created.
- You can verify DB subjects quickly via Prisma (example):
  - `backend/node -e "... prisma.subject.findMany() ..."`

### Attendance save errors

- `MISSING_TEACHER_FOR_LESSON`:
  - The system needs a teacher for the lesson.
  - Provide a schedule entry for group+subject+weekday OR link a teacher to the subject.

---

If you want, I can also add a short “Production checklist” (env, DB migrations, reverse proxy, secrets, monitoring) tailored to your deployment target.
