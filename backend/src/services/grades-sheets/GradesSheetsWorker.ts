import type { PrismaClient } from "@prisma/client";

import { GradesSheetsSyncService } from "./GradesSheetsSyncService";
import { SheetsSettingsService } from "../sheets/SheetsSettingsService";
import { env } from "../../config/env";

export class GradesSheetsWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private nextAllowedRunAt = 0;
  private failures = 0;
  private readonly sheetsSettings = new SheetsSettingsService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly opts: {
      intervalMs: number;
    },
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;

    const runOnce = async () => {
      if (this.running) return;
      if (!env.gradesSheetsWorkerEnabled) return;
      if (Date.now() < this.nextAllowedRunAt) return;

      this.running = true;

      const svc = new GradesSheetsSyncService(this.prisma);

      try {
        const [gradesSpreadsheetId, studentsSpreadsheetId] = await Promise.all([
          this.sheetsSettings.getEffectiveGradesSpreadsheetId(this.prisma),
          this.sheetsSettings.getEffectiveStudentsSpreadsheetId(this.prisma),
        ]);

        await svc.syncOnce({
          reason: "worker",
          spreadsheetId: gradesSpreadsheetId ?? undefined,
          studentsSpreadsheetId: studentsSpreadsheetId ?? undefined,
        });

        this.failures = 0;
        this.nextAllowedRunAt = 0;
      } catch (e) {
        this.failures += 1;
        const delayMs = Math.min(
          15 * 60_000,
          Math.max(5_000, this.opts.intervalMs) *
            Math.pow(2, Math.min(this.failures, 6)),
        );
        this.nextAllowedRunAt = Date.now() + delayMs;
      } finally {
        this.running = false;
      }
    };

    await runOnce();
    this.timer = setInterval(runOnce, Math.max(this.opts.intervalMs, 5_000));
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
