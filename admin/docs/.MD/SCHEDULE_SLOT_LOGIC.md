# UniFlow Admin — Schedule Builder Slot (Para) Logic

Date: 2026-03-14

This document explains how the Schedule Builder decides which **Para/slot rows** to show in the timetable grid, how it maps them to backend `TimeSlot` records, and what happens when the DB is missing slots.

## Goals

- Keep the timetable grid **stable and predictable** for admins/teachers.
- Use backend `TimeSlot` records as the **source of truth** for IDs (saving requires real IDs).
- Still render a usable grid even if the DB is partially configured.

## Source code

- Slot-row construction: `admin/components/schedule/builder/utils/timeSlots.ts`
- Save/move guards for missing slots:
  - `admin/components/schedule/builder/route/ScheduleBuilderProvider.tsx`
  - `admin/components/schedule/builder/route/ScheduleWorkspace.tsx`

## 1) Slot numbers shown (template ∪ DB)

The UI builds the slot list as a **union** of:

- A product-level template (default 1..6)
- Whatever the backend returns in `TimeSlot[]`

So the grid typically shows 1..6, but if the DB defines additional slot numbers, they will also be rendered.

## 2) Times shown (DB first, template fallback)

For each `slotNumber` row:

- If the DB has `TimeSlot(slotNumber)` → the UI uses `db.startTime` and `db.endTime`.
- Otherwise → it falls back to the template times.

This makes the UI reflect DB configuration when present, but still keeps the grid readable when incomplete.

## 3) `timeSlotId` mapping (real ID or `missing:<n>`)

Each row must carry a `timeSlotId` so cells can be addressed as:

- `cell:${date}@@${timeSlotId}@@${groupId}`

The mapping is:

- If DB slot exists: `timeSlotId = <real uuid>`
- If DB slot is missing: `timeSlotId = missing:<slotNumber>`

## 4) Saving rules when a slot is missing

`missing:<n>` is a **synthetic ID** used only to render the row.

To prevent invalid saves:

- The builder blocks **create/move/expand** actions into rows whose `timeSlotId` starts with `missing:`.
- The UI shows a toast telling you to seed/configure `TimeSlot` records.

Operational fix (dev):

- Run backend seed to ensure slotNumbers 1..6 exist.

## 5) Break rows (Lunch Break)

After slot **#3**, the UI inserts a static break row:

- `Lunch Break`

This is a visual separator only (no `timeSlotId`, no saving).

## Why this fixes real-world issues

- Refresh/sync issues caused by invalid `TimeSlot` references are avoided: saves require real DB `TimeSlot` IDs.
- Admins can change slot times in the DB and the UI will display them automatically.
- The timetable stays stable even if the DB is incomplete (missing slots still render, but are non-savable).
