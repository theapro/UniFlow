# UniFlow — Cohorts + Schedule Builder Refactor Report

## Goals (from requirements)

- Add **Academic → Cohorts** management.
- Represent academic structure as a stable tree: **Department → Cohort → Group**.
- Departments are fixed/system-defined:
  - IT
  - Japanese
  - Partner University
  - Employability/Cowork
  - Language University
- Schedule Builder updates:
  - Show fixed department rows (including Employability/Cowork).
  - Sidebar shows groups as a **department → cohort → groups** tree.
  - **IT** groups are cohort-grouped and ordered by cohort sort order.
  - **Japanese** is _not_ cohort-grouped (simple list).
  - **Employability/Cowork** lessons can render **cohort-wide** across IT cohort columns.
  - Prevent confusing/duplicate data at the database level (avoid ambiguous uniqueness).

## Data model changes (Prisma)

### Cohort

- Cohort identity is now based on a stable string `code` (unique), not `year`.
- Added cohort ordering via `sortOrder`.

Key change:

- `Cohort.code: String @unique`
- `Cohort.sortOrder: Int @default(0)`
- `Cohort.year` is optional/legacy-friendly.

Why:

- Existing cohorts weren’t reliably modeled as an `Int year` (e.g. “19/20/21”).
- Schedule/seed logic needed a consistent sortable cohort identifier.

### Group uniqueness

- `Group.name` remains **globally unique**.
- To avoid collisions for Japanese groups using numeric-style names that overlap IT, Japanese groups are seeded with a `JP-` prefix where needed.

## Migration strategy

- A safe migration was used to backfill existing rows before enforcing required/unique constraints.

Files:

- backend/prisma/schema.prisma
- backend/prisma/migrations/20260314172943_cohort_code_and_sortorder/migration.sql

## Seeding (backend)

- Seed now creates the fixed department records (as ParentGroups), cohorts, and groups.

Files:

- backend/prisma/seed.ts

Notes:

- Departments are treated as **system-defined**; admin mutation endpoints are blocked to prevent accidental changes.

## Backend API

### Cohorts CRUD (admin)

- Added admin endpoints for listing/creating/updating/deleting cohorts.
- Deleting a cohort with groups returns a conflict to avoid dangling references.

Files (core):

- backend/src/services/admin/AdminCohortService.ts
- backend/src/controllers/admin/AdminCohortController.ts
- backend/src/routes/admin.routes.ts

### ParentGroup mutation blocked

- ParentGroups (departments) are fixed; create/update/delete is blocked.

## Admin UI

### Cohorts pages

- Added pages:
  - /dashboard/cohorts
  - /dashboard/cohorts/[id]
- Cohort detail allows adding groups under a chosen department.

Files:

- admin/app/[lang]/dashboard/cohorts/page.tsx
- admin/app/[lang]/dashboard/cohorts/[id]/page.tsx
- admin/components/cohorts/CohortsView.tsx
- admin/components/cohorts/CohortDetailView.tsx
- admin/lib/api.ts

### Groups tree page

- Groups page now shows a **Department → Cohort → Group** tree.

Files:

- admin/components/groups/GroupsTreeView.tsx
- admin/app/[lang]/dashboard/groups/page.tsx

## Schedule Builder changes

### Department rows + fixed ordering

- Department assignment rows are fixed and include **Employability/Cowork**.

Files:

- admin/components/schedule/builder/types.ts
- admin/components/schedule/builder/utils/department.ts
- admin/components/schedule/builder/utils/departmentGroupGrid.ts

### Sidebar: department → cohort → groups

- Sidebar now renders a fixed department list.
- IT/Partner/Employability/Language are cohort-grouped and ordered by `cohort.sortOrder`.
- Japanese is rendered as a plain list (not cohort-grouped).
- IT cohort headers show a small color marker (uses theme `--chart-*` variables).

File:

- admin/components/schedule/builder/ScheduleSidebar.tsx

### Grid: IT cohort color markers

- Column headers for IT groups show a thin color bar based on cohort.

File:

- admin/components/schedule/builder/ScheduleGrid.tsx

### Placement restriction (department-only)

- Dragging a group into a department row cell is blocked if the group belongs to a different department.

File:

- admin/components/schedule/builder/route/ScheduleBuilderProvider.tsx

### Employability/Cowork cohort-wide span (UI)

- If an Employability/Cowork group is assigned for an IT cohort, and a lesson exists for that Employability group at a given date/slot:
  - The lesson is rendered once at the leftmost column of that IT cohort.
  - It visually spans all IT columns in that cohort.
  - Covered cells render as non-empty (no dashed empty placeholders).
  - Drops into that cohort/time are blocked to prevent overlapping lessons.

Files:

- admin/components/schedule/builder/route/ScheduleWorkspace.tsx
- admin/components/schedule/builder/route/ScheduleBuilderProvider.tsx

Important limitation (current architecture):

- The Schedule grid droppable IDs are based on the **primary (visible) group** for the column.
- Projected lessons (like Employability) are still stored under their own `groupId`.
- Drag-moving a cohort-wide Employability lesson into another slot will drop it into the _target primary group_ unless you switch group back via the lesson’s group dropdown.

## Theme-consistent cohort coloring

- Cohort color mapping uses existing theme variables `--chart-1..--chart-5`.

File:

- admin/components/schedule/builder/utils/cohortColors.ts

## Validation

- Admin production build succeeds after changes (`next build`).

## Remaining / Optional follow-ups

- Seed cleanup strategy: remove/trim unrelated fake seed data if needed (keeping AI models intact).
- Improve UX for editing projected lessons via mini-card drops (target effective cell rather than primary cell).
- Add explicit “cohort-wide” indicator text on the Employability lesson card (if desired).
- Add stronger enforcement of IT-only primary columns if schedule builder is intended to be IT-only.
