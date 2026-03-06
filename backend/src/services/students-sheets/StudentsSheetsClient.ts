import { google } from "googleapis";
import { env } from "../../config/env";

export type StudentsSheetsClientOptions = {
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

export class StudentsSheetsClient {
  private readonly spreadsheetId: string;
  private readonly sheets = google.sheets("v4");
  private readonly auth;
  private sheetIdByTitleCache: Map<string, number> | null = null;

  constructor(opts?: Partial<StudentsSheetsClientOptions>) {
    const spreadsheetId =
      opts?.spreadsheetId ?? env.studentsSheetsSpreadsheetId ?? "";
    const clientEmail = opts?.clientEmail ?? env.googleSheetsClientEmail ?? "";
    const privateKey = opts?.privateKey ?? loadPrivateKey();

    if (!spreadsheetId)
      throw new Error("STUDENTS_SHEETS_MISSING_SPREADSHEET_ID");
    if (!clientEmail) throw new Error("STUDENTS_SHEETS_MISSING_CLIENT_EMAIL");
    if (!privateKey) throw new Error("STUDENTS_SHEETS_MISSING_PRIVATE_KEY");

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

  async getSheetIdByTitle(sheetTitle: string): Promise<number> {
    if (this.sheetIdByTitleCache?.has(sheetTitle)) {
      return this.sheetIdByTitleCache.get(sheetTitle)!;
    }

    const meta = await this.getSpreadsheetMetadata();
    const id = meta.sheetIdByTitle[sheetTitle];
    if (typeof id !== "number")
      throw new Error(`SHEET_ID_NOT_FOUND:${sheetTitle}`);
    return id;
  }

  async copyRowFormatting(opts: {
    sheetName: string;
    fromRowNumber: number;
    toRowNumber: number;
    fromColIndex0?: number;
    toColIndex0?: number;
  }): Promise<void> {
    if (opts.fromRowNumber === opts.toRowNumber) return;

    const sheetId = await this.getSheetIdByTitle(opts.sheetName);
    const fromRowIndex = Math.max(opts.fromRowNumber - 1, 0);
    const toRowIndex = Math.max(opts.toRowNumber - 1, 0);

    const startColIndex = Math.max(opts.fromColIndex0 ?? 0, 0);
    const endColIndex = Math.max(opts.toColIndex0 ?? 26, startColIndex + 1);

    await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            copyPaste: {
              source: {
                sheetId,
                startRowIndex: fromRowIndex,
                endRowIndex: fromRowIndex + 1,
                startColumnIndex: startColIndex,
                endColumnIndex: endColIndex,
              },
              destination: {
                sheetId,
                startRowIndex: toRowIndex,
                endRowIndex: toRowIndex + 1,
                startColumnIndex: startColIndex,
                endColumnIndex: endColIndex,
              },
              pasteType: "PASTE_FORMAT",
              pasteOrientation: "NORMAL",
            },
          },
        ],
      },
    });
  }

  async deleteRow(opts: {
    sheetName: string;
    rowNumber: number;
  }): Promise<void> {
    const sheetId = await this.getSheetIdByTitle(opts.sheetName);
    const rowIndex = Math.max(opts.rowNumber - 1, 0);

    await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
  }

  async getSheetValues(sheetName: string): Promise<string[][]> {
    return this.getSheetValuesRange(sheetName, "A1:K");
  }

  async getSheetValuesRange(
    sheetName: string,
    a1Range: string,
  ): Promise<string[][]> {
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
    const data = Object.entries(opts.colToValue).map(([colA1, value]) => ({
      range: `${opts.sheetName}!${colA1}${opts.rowNumber}`,
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
    a1Range?: string;
  }): Promise<number | null> {
    const range = `${opts.sheetName}!${opts.a1Range ?? "A:Z"}`;
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
    // Example: "23C!A4:Z4"
    const m =
      typeof updatedRange === "string"
        ? /!(?:[A-Z]+)(\d+):/.exec(updatedRange)
        : null;
    return m ? Number(m[1]) : null;
  }

  async clearRow(opts: {
    sheetName: string;
    rowNumber: number;
    a1Range?: string;
  }): Promise<void> {
    const range = `${opts.sheetName}!${opts.a1Range ?? `A${opts.rowNumber}:Z${opts.rowNumber}`}`;
    await this.sheets.spreadsheets.values.clear({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range,
    });
  }
}
