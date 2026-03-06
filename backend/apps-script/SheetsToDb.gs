/**
 * UniFlow two-way sync (Sheets -> DB) via Apps Script webhook.
 *
 * How it works:
 * - Install an onEdit trigger.
 * - When a user edits a cell, we map the edit to:
 *   - recordId (from the row's `id` column)
 *   - fieldKey (from the header row)
 *   - oldDbUpdatedAt (from the row's `dbUpdatedAt` column)
 * - Send a signed webhook request to the backend.
 * - If backend returns success with newDbUpdatedAt, write it back to `dbUpdatedAt`.
 * - If backend returns 409 conflict, revert the cell to the DB value.
 *
 * Sheet conventions (recommended):
 * - Row 1 is headers.
 * - Required columns: `id`, `dbUpdatedAt`.
 * - Headers must match backend field keys, e.g. `fullName`, `studentNo`, `groupId`.
 */

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    webhookUrl: props.getProperty("UNIFLOW_WEBHOOK_URL"),
    webhookSecret: props.getProperty("UNIFLOW_WEBHOOK_SECRET"),
  };
}

/**
 * Run once to set script properties.
 */
function configure() {
  PropertiesService.getScriptProperties().setProperties({
    // Example:
    // https://YOUR_DOMAIN/api/webhooks/sheets
    // IMPORTANT: Apps Script runs on Google servers, so it CANNOT reach http://localhost.
    // For local dev, use a tunnel (ngrok/cloudflared) and paste the public HTTPS URL here.
    UNIFLOW_WEBHOOK_URL: "https://YOUR_PUBLIC_HTTPS_URL/api/webhooks/sheets",
    UNIFLOW_WEBHOOK_SECRET: "REPLACE_WITH_SHEETS_WEBHOOK_SECRET",
  });
}

/**
 * Run once to create an installable trigger.
 */
function install() {
  // Remove existing triggers to avoid duplicates.
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onSpreadsheetEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("onSpreadsheetEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}

function shouldSuppress_(sheetName, a1, newValue) {
  var props = PropertiesService.getScriptProperties();
  var key = sheetName + "!" + a1 + ":" + String(newValue);
  var last = props.getProperty("UNIFLOW_SUPPRESS_LAST");
  if (last && last === key) {
    props.deleteProperty("UNIFLOW_SUPPRESS_LAST");
    return true;
  }
  return false;
}

function setSuppress_(sheetName, a1, newValue) {
  var props = PropertiesService.getScriptProperties();
  var key = sheetName + "!" + a1 + ":" + String(newValue);
  props.setProperty("UNIFLOW_SUPPRESS_LAST", key);
}

function buildPayloadFromEvent_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();

  // Only allow inbound edits from the sync tabs.
  // (Attendance/AI Conversations are append-only analytics)
  if (sheetName !== "Students" && sheetName !== "Teachers") {
    return null;
  }

  // Ignore header edits.
  if (range.getRow() === 1) return null;

  var a1 = range.getA1Notation();
  var newValue = e.value !== undefined ? e.value : range.getValue();
  var oldValue = e.oldValue !== undefined ? e.oldValue : null;

  if (shouldSuppress_(sheetName, a1, newValue)) {
    return null;
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var editedCol = range.getColumn();
  var fieldKey = String(headers[editedCol - 1] || "").trim();
  if (!fieldKey) return null;

  // Don't propagate changes to helper/version columns.
  if (
    fieldKey === "dbUpdatedAt" ||
    fieldKey === "updatedAt" ||
    fieldKey === "createdAt"
  ) {
    return null;
  }

  var idIndex = headers.indexOf("id");
  if (idIndex < 0) return null;
  var recordId = String(
    sheet.getRange(range.getRow(), idIndex + 1).getValue() || "",
  ).trim();
  if (!recordId) return null;

  var updatedAtIndex = headers.indexOf("dbUpdatedAt");
  var oldDbUpdatedAt = null;
  if (updatedAtIndex >= 0) {
    oldDbUpdatedAt = String(
      sheet.getRange(range.getRow(), updatedAtIndex + 1).getValue() || "",
    ).trim();
  }

  return {
    spreadsheetId: SpreadsheetApp.getActive().getId(),
    sheetName: sheetName,
    recordId: recordId,
    fieldKey: fieldKey,
    newValue: newValue,
    oldValue: oldValue,
    oldDbUpdatedAt: oldDbUpdatedAt || null,
    a1Notation: a1,
    editedAt: new Date().toISOString(),
    // Best-effort. This is usually empty unless you're on a Google Workspace domain.
    editorEmail: (function () {
      try {
        return Session.getActiveUser().getEmail();
      } catch (e) {
        return "";
      }
    })(),
  };
}

function signRequest_(secret, timestamp, body) {
  // Signature: base64(HMAC_SHA256(secret, `${timestamp}.${body}`))
  var bytes = Utilities.computeHmacSha256Signature(
    timestamp + "." + body,
    secret,
  );
  return Utilities.base64Encode(bytes);
}

function postWebhook_(payload) {
  var cfg = getConfig_();
  if (!cfg.webhookUrl || !cfg.webhookSecret) {
    throw new Error(
      "Missing UNIFLOW_WEBHOOK_URL/UNIFLOW_WEBHOOK_SECRET. Run configure().",
    );
  }

  var body = JSON.stringify(payload);
  var timestamp = String(Date.now());
  var signature = signRequest_(cfg.webhookSecret, timestamp, body);

  var url = cfg.webhookUrl.replace(/\/$/, "") + "/edit";

  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: body,
    muteHttpExceptions: true,
    headers: {
      "x-uniflow-timestamp": timestamp,
      "x-uniflow-signature": signature,
    },
  });

  return {
    status: res.getResponseCode(),
    text: res.getContentText(),
  };
}

/**
 * Installable trigger handler.
 */
function onSpreadsheetEdit(e) {
  var payload = buildPayloadFromEvent_(e);
  if (!payload) return;

  try {
    var result = postWebhook_(payload);
    var sheet = e.range.getSheet();

    // Update dbUpdatedAt from response on success.
    if (result.status === 200) {
      var json = JSON.parse(result.text);
      var data = json && json.data;
      var newDbUpdatedAt = data && data.newDbUpdatedAt;

      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var updatedAtIndex = headers.indexOf("dbUpdatedAt");
      if (updatedAtIndex >= 0 && newDbUpdatedAt) {
        setSuppress_(
          sheet.getName(),
          sheet.getRange(e.range.getRow(), updatedAtIndex + 1).getA1Notation(),
          newDbUpdatedAt,
        );
        sheet
          .getRange(e.range.getRow(), updatedAtIndex + 1)
          .setValue(newDbUpdatedAt);
      }
      return;
    }

    // On conflict: revert the edited cell to DB value.
    if (result.status === 409) {
      var json409 = JSON.parse(result.text);
      var currentValue = json409 && json409.data && json409.data.currentValue;
      var currentDbUpdatedAt =
        json409 && json409.data && json409.data.currentDbUpdatedAt;

      setSuppress_(sheet.getName(), e.range.getA1Notation(), currentValue);
      e.range.setValue(currentValue);

      var lastCol2 = sheet.getLastColumn();
      var headers2 = sheet.getRange(1, 1, 1, lastCol2).getValues()[0];
      var updatedAtIndex2 = headers2.indexOf("dbUpdatedAt");
      if (updatedAtIndex2 >= 0 && currentDbUpdatedAt) {
        setSuppress_(
          sheet.getName(),
          sheet.getRange(e.range.getRow(), updatedAtIndex2 + 1).getA1Notation(),
          currentDbUpdatedAt,
        );
        sheet
          .getRange(e.range.getRow(), updatedAtIndex2 + 1)
          .setValue(currentDbUpdatedAt);
      }

      return;
    }

    // Other errors: you can inspect `result.text` in Apps Script logs.
    console.log("Webhook error", result.status, result.text);
  } catch (err) {
    console.log("Webhook exception", String(err));
  }
}
