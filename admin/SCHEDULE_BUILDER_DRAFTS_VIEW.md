# UniFlow Admin — Schedule Builder: Drafts, View mode, and + Columns

Date: 2026-03-14

This document describes the **new** Schedule Builder workflow additions:

- Multiple schedules via **Drafts** (client-side)
- **Auto-save** for draft state
- A read-only **/view** page
- Dynamic group columns with a trailing **+** add column (up to ~30 columns)

---

## 1) Drafts (multiple schedules)

The builder now supports multiple **Drafts** per month.

- Each draft stores:
  - top “Category Groups” assignments (department rows)
  - primary column group order
  - UI span metadata (expanded lessons)
  - draft lessons (unsaved cards)

### Auto-save

Drafts are **auto-saved** to `localStorage` while you work.

- This keeps your in-progress edits (especially drafts) after refresh.
- Backend-saved lessons are still saved via existing API calls.

### New draft

In the left sidebar (Schedule Builder), use:

- **Schedules (Drafts) → New draft**

This creates a new draft as a copy of the current builder state.

---

## 2) Read-only view page

A new route exists:

- `/[lang]/dashboard/schedule/view`

Behavior:

- Shows the same workspace/grid layout
- Disables all editing:
  - drag & drop is disabled
  - delete/resize/expand/group-change controls are disabled
  - sidebar draggable cards are hidden

This is useful for previewing a chosen schedule draft without accidental edits.

---

## 3) Workspace columns: + add column (25+ columns)

The workspace columns are no longer forced to a fixed 4.

- Columns are **compact** (no gaps)
- A trailing **+** column appears (until the max is reached)

### Add a new column

To add another column/position:

- Drag a Group into the **+** column in the top “Category Groups” grid

Max columns:

- Currently capped at `30`

---

## 4) Removed repeated placeholder text

The repeated cell text:

- "Drop a Group into the category rows above"

was removed from the timetable grid (it no longer appears in every row).
