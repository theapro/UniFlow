# UniFlow Apps Script helpers

This folder contains Google Apps Script code that you can paste into **Extensions → Apps Script** inside Google Sheets.

## Attendance tabs sync (Groups × Subjects)

File: `AttendanceSync.gs`

### What it does

- Reads **GROUP** tabs from your _Students & Groups_ spreadsheet.
- Reads **SUBJECT** tabs from your _Teachers & Subjects_ spreadsheet.
- Creates/updates attendance tabs in your _Attendance_ spreadsheet named `GROUP_SUBJECT`.
- Keeps columns **A–C** fixed (managed by sync):
  - `student_uuid`, `student_number`, `fullname`
- Never overwrites columns **D+** (teachers’ date columns and marks).

### Setup

1. Create/open your **Attendance** spreadsheet.
2. Open **Extensions → Apps Script**.
3. Copy/paste `AttendanceSync.gs` into the Apps Script editor.
4. Run `attendanceConfigure()` once and paste your spreadsheet IDs into Script Properties.
5. Run `attendanceInstallTriggers()` once.

### Triggers installed

- `attendanceOnGroupsEdit(e)` → installable `onEdit` trigger for the Groups spreadsheet.
- `attendanceSyncAll()` → time-driven trigger (every hour) for safety.

### Notes

- Sheet names starting with `_` are ignored by default.
- You can ignore specific group/subject sheets via Script Properties:
  - `ATT_IGNORE_GROUP_SHEETS` (CSV)
  - `ATT_IGNORE_SUBJECT_SHEETS` (CSV)
