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

export type TeachersSheetsClientOptions = {
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

export class TeachersSheetsClient {
  private readonly spreadsheetId: string;
  private readonly sheets = google.sheets("v4");
  private readonly auth;
  private sheetIdByTitleCache: Map<string, number> | null = null;

  constructor(opts?: Partial<TeachersSheetsClientOptions>) {
    const spreadsheetId =
      opts?.spreadsheetId ?? env.teachersSheetsSpreadsheetId ?? "";
    const clientEmail = opts?.clientEmail ?? env.googleSheetsClientEmail ?? "";
    const privateKey = opts?.privateKey ?? loadPrivateKey();

    if (!spreadsheetId)
      throw new Error("TEACHERS_SHEETS_MISSING_SPREADSHEET_ID");
    if (!clientEmail) throw new Error("TEACHERS_SHEETS_MISSING_CLIENT_EMAIL");
    if (!privateKey) throw new Error("TEACHERS_SHEETS_MISSING_PRIVATE_KEY");

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
      if (typeof title === "string" && title) sheetTitles.push(title);
      if (typeof title === "string" && title && typeof sheetId === "number") {
        sheetIdByTitle[title] = sheetId;
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

  async getSheetIdByTitle(sheetTitle: string): Promise<number> {
    if (this.sheetIdByTitleCache?.has(sheetTitle)) {
      return this.sheetIdByTitleCache.get(sheetTitle)!;
    }

    const meta = await this.getSpreadsheetMetadata();
    const id = meta.sheetIdByTitle[sheetTitle];
    if (typeof id !== "number") {
      throw new Error(`SHEET_ID_NOT_FOUND:${sheetTitle}`);
    }
    return id;
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

  async renameSheetTab(opts: {
    fromTitle: string;
    toTitle: string;
  }): Promise<void> {
    if (opts.fromTitle === opts.toTitle) return;
    const sheetId = await this.getSheetIdByTitle(opts.fromTitle);

    await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                title: opts.toTitle,
              },
              fields: "title",
            },
          },
        ],
      },
    });

    this.sheetIdByTitleCache = null;
  }

  async deleteSheetTab(opts: { title: string }): Promise<void> {
    const title = String(opts.title ?? "").trim();
    if (!title) throw new Error("TAB_REQUIRED");

    const sheetId = await this.getSheetIdByTitle(title);

    await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId,
            },
          },
        ],
      },
    });

    this.sheetIdByTitleCache = null;
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

  async batchUpdateCells(opts: {
    sheetName: string;
    rowNumber: number;
    colToValue: Record<string, string>;
  }): Promise<void> {
    const data = Object.entries(opts.colToValue).map(([colAlpha, value]) => ({
      range: `${opts.sheetName}!${colAlpha}${opts.rowNumber}`,
      values: [[value]],
    }));

    if (data.length === 0) return;

    await this.sheets.spreadsheets.values.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });
  }

  async appendRow(opts: {
    sheetName: string;
    values: string[];
  }): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range: `${opts.sheetName}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        majorDimension: "ROWS",
        values: [opts.values],
      },
    });
  }
}
