# UniFlow Admin — Schedule Builder Logic (Detailed)

This document explains how the Admin **Monthly Schedule Builder** works end‑to‑end (frontend + backend), and highlights parts that can be confusing, inconsistent, or not yet “professional” for a teacher-facing workflow.

## Scope

- UI: `admin/components/schedule/builder/**`
- API client: `admin/lib/api.ts` (`monthlyScheduleApi`)
- Backend routes: `backend/src/routes/admin.routes.ts`
- Backend controller/service:
  - `backend/src/controllers/admin/AdminMonthlyScheduleController.ts`
  - `backend/src/services/admin/AdminMonthlyScheduleService.ts`

---

## 1) Data model (backend)

### Core tables (Prisma)

The builder persists into `Schedule` rows (monthly schedule entries) and uses `CalendarDay` for date indexing.

**Key idea:** schedule rows are stored as:

- `calendarDayId` (derived from `date`)
- `timeSlotId`
- `groupId`
- `teacherId`
- `subjectId`
- `roomId` (nullable)
- `note` (nullable)

### Monthly schedule endpoints

Defined in `backend/src/routes/admin.routes.ts`:

- `GET  /api/admin/monthly-schedule?month=..&year=..&groupId?&teacherId?`
- `POST /api/admin/monthly-schedule`
- `PUT  /api/admin/monthly-schedule/:id`
- `DELETE /api/admin/monthly-schedule/:id`

### Conflict handling

`AdminMonthlyScheduleService` classifies unique constraint conflicts and returns `409` with messages like:

- `Teacher already has a lesson at that time`
- `Group already has a lesson at that time`
- `Room already has a lesson at that time`

This is good for correctness, but the frontend should be careful with optimistic UI (see notes below).

---

## 2) Frontend architecture

### Main components

- Provider + DnD:
  - `admin/components/schedule/builder/route/ScheduleBuilderProvider.tsx`
- Workspace grid:
  - `admin/components/schedule/builder/route/ScheduleWorkspace.tsx`
  - `admin/components/schedule/builder/ScheduleGrid.tsx`
  - `admin/components/schedule/builder/ScheduleRow.tsx`
  - `admin/components/schedule/builder/ScheduleCell.tsx`
- Sidebar:
  - `admin/components/schedule/builder/ScheduleSidebar.tsx`

### State ownership

All “builder” state is held in `ScheduleBuilderProvider` and exposed via `useScheduleBuilder()`.

Important state pieces:

- `grid`: schedule cell → lesson mapping (`ScheduleGridState`)
- `departmentGroupAssignments`: the _top_ “category rows” mapping (where you drop groups)
- `groupOrder`: primary groupId per column position (fixed-length array)
- `lessonGroupSpans`: UI-only “lesson spans across adjacent columns” metadata

---

## 3) Column model (where confusion often comes from)

There are **two different concepts** that can look similar:

### A) Department/Category assignment grid (top rows)

In `ScheduleGrid.tsx` the top section (`DEPARTMENT_GROUP_ROWS`) renders droppable cells.

- Each cell is identified by: `(departmentKey, position)`
- The stored value is: `{ department, position, groupId }`

Purpose:

- This is a _planning / grouping_ surface: you drop groups into category rows.

### B) Visible schedule columns (time grid)

The schedule time grid shows lessons by **group column**.

Current implementation uses:

- `MIN_GROUP_COLS = 4`
- `groupOrder: Array<string | null>` length `MIN_GROUP_COLS`

Meaning:

- there are always 4 “positions” (0..3)
- each position has **one primary group** shown in the time grid

This is a compromise design:

- department grid supports **multiple groups per position** (stacked)
- time grid shows **only one group per position** (the primary group)

### Why this can feel “not professional”

If a teacher drops multiple groups into the same position (e.g., IT + Japanese), the header will show multiple badges, but the time grid only edits the primary group.

That mismatch is a common source of confusion.

**More professional alternatives** (pick one):

1. **One group = one column** (best clarity)
   - no `position` multiplexing
   - columns are derived from selected groups directly

2. Keep “positions”, but add an explicit control for _which group is primary_ in that position
   - e.g., click a badge to make it the visible column
   - and/or a dropdown in the column header

---

## 4) Drag & Drop logic (what can be dragged where)

The DnD is wired in `ScheduleBuilderProvider.tsx` using `@dnd-kit/core`.

### Drag item types

1. `type: "group"`
   - Source: sidebar Group cards
   - Target: department/category droppable cells (`deptGroupCellDroppableId`)
   - Effect: updates `departmentGroupAssignments` and sometimes `groupOrder`

2. `type: "mini"` with `kind: subject | teacher | room`
   - Source: sidebar subject/teacher/room pills
   - Target: schedule cell (`cell:${date}@@${timeSlotId}@@${groupId}`)
   - Effect:
     - creates/updates a draft lesson in `grid`
     - persists with `POST /monthly-schedule` when subject+teacher exist

3. `type: "lesson"`
   - Source: existing Lesson card in grid
   - Target: another schedule cell
   - Effect:
     - draft: local move only
     - saved: optimistic move + `POST` new row + `DELETE` old row

### Note about “move saved lesson” implementation

Moving a saved lesson is implemented as a true move:

- `PUT /monthly-schedule/:id` patching `date`, `timeSlotId`, and/or `groupId`

Why this is better:

- it’s a single atomic update (no “create succeeded but delete failed” duplicates)
- conflict detection still works (backend returns `409` when teacher/group/room is already occupied)

---

## 5) Lesson spanning (multi-group width)

In `ScheduleWorkspace.tsx`, a lesson can expand into adjacent group columns.

- Stored only in UI state: `lessonGroupSpans`
- Used to:
  - render a wide overlay card across columns
  - create/delete multiple backend rows when expanding/shrinking

### Why this is risky

Because `lessonGroupSpans` is UI-only:

- refresh historically caused the UI to lose “span” knowledge
- backend rows still exist for each group, so the UI can visually drift from the teacher’s intent

Current mitigation:

- span metadata is persisted client-side (localStorage) per month/year and validated against the loaded grid on reload

A robust approach:

- store span groups as explicit rows (already happening)
- but derive span UI from the grid (detect adjacent identical lessons)
  - e.g., same teacher+subject+room+note for the same date/time

---

## 6) Places that are currently “messy” (recommended cleanups)

These are not necessarily bugs, but they reduce maintainability or clarity.

### A) Duplicated department ranking logic

`deptRank` is defined in multiple places:

- `ScheduleBuilderProvider.tsx`
- `ScheduleWorkspace.tsx`
- `ScheduleGrid.tsx`

Recommendation:

- centralized into one helper in `admin/components/schedule/builder/utils/department.ts`.

### B) Fixed 4 columns (visual noise)

`MIN_GROUP_COLS = 4` forces layout width even when no groups are chosen.

Recommendation:

- render only real columns; keep empty droppable targets only where needed.

### C) Department assignments are UI-only

`departmentGroupAssignments` is not persisted to backend.

So:

- reload → you lose your “category planning” structure.

Recommendation:

- either persist it (DB table) or remove the concept if not needed.

### D) Optimistic UI without full rollback

Several actions modify UI first and then call API.

Recommendation:

- on API failure, reliably rollback _all affected cells_ (move/update/delete paths were hardened).

---

## 7) Teacher convenience improvements (high impact)

If you want the builder to be more teacher-friendly, these usually matter most:

1. Make the visible group in a position explicit
   - choose primary group via header click/dropdown

2. Reduce cognitive load
   - hide empty placeholder columns
   - avoid noisy placeholders like `[ ]`

3. Prevent accidental conflicts early
   - show inline conflict reason when API returns 409
   - optionally pre-check if cell is occupied (server-side still authoritative)

---

## 8) Quick navigation

- DnD + state: `admin/components/schedule/builder/route/ScheduleBuilderProvider.tsx`
- Grid header + dept drop cells: `admin/components/schedule/builder/ScheduleGrid.tsx`
- Cell visuals: `admin/components/schedule/builder/ScheduleCell.tsx`
- Lesson visuals: `admin/components/schedule/builder/ScheduleCards/LessonCard.tsx`
- Backend create/list/update/delete: `backend/src/services/admin/AdminMonthlyScheduleService.ts`
