/**
 * UniFlow Spreadsheet setup (create everything from scratch)
 *
 * You said you want to recreate all sheets from zero.
 * This file creates a brand-new spreadsheet with the required tabs + headers.
 *
 * Usage:
 * 1) Open any Google Sheet -> Extensions -> Apps Script
 * 2) Add this file
 * 3) Run `createNewUniFlowSpreadsheet()` once
 * 4) Copy the returned Spreadsheet ID into your backend env:
 *    GOOGLE_SHEETS_SPREADSHEET_ID=...
 *
 * Notes:
 * - Headers are designed for TWO-WAY sync:
 *   - `id` (DB UUID)
 *   - `dbUpdatedAt` (DB updatedAt ISO string)
 * - Fields match the backend allowlist in SheetsInboundService:
 *   - Students: fullName, studentNo, groupId
 *   - Teachers: fullName, staffNo, departmentId
 */

function createNewUniFlowSpreadsheet() {
  var name =
    "UniFlow Sync " +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm",
    );
  var ss = SpreadsheetApp.create(name);

  // Remove default sheet(s)
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    ss.deleteSheet(sheets[i]);
  }

  // Create tabs
  var students = ss.insertSheet("Students");
  var teachers = ss.insertSheet("Teachers");
  var attendance = ss.insertSheet("Attendance");
  var ai = ss.insertSheet("AI Conversations");

  setupStudentsSheet_(students);
  setupTeachersSheet_(teachers);
  setupAttendanceSheet_(attendance);
  setupAiSheet_(ai);

  // Optionally, set the first sheet as active
  ss.setActiveSheet(students);

  Logger.log("Created UniFlow spreadsheet: " + ss.getUrl());
  Logger.log("Spreadsheet ID: " + ss.getId());

  return {
    spreadsheetId: ss.getId(),
    url: ss.getUrl(),
  };
}

function setupStudentsSheet_(sheet) {
  // Keep columns small + explicit.
  // If you add more fields, also update backend allowlist.
  var headers = ["id", "fullName", "studentNo", "groupId", "dbUpdatedAt"];
  applyHeaderRow_(sheet, headers);

  // Make ID and dbUpdatedAt harder to edit accidentally.
  protectColumns_(sheet, [1, headers.length]);
}

function setupTeachersSheet_(sheet) {
  var headers = ["id", "fullName", "staffNo", "departmentId", "dbUpdatedAt"];
  applyHeaderRow_(sheet, headers);
  protectColumns_(sheet, [1, headers.length]);
}

function setupAttendanceSheet_(sheet) {
  // Analytics / append-only (DB -> Sheets worker).
  // Not intended for two-way edits.
  var headers = ["student", "subject", "date", "status", "teacher"];
  applyHeaderRow_(sheet, headers);
}

function setupAiSheet_(sheet) {
  // Analytics / append-only (DB -> Sheets worker).
  var headers = ["user", "question", "aiResponse", "timestamp"];
  applyHeaderRow_(sheet, headers);
}

function applyHeaderRow_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  // Basic formatting
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#f1f5f9");

  // Add filter
  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).createFilter();

  // Auto-resize columns (within reason)
  sheet.autoResizeColumns(1, headers.length);
}

function protectColumns_(sheet, columnIndexes) {
  // Protection is best-effort; some accounts/domains may behave differently.
  try {
    for (var i = 0; i < columnIndexes.length; i++) {
      var col = columnIndexes[i];
      var range = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
      var protection = range.protect();
      protection.setDescription("UniFlow protected column");

      // Allow the spreadsheet owner to edit.
      protection.removeEditors(protection.getEditors());
      protection.addEditor(Session.getEffectiveUser());

      if (protection.canDomainEdit()) {
        protection.setDomainEdit(false);
      }
    }
  } catch (e) {
    Logger.log("Protection failed (ignored): " + String(e));
  }
}
