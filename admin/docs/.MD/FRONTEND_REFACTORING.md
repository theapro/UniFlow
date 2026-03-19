# UniFlow Admin — Frontend refactor summary (2026-03-14)

This refactor focuses on simplifying navigation and making the Schedule area consistent (no CSV import/preview, no multi-draft schedules).

## 1) Sidebar simplification

**Goal:** reduce clutter and group the most-used pages.

**Changed:** `admin/components/uniflow-sidebar.tsx`

- Added 3 primary groups:
  - **Academic**: Students, Teachers, Groups, Department Groups
  - **Learning**: Subjects, Classrooms, Schedule
  - **Analytics**: Attendance, Grades
- Kept **System** group for Settings
- Removed the previous extra collapsible sections (AI Settings, Sheets) from the sidebar.

## 2) Dashboard quick navigation

**Changed:** `admin/app/[lang]/dashboard/page.tsx`

- Added a **Quick Navigation** card with direct links to:
  - Students, Teachers, Groups, Schedule, Attendance, Grades

## 3) Schedule: remove CSV import + Preview

**Goal:** make Schedule a single, consistent workflow.

**Changed:** `admin/app/[lang]/dashboard/schedule/page.tsx`

- Removed the old CSV import UI and the preview section.
- Replaced the page with a schedules index UI.

**Deleted (no longer used):**

- `admin/components/schedule/ScheduleImport.tsx`
- `admin/components/schedule/ScheduleViewer.tsx`

## 4) Schedule index (list created schedules + manage/view)

**Added:** `admin/components/schedule/ScheduleIndex.tsx`

- Shows **all created schedules** as a list of months that contain saved monthly schedule entries.
- For each month:
  - **View** → opens read-only builder at `/[lang]/dashboard/schedule/view?month=YYYY-MM`
  - **Manage** → opens editable builder at `/[lang]/dashboard/schedule/manage?month=YYYY-MM`
- Added **Create new schedule** button that opens:
  - `/[lang]/dashboard/schedule/manage?month=<current-month>`

## 5) Remove “Save as draft” (multi-draft schedules)

**Goal:** remove the “multiple drafts per month” concept.

**Changed:**

- `admin/components/schedule/builder/route/ScheduleBuilderContext.tsx`
- `admin/components/schedule/builder/route/ScheduleBuilderSidebar.tsx`
- `admin/components/schedule/builder/route/ScheduleBuilderProvider.tsx`

- Removed the “Schedules (Drafts)” UI and draft selection/new-draft actions.
- The builder now opens a month via the query string `month=YYYY-MM`.

**Deleted (no longer used):**

- `admin/components/schedule/builder/utils/drafts.ts`

## 6) Backend support for schedule month listing

**Added:** `GET /api/admin/monthly-schedule/months`

**Changed:**

- `backend/src/services/admin/AdminMonthlyScheduleService.ts`
- `backend/src/controllers/admin/AdminMonthlyScheduleController.ts`
- `backend/src/routes/admin.routes.ts`

This endpoint returns a list of `{ year, month, days }` where `days` is the number of calendar days in that month that currently have at least one schedule entry.

## How to use the new Schedule flow

1. Open **Schedule** from sidebar.
2. Pick a month from the list and click **Manage** (edit) or **View** (read-only).
3. To start a new month, click **Create new schedule**.

Notes:

- If a month has no saved entries yet, it won’t appear in the list until you create at least one entry.
