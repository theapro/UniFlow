import { google } from "googleapis";
import { env } from "../../config/env";

function colIndexToA1(idx0: number): string {
  let n = idx0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export type GradesSheetsClientOptions = {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
};

function loadPrivateKey(): string {
  if (env.googleSheetsPrivateKeyBase64) {
    return Buffer.from(env.googleSheetsPrivateKeyBase64, "base64").toString(
      "utf8",
    );
  }

  if (env.googleSheetsPrivateKey) {
    return env.googleSheetsPrivateKey.replace(/\\n/g, "\n");
  }

  return "";
}

export class GradesSheetsClient {
  private readonly spreadsheetId: string;
  private readonly sheets = google.sheets("v4");
  private readonly auth;
  private sheetIdByTitleCache: Map<string, number> | null = null;

  constructor(opts?: Partial<GradesSheetsClientOptions>) {
    const spreadsheetId =
      opts?.spreadsheetId ?? env.gradesSheetsSpreadsheetId ?? "";
    const clientEmail = opts?.clientEmail ?? env.googleSheetsClientEmail ?? "";
    const privateKey = opts?.privateKey ?? loadPrivateKey();

    if (!spreadsheetId) throw new Error("GRADES_SHEETS_MISSING_SPREADSHEET_ID");
    if (!clientEmail) throw new Error("GRADES_SHEETS_MISSING_CLIENT_EMAIL");
    if (!privateKey) throw new Error("GRADES_SHEETS_MISSING_PRIVATE_KEY");

    this.spreadsheetId = spreadsheetId;

    this.auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  async getSpreadsheetMetadata(): Promise<{
    spreadsheetId: string;
    title?: string;
    sheetTitles: string[];
    sheetIdByTitle: Record<string, number>;
  }> {
    const res = await this.sheets.spreadsheets.get({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      fields:
        "spreadsheetId,properties.title,sheets.properties.sheetId,sheets.properties.title",
    });

    const sheetIdByTitle: Record<string, number> = {};
    const sheetTitles: string[] = [];

    for (const s of res.data.sheets ?? []) {
      const title = s.properties?.title;
      const sheetId = s.properties?.sheetId;
      if (typeof title === "string" && title) {
        sheetTitles.push(title);
        if (typeof sheetId === "number") sheetIdByTitle[title] = sheetId;
      }
    }

    this.sheetIdByTitleCache = new Map(
      Object.entries(sheetIdByTitle).map(([k, v]) => [k, v]),
    );

    return {
      spreadsheetId: res.data.spreadsheetId ?? this.spreadsheetId,
      title: res.data.properties?.title ?? undefined,
      sheetTitles,
      sheetIdByTitle,
    };
  }

  async createSheetTab(opts: {
    title: string;
  }): Promise<{ sheetId: number | null }> {
    const res = await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: opts.title,
              },
            },
          },
        ],
      },
    });

    const reply = res.data.replies?.[0]?.addSheet;
    const sheetId =
      typeof reply?.properties?.sheetId === "number"
        ? reply.properties.sheetId
        : null;

    this.sheetIdByTitleCache = null;
    return { sheetId };
  }

  async getSheetValuesRange(sheetName: string, a1Range: string) {
    const range = `${sheetName}!${a1Range}`;
    const res = await this.sheets.spreadsheets.values.get({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range,
      majorDimension: "ROWS",
    });

    const values = (res.data.values ?? []) as unknown[][];
    return values.map((row: unknown[]) =>
      (row ?? []).map((cell: unknown) => String(cell ?? "")),
    );
  }

  async setRowValues(opts: {
    sheetName: string;
    rowNumber: number;
    values: string[];
    startColIndex0?: number;
  }): Promise<void> {
    const start = Math.max(opts.startColIndex0 ?? 0, 0);
    const endIdx0 = start + Math.max(opts.values.length - 1, 0);
    const startCol = colIndexToA1(start);
    const endCol = colIndexToA1(endIdx0);
    const range = `${opts.sheetName}!${startCol}${opts.rowNumber}:${endCol}${opts.rowNumber}`;

    await this.sheets.spreadsheets.values.update({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [opts.values],
      },
    });
  }

  async setRangeValues(opts: {
    sheetName: string;
    startRowNumber: number;
    startColIndex0: number;
    values: string[][];
    valueInputOption?: "RAW" | "USER_ENTERED";
  }): Promise<void> {
    const startRow = Math.max(1, Math.floor(opts.startRowNumber));
    const startCol = Math.max(0, Math.floor(opts.startColIndex0));
    const rows = opts.values ?? [];
    const rowCount = rows.length;
    const colCount = Math.max(0, ...rows.map((r) => (r ?? []).length));

    if (rowCount === 0 || colCount === 0) return;

    const endRow = startRow + rowCount - 1;
    const endColIdx0 = startCol + colCount - 1;

    const startColA1 = colIndexToA1(startCol);
    const endColA1 = colIndexToA1(endColIdx0);
    const range = `${opts.sheetName}!${startColA1}${startRow}:${endColA1}${endRow}`;

    // Normalize rectangular matrix (Sheets API expects consistent columns)
    const rect: string[][] = rows.map((r) => {
      const row = (r ?? []).map((c) => String(c ?? ""));
      if (row.length === colCount) return row;
      return [
        ...row,
        ...Array.from({ length: colCount - row.length }, () => ""),
      ];
    });

    await this.sheets.spreadsheets.values.update({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: opts.valueInputOption ?? "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: rect,
      },
    });
  }

  async appendRow(opts: {
    sheetName: string;
    values: string[];
    a1Range?: string;
  }): Promise<number | null> {
    const range = `${opts.sheetName}!${opts.a1Range ?? "A:ZZ"}`;
    const res = await this.sheets.spreadsheets.values.append({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      includeValuesInResponse: false,
      requestBody: {
        majorDimension: "ROWS",
        values: [opts.values],
      },
    });

    const updatedRange = res.data.updates?.updatedRange;
    const m =
      typeof updatedRange === "string"
        ? /!(?:[A-Z]+)(\d+):/.exec(updatedRange)
        : null;
    return m ? Number(m[1]) : null;
  }
}
