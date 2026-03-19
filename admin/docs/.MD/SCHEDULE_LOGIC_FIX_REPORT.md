# UniFlow Admin — Schedule Builder Fix Report (UI-preserving)

This report documents the fixes applied based on `SCHEDULE_LOGIC_DETAILED.md`, **without changing the visible UI layout**.

Date: 2026-03-13

---

## Goals

- Keep the current Schedule Builder UI appearance the same.
- Fix the main “messy / risky” logic points that could cause:
  - duplicate lessons during a move
  - UI/backend divergence after partial API failures
  - inconsistent department ordering logic spread across multiple files
  - span (multi-group width) state being lost on refresh

---

## 1) Atomic move for saved lessons (no more POST+DELETE)

### Problem

Previously, moving a **saved** lesson was implemented as:

1. `POST /monthly-schedule` (create new row at destination)
2. `DELETE /monthly-schedule/:id` (remove old row)

If step (1) succeeded but step (2) failed, the user could end up with **duplicates**.

### Fix

Moves for saved lessons now use a single atomic update:

- `PUT /api/admin/monthly-schedule/:id` with `{ date, timeSlotId, groupId }`

This removes the duplication risk and keeps conflict handling consistent.

### Where

- Admin frontend:
  - `components/schedule/builder/route/ScheduleBuilderProvider.tsx` (drag move)
  - `components/schedule/builder/route/ScheduleWorkspace.tsx` (group dropdown move)
- Admin API client typing:
  - `lib/api.ts` (`monthlyScheduleApi.update` now accepts `date/timeSlotId/groupId`)
- Backend:
  - `backend/src/services/admin/AdminMonthlyScheduleService.ts` (`update()` now supports moving)
  - `backend/src/controllers/admin/AdminMonthlyScheduleController.ts` (accepts the new patch fields)

---

## 2) Centralized department ordering (deptRank duplication removed)

### Problem

Department ordering (`IT`, `Japanese`, `Partner University`, `Language University`) was duplicated in multiple places. That’s error-prone and makes changes harder.

### Fix

A shared helper now provides deterministic department ordering.

### Where

- Added helper:
  - `components/schedule/builder/utils/department.ts`
- Updated usages:
  - `components/schedule/builder/route/ScheduleBuilderProvider.tsx`
  - `components/schedule/builder/route/ScheduleWorkspace.tsx`
  - `components/schedule/builder/ScheduleGrid.tsx`

---

## 3) Safer optimistic updates (rollback on partial failures)

### Problem

Some optimistic updates could leave the UI in a state that doesn’t match the backend, especially when **only some** requests fail in a batch.

### Fixes implemented

- When updating a saved lesson across span cells (mini subject/teacher/room drops), any failed update now restores those specific cells from the previous grid snapshot.
- When shrinking a saved lesson span, if one or more deletes fail, affected cells are restored and span metadata is adjusted to match what still exists.
- When deleting a spanned saved lesson, if any delete fails, the grid + span metadata are reverted.

### Where

- `components/schedule/builder/route/ScheduleBuilderProvider.tsx` (mini update rollback)
- `components/schedule/builder/route/ScheduleWorkspace.tsx` (shrink/delete rollback)

---

## 4) Span (multi-group width) persistence across refresh (UI-only)

### Problem

`lessonGroupSpans` was UI-only, so a refresh would lose the width/covering metadata even though backend rows still existed.

### Fix

Span metadata is now:

- persisted to `localStorage` per month/year
- restored on month load
- validated against the loaded grid so stale spans don’t re-apply incorrectly

This keeps the same UI behavior, but avoids losing span width after a refresh **on the same browser**.

### Where

- `components/schedule/builder/route/ScheduleBuilderProvider.tsx`

Storage key format:

- `uniflow.admin.scheduleBuilder.lessonGroupSpans.v1:<year>-<month>`

---

## 5) Documentation alignment

Updated the logic doc to reflect the new behavior:

- `SCHEDULE_LOGIC_DETAILED.md`

---

## Verification

- `admin`: `npm run build` (successful)
- `backend`: `npm run build` (successful)

---

## Notes / limitations

- Span persistence is client-side (localStorage). It is not shared across devices/browsers.
- The UI still supports the existing “positions” model (fixed 4 primary columns). This report intentionally avoided any changes that would alter the visible layout or interaction model beyond making moves safer.

---

## 6) Column confusion fix: show non-primary group lessons in the same column

### Problem

If a position had multiple groups assigned (e.g. `23A`, `23B`) but only `23A` was the primary visible group, then:

- selecting/changing a lesson to `23B` could make it “disappear” from the visible grid
- multiple lessons visually looked like the same group (because the column label was the primary group)

### Fix (UI-preserving)

The visible column still stays as the **same 4 positions**, but the time-grid now also renders lessons from **other groups assigned to that same position** inside the same column.

Important rule (as designed):

- A non-expanded LessonCard can be saved for **exactly one** group (picked from that position’s groups).
- An expanded LessonCard is the exception: it represents multiple groups at once (multiple backend rows).

So:

- each LessonCard can be assigned to one of the groups in that position (e.g. `23A` vs `23B`)
- the card remains visible even if the chosen group is not the primary group
- changing a card’s group does not rewrite the position’s primary column group

### Where

- `components/schedule/builder/route/ScheduleWorkspace.tsx`

---

## 7) LessonCard made more compact (truncate)

### Change

- reduced padding/spacing
- subject text uses stronger truncation (single line)
- group/teacher/room lines remain truncated to avoid overflow

### Where

- `components/schedule/builder/ScheduleCards/LessonCard.tsx`

---

## 8) Saving fixes: avoid POST /monthly-schedule returning 500 for known cases

### Problem

Some save operations could return `500` for common “expected” error cases (like invalid foreign keys), making it hard to understand why a lesson didn’t save.

### Fix

Monthly schedule service now maps common Prisma errors to user-friendly statuses/messages:

- invalid reference ids (Prisma `P2003`) -> `400` with message like `Invalid reference: <field>`
- missing schedule row on update/delete (Prisma `P2025`) -> `404` (`Schedule not found`)

### Where

- `backend/src/services/admin/AdminMonthlyScheduleService.ts`
- `backend/src/controllers/admin/AdminMonthlyScheduleController.ts` (delete now returns 404 instead of 500)

---

## 9) Fix for `Time slot not found`: prevent synthetic `missing:*` IDs from being saved

### Problem

The schedule grid is based on a fixed 1..6 “para” template.

If the DB does not contain `TimeSlot` records for slotNumbers 1..6, the frontend previously generated a synthetic id like:

- `missing:1`

That synthetic id could then be posted to the backend on create/move/expand, triggering a `400` error like `TimeSlot not found` / `Time slot not found`.

### Fix

- Frontend now blocks all create/move/expand actions into rows where `timeSlotId` is `missing:*` and shows a clear toast telling the admin to seed/configure TimeSlots.
- Backend validation now returns a clearer message for `missing:<n>`:
  - `TimeSlot is not configured for slot #<n>`

### Where

- Frontend guards:
  - `components/schedule/builder/route/ScheduleBuilderProvider.tsx`
  - `components/schedule/builder/route/ScheduleWorkspace.tsx`
  - `components/schedule/builder/route/LessonExpandGroupsPopover.tsx`
  - `components/schedule/builder/utils/timeSlots.ts`
- Backend message:
  - `backend/src/services/admin/AdminMonthlyScheduleService.ts`

### Operational note

Ensure DB has TimeSlots for slotNumbers 1..6 (dev):

- `cd backend && npm run db:seed`

---

## 10) Expand/shared lesson: allow the same teacher for multiple groups in one slot

### Problem

“Expand” means the same lesson should apply to multiple groups in the same day + time slot.

In that case the teacher (and usually the room) must be **the same** for all the expanded groups, so the system should not reject it as “teacher already has another lesson”.

### Fix

Backend monthly schedule conflict rules are now:

- **Group** conflict stays strict: a group cannot have 2 lessons in the same slot.
- **Teacher** conflict is allowed only for a _shared lesson_:
  - same `teacherId` + same day + same `timeSlotId` is allowed if `subjectId`, `roomId`, and `note` match
  - otherwise it is rejected as a conflict
- **Room** conflict is allowed only for a _shared lesson_:
  - same `roomId` + same day + same `timeSlotId` is allowed if `teacherId`, `subjectId`, and `note` match
  - otherwise it is rejected as a conflict

This enables expanding a lesson across multiple groups while keeping the “no double booking” rule for different lessons.

### Where

- `backend/src/services/admin/AdminMonthlyScheduleService.ts`
