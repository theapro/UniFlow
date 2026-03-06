import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";

export class StudentsSheetsOutboxService {
  constructor(private readonly prisma: PrismaClient) {}

  private getSpreadsheetId(): string | null {
    return env.studentsSheetsSpreadsheetId ?? null;
  }

  async enqueueUpsert(opts: {
    studentId: string;
    targetSheetTitle: string | null;
  }): Promise<void> {
    if (!env.studentsSheetsDbToSheetsEnabled) return;

    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) return;
    if (!opts.targetSheetTitle) return;

    await this.prisma.studentsSheetsOutboxEvent.upsert({
      where: {
        spreadsheetId_studentId: { spreadsheetId, studentId: opts.studentId },
      },
      update: {
        type: "UPSERT",
        targetSheetTitle: opts.targetSheetTitle,
        status: "PENDING",
        nextAttemptAt: new Date(),
        lastError: null,
      },
      create: {
        spreadsheetId,
        studentId: opts.studentId,
        type: "UPSERT",
        targetSheetTitle: opts.targetSheetTitle,
        status: "PENDING",
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    });
  }

  async enqueueDelete(opts: {
    studentId: string;
    lastKnownSheetTitle: string | null;
    payload?: any;
  }): Promise<void> {
    if (!env.studentsSheetsDbToSheetsEnabled) return;

    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) return;

    await this.prisma.studentsSheetsOutboxEvent.upsert({
      where: {
        spreadsheetId_studentId: { spreadsheetId, studentId: opts.studentId },
      },
      update: {
        type: "DELETE",
        targetSheetTitle: opts.lastKnownSheetTitle,
        payload: opts.payload ?? undefined,
        status: "PENDING",
        nextAttemptAt: new Date(),
        lastError: null,
      },
      create: {
        spreadsheetId,
        studentId: opts.studentId,
        type: "DELETE",
        targetSheetTitle: opts.lastKnownSheetTitle,
        payload: opts.payload ?? undefined,
        status: "PENDING",
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    });
  }
}
