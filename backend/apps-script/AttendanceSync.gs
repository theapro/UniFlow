/**
 * Attendance spreadsheet sync (Groups x Subjects) for Google Sheets.
 *
 * You have 3 spreadsheets:
 *  - Students & Groups spreadsheet: each tab = GROUP, rows = students
 *  - Teachers & Subjects spreadsheet: each tab = SUBJECT (teachers inside; only tab names matter here)
 *  - Attendance spreadsheet: this script creates/updates tabs named GROUP_SUBJECT
 *
 * Attendance tab rules:
 *  - Columns A-C are fixed and managed by the sync:
 *      A: student_uuid
 *      B: student_number
 *      C: fullname
 *  - Columns D+ are lesson date columns (e.g. "06/01") and are NEVER overwritten by sync.
 *  - When new students appear in a GROUP tab, they are appended to every GROUP_SUBJECT tab.
 *
 * Recommended:
 *  - Put this code in ONE Apps Script project (any spreadsheet is fine).
 *  - Run attendanceConfigure() once to set properties.
 *  - Run attendanceInstallTriggers() once (creates an onEdit trigger for the Groups spreadsheet
 *    and an hourly time-driven full sync).
 */

function attendanceGetConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    groupsSpreadsheetId: props.getProperty("ATT_GROUPS_SPREADSHEET_ID"),
    subjectsSpreadsheetId: props.getProperty("ATT_SUBJECTS_SPREADSHEET_ID"),
    attendanceSpreadsheetId: props.getProperty("ATT_ATTENDANCE_SPREADSHEET_ID"),
    // Optional CSV lists.
    ignoreGroupSheetsCsv: props.getProperty("ATT_IGNORE_GROUP_SHEETS"),
    ignoreSubjectSheetsCsv: props.getProperty("ATT_IGNORE_SUBJECT_SHEETS"),
  };
}

/**
 * Run once: set spreadsheet IDs + optional ignore lists.
 */
function attendanceConfigure() {
  PropertiesService.getScriptProperties().setProperties({
    // Spreadsheet that contains GROUP tabs like "Frontend-21", "Backend-19".
    ATT_GROUPS_SPREADSHEET_ID: "PASTE_STUDENTS_GROUPS_SPREADSHEET_ID",

    // Spreadsheet that contains SUBJECT tabs like "Python", "English".
    // Only tab names are used by this script.
    ATT_SUBJECTS_SPREADSHEET_ID: "PASTE_TEACHERS_SUBJECTS_SPREADSHEET_ID",

    // Spreadsheet where GROUP_SUBJECT attendance tabs will be created.
    ATT_ATTENDANCE_SPREADSHEET_ID: "PASTE_ATTENDANCE_SPREADSHEET_ID",

    // Optional: comma-separated tab names to ignore.
    // Example: "README,Template,_meta"
    ATT_IGNORE_GROUP_SHEETS: "",
    ATT_IGNORE_SUBJECT_SHEETS: "",
  });
}

/**
 * Run once: install triggers.
 * - onEdit on the Groups spreadsheet: fast sync of just the edited group.
 * - hourly time-driven: full sync (covers new subjects/groups, missed edits, etc.).
 */
function attendanceInstallTriggers() {
  var cfg = attendanceGetConfig_();
  if (
    !cfg.groupsSpreadsheetId ||
    !cfg.subjectsSpreadsheetId ||
    !cfg.attendanceSpreadsheetId
  ) {
    throw new Error(
      "Missing spreadsheet IDs. Run attendanceConfigure() and set ATT_*_SPREADSHEET_ID values.",
    );
  }

  // Remove existing triggers for these handler functions to avoid duplicates.
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "attendanceOnGroupsEdit" || fn === "attendanceSyncAll") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Install onEdit trigger bound to the Groups spreadsheet.
  var groupsSs = SpreadsheetApp.openById(cfg.groupsSpreadsheetId);
  ScriptApp.newTrigger("attendanceOnGroupsEdit")
    .forSpreadsheet(groupsSs)
    .onEdit()
    .create();

  // Install a safety-net periodic sync.
  ScriptApp.newTrigger("attendanceSyncAll").timeBased().everyHours(1).create();

  Logger.log("Attendance triggers installed.");
}

/**
 * Trigger handler: when the Groups spreadsheet is edited, sync only that group.
 */
function attendanceOnGroupsEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var groupName = sheet.getName();

    if (attendanceIsIgnoredGroupSheet_(groupName)) return;

    // Ignore header edits.
    if (e.range.getRow() === 1) return;

    // Heuristic: only sync if the row contains a student_uuid.
    // This avoids syncing on edits to empty rows or side-notes.
    var rowValues = sheet
      .getRange(e.range.getRow(), 1, 1, sheet.getLastColumn())
      .getValues()[0];
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var uuidCol = attendanceFindHeaderIndex_(headers, [
      "student_uuid",
      "studentUuid",
      "uuid",
      "id",
    ]);

    if (uuidCol < 0) {
      // If we can't reliably find uuid column, fall back to syncing on any edit.
      attendanceSyncGroup(groupName);
      return;
    }

    var uuid = String(rowValues[uuidCol] || "").trim();
    if (!uuid) return;

    attendanceSyncGroup(groupName);
  } catch (err) {
    console.log("attendanceOnGroupsEdit error", String(err));
  }
}

/**
 * Manual command: sync everything (all groups x all subjects).
 */
function attendanceSyncAll() {
  var cfg = attendanceGetConfig_();
  var groupsSs = SpreadsheetApp.openById(cfg.groupsSpreadsheetId);
  var subjectsSs = SpreadsheetApp.openById(cfg.subjectsSpreadsheetId);

  var groupNames = attendanceListSheetNames_(
    groupsSs,
    attendanceIsIgnoredGroupSheet_,
  );
  var subjectNames = attendanceListSheetNames_(
    subjectsSs,
    attendanceIsIgnoredSubjectSheet_,
  );

  for (var g = 0; g < groupNames.length; g++) {
    attendanceSyncGroup_(groupsSs, subjectNames, groupNames[g]);
  }

  Logger.log(
    "attendanceSyncAll done: groups=" +
      groupNames.length +
      " subjects=" +
      subjectNames.length,
  );
}

/**
 * Manual command: sync one group across all subjects.
 */
function attendanceSyncGroup(groupName) {
  var cfg = attendanceGetConfig_();
  var groupsSs = SpreadsheetApp.openById(cfg.groupsSpreadsheetId);
  var subjectsSs = SpreadsheetApp.openById(cfg.subjectsSpreadsheetId);

  var subjectNames = attendanceListSheetNames_(
    subjectsSs,
    attendanceIsIgnoredSubjectSheet_,
  );
  attendanceSyncGroup_(groupsSs, subjectNames, groupName);
}

function attendanceSyncGroup_(groupsSs, subjectNames, groupName) {
  if (!groupName) return;
  if (attendanceIsIgnoredGroupSheet_(groupName)) return;

  var groupSheet = groupsSs.getSheetByName(groupName);
  if (!groupSheet) {
    Logger.log("Group sheet not found: " + groupName);
    return;
  }

  var students = attendanceReadStudentsFromGroupSheet_(groupSheet);

  for (var s = 0; s < subjectNames.length; s++) {
    attendanceEnsureAndSyncTab_(groupName, subjectNames[s], students);
  }
}

function attendanceEnsureAndSyncTab_(groupName, subjectName, students) {
  var cfg = attendanceGetConfig_();
  var attendanceSs = SpreadsheetApp.openById(cfg.attendanceSpreadsheetId);

  var tabName = attendanceBuildAttendanceTabName_(groupName, subjectName);
  var sheet = attendanceSs.getSheetByName(tabName);

  if (!sheet) {
    sheet = attendanceSs.insertSheet(tabName);
    attendanceSetupAttendanceSheet_(sheet);
    attendanceWriteHeaderIfNeeded_(sheet);
  } else {
    // Ensure header exists (A1:C1) without touching D+.
    attendanceWriteHeaderIfNeeded_(sheet);
    attendanceSetupAttendanceSheet_(sheet);
  }

  attendanceSyncStudentsIntoAttendanceSheet_(sheet, students);
}

function attendanceSetupAttendanceSheet_(sheet) {
  // Make the sheet usable for teachers.
  try {
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(3);
  } catch (e) {
    // Ignore.
  }

  // Best-effort: protect first three columns so teachers don't accidentally edit IDs.
  // Note: protections can be domain-dependent.
  try {
    var maxRows = Math.max(sheet.getMaxRows() - 1, 1);
    for (var col = 1; col <= 3; col++) {
      var range = sheet.getRange(2, col, maxRows, 1);
      var protection = range.protect();
      protection.setDescription("Attendance sync protected columns");

      // Allow spreadsheet owner to edit.
      protection.removeEditors(protection.getEditors());
      protection.addEditor(Session.getEffectiveUser());

      if (protection.canDomainEdit()) {
        protection.setDomainEdit(false);
      }
    }
  } catch (e2) {
    // Ignore protection failures.
  }
}

function attendanceWriteHeaderIfNeeded_(sheet) {
  var headers = ["student_uuid", "student_number", "fullname"];

  // Only write A1:C1.
  sheet.getRange(1, 1, 1, 3).setValues([headers]);

  // Light formatting.
  try {
    var headerRange = sheet.getRange(
      1,
      1,
      1,
      Math.max(3, sheet.getLastColumn()),
    );
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f1f5f9");
  } catch (e) {
    // Ignore.
  }
}

function attendanceReadStudentsFromGroupSheet_(groupSheet) {
  var lastRow = groupSheet.getLastRow();
  var lastCol = groupSheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  var values = groupSheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];

  var uuidIdx = attendanceFindHeaderIndex_(headers, [
    "student_uuid",
    "studentUuid",
    "uuid",
  ]);
  var numberIdx = attendanceFindHeaderIndex_(headers, [
    "student_number",
    "studentNo",
    "student_number ",
    "studentNumber",
  ]);
  var nameIdx = attendanceFindHeaderIndex_(headers, [
    "fullname",
    "fullName",
    "name",
  ]);

  if (uuidIdx < 0) {
    throw new Error(
      "Group sheet '" +
        groupSheet.getName() +
        "' is missing student_uuid header.",
    );
  }

  var students = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var uuid = String(row[uuidIdx] || "").trim();
    if (!uuid) continue;

    var studentNo = numberIdx >= 0 ? String(row[numberIdx] || "").trim() : "";
    var fullName = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";

    students.push({
      student_uuid: uuid,
      student_number: studentNo,
      fullname: fullName,
    });
  }

  return students;
}

function attendanceSyncStudentsIntoAttendanceSheet_(attendanceSheet, students) {
  // Build index from existing attendance rows (uuid -> row number).
  var lastRow = attendanceSheet.getLastRow();
  var lastCol = Math.max(attendanceSheet.getLastColumn(), 3);

  var existing = {};
  if (lastRow >= 2) {
    var existingValues = attendanceSheet
      .getRange(2, 1, lastRow - 1, 3)
      .getValues();
    for (var i = 0; i < existingValues.length; i++) {
      var uuid = String(existingValues[i][0] || "").trim();
      if (!uuid) continue;
      existing[uuid] = {
        row: i + 2,
        student_number: String(existingValues[i][1] || "").trim(),
        fullname: String(existingValues[i][2] || "").trim(),
      };
    }
  }

  // Batch updates for existing rows (A-C only).
  var updates = [];
  for (var s = 0; s < students.length; s++) {
    var st = students[s];
    var ex = existing[st.student_uuid];
    if (ex) {
      // Only update if changed; do not touch attendance columns.
      if (
        ex.student_number !== st.student_number ||
        ex.fullname !== st.fullname
      ) {
        updates.push({
          row: ex.row,
          values: [[st.student_uuid, st.student_number, st.fullname]],
        });
      }
    }
  }

  for (var u = 0; u < updates.length; u++) {
    attendanceSheet
      .getRange(updates[u].row, 1, 1, 3)
      .setValues(updates[u].values);
  }

  // Append missing students.
  var toAppend = [];
  for (var s2 = 0; s2 < students.length; s2++) {
    var st2 = students[s2];
    if (existing[st2.student_uuid]) continue;

    var rowArr = [];
    rowArr.push(st2.student_uuid);
    rowArr.push(st2.student_number);
    rowArr.push(st2.fullname);

    // Preserve teacher-entered date columns: append blank cells to match current width.
    while (rowArr.length < lastCol) {
      rowArr.push("");
    }

    toAppend.push(rowArr);
  }

  if (toAppend.length > 0) {
    attendanceSheet
      .getRange(lastRow + 1, 1, toAppend.length, lastCol)
      .setValues(toAppend);
  }

  // Keep A-C readable.
  try {
    attendanceSheet.autoResizeColumns(1, 3);
  } catch (e) {
    // Ignore.
  }
}

function attendanceBuildAttendanceTabName_(groupName, subjectName) {
  // Google Sheets name constraints:
  // - max length 100
  // - cannot contain: : \ / ? * [ ]
  var raw =
    String(groupName || "").trim() + "_" + String(subjectName || "").trim();
  var cleaned = raw.replace(/[:\\/\?\*\[\]]/g, "-");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length > 100) cleaned = cleaned.substring(0, 100);
  return cleaned;
}

function attendanceListSheetNames_(ss, ignoreFn) {
  var sheets = ss.getSheets();
  var out = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (ignoreFn && ignoreFn(name)) continue;
    out.push(name);
  }
  return out;
}

function attendanceParseCsv_(csv) {
  if (!csv) return {};
  var parts = String(csv)
    .split(",")
    .map(function (s) {
      return String(s || "").trim();
    })
    .filter(function (s) {
      return !!s;
    });

  var map = {};
  for (var i = 0; i < parts.length; i++) {
    map[parts[i]] = true;
  }
  return map;
}

function attendanceIsIgnoredGroupSheet_(sheetName) {
  if (!sheetName) return true;
  var name = String(sheetName);

  // Common patterns to ignore.
  if (name.charAt(0) === "_") return true;

  var cfg = attendanceGetConfig_();
  var ignore = attendanceParseCsv_(cfg.ignoreGroupSheetsCsv);
  return !!ignore[name];
}

function attendanceIsIgnoredSubjectSheet_(sheetName) {
  if (!sheetName) return true;
  var name = String(sheetName);
  if (name.charAt(0) === "_") return true;

  var cfg = attendanceGetConfig_();
  var ignore = attendanceParseCsv_(cfg.ignoreSubjectSheetsCsv);
  return !!ignore[name];
}

function attendanceFindHeaderIndex_(headersRow, possibleNames) {
  if (!headersRow || !possibleNames) return -1;

  var norm = function (v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  };

  var target = {};
  for (var i = 0; i < possibleNames.length; i++) {
    target[norm(possibleNames[i])] = true;
  }

  for (var c = 0; c < headersRow.length; c++) {
    var h = norm(headersRow[c]);
    if (target[h]) return c;
  }

  return -1;
}
