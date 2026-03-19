export function formatGoogleSheetsConnectionError(err: unknown): string {
  const anyErr = err as any;

  // Prefer explicit message if it is one of our internal codes.
  const message =
    typeof anyErr?.message === "string" ? anyErr.message : String(err ?? "");

  // googleapis errors often include `code` (HTTP status) and `errors[]`.
  const code =
    typeof anyErr?.code === "number"
      ? anyErr.code
      : typeof anyErr?.status === "number"
        ? anyErr.status
        : typeof anyErr?.response?.status === "number"
          ? anyErr.response.status
          : null;

  const lower = message.toLowerCase();

  // Common credential/config issues.
  if (lower.includes("missing_spreadsheet_id")) return message;
  if (lower.includes("missing_client_email")) return message;
  if (lower.includes("missing_private_key")) return message;

  // Permission / share issues.
  if (code === 403) {
    return "Spreadsheetga kirish rad etildi (403). Service account email’ini Google Sheet bilan share qiling.";
  }

  // Not found OR not shared often both appear as 404 for service accounts.
  if (code === 404) {
    return "Spreadsheet topilmadi (404) yoki service account’ga share qilinmagan. Spreadsheet ID’ni tekshiring va service account email’ini share qiling.";
  }

  // Rate limits / transient.
  if (code === 429) {
    return "Google Sheets rate limit (429). Bir ozdan keyin qayta urinib ko‘ring.";
  }

  if (
    lower.includes("requested entity was not found") ||
    lower.includes("not found")
  ) {
    return "Spreadsheet topilmadi yoki share qilinmagan. Spreadsheet ID’ni tekshiring.";
  }

  if (lower.includes("the caller does not have permission")) {
    return "Spreadsheet siz bilan share qilinmagan. Service account email’ini Google Sheet’ga share qiling.";
  }

  // Fallback to raw message (still useful for debugging).
  return message || "SHEETS_CONNECTION_FAILED";
}
