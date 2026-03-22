import type { PrismaClient } from "@prisma/client";
import { AttendanceSheetsSyncService } from "./AttendanceSheetsSyncService";
import { SheetsSettingsService } from "../sheets/SheetsSettingsService";

export class AttendanceSheetsWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private nextAllowedRunAt = 0;
  private failures = 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly opts: { intervalMs: number },
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;

    const runOnce = async () => {
      if (this.running) return;
      if (Date.now() < this.nextAllowedRunAt) return;
      this.running = true;

      await this.prisma.attendanceSheetsWorkerState.upsert({
        where: { key: "attendance" },
        update: {
          lastHeartbeatAt: new Date(),
          lastStartedAt: new Date(),
          isRunning: true,
          lastError: null,
        },
        create: {
          key: "attendance",
          lastHeartbeatAt: new Date(),
          lastStartedAt: new Date(),
          isRunning: true,
          lastError: null,
        },
      });

      const svc = new AttendanceSheetsSyncService(this.prisma);
      try {
        const settings = new SheetsSettingsService();
        const spreadsheetId =
          await settings.getEffectiveAttendanceSpreadsheetId(this.prisma);
        await svc.syncOnce({
          reason: "worker",
          spreadsheetId: spreadsheetId ?? undefined,
        });
        this.failures = 0;
        this.nextAllowedRunAt = 0;

        await this.prisma.attendanceSheetsWorkerState.update({
          where: { key: "attendance" },
          data: {
            lastHeartbeatAt: new Date(),
            lastFinishedAt: new Date(),
            isRunning: false,
            lastError: null,
          },
        });
      } catch (e) {
        const settings = new SheetsSettingsService();
        const spreadsheetId =
          await settings.getEffectiveAttendanceSpreadsheetId(this.prisma);
        await svc.recordFailure(e, spreadsheetId ?? undefined);
        // eslint-disable-next-line no-console
        console.error("[AttendanceSheetsWorker] sync failed", e);

        this.failures += 1;
        const delayMs = Math.min(
          15 * 60_000,
          Math.max(5_000, this.opts.intervalMs) *
            Math.pow(2, Math.min(this.failures, 6)),
        );
        this.nextAllowedRunAt = Date.now() + delayMs;

        await this.prisma.attendanceSheetsWorkerState.update({
          where: { key: "attendance" },
          data: {
            lastHeartbeatAt: new Date(),
            lastFinishedAt: new Date(),
            isRunning: false,
            lastError:
              typeof (e as any)?.message === "string"
                ? (e as any).message
                : String(e),
          },
        });
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
