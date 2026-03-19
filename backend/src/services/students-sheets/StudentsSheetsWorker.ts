import type { PrismaClient } from "@prisma/client";
import { StudentsSheetsSyncService } from "./StudentsSheetsSyncService";
import { SheetsSettingsService } from "../sheets/SheetsSettingsService";

export class StudentsSheetsWorker {
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
      if (Date.now() < this.nextAllowedRunAt) return;
      this.running = true;

      await this.prisma.studentsSheetsWorkerState.upsert({
        where: { key: "students" },
        update: {
          lastHeartbeatAt: new Date(),
          lastStartedAt: new Date(),
          isRunning: true,
          lastError: null,
        },
        create: {
          key: "students",
          lastHeartbeatAt: new Date(),
          lastStartedAt: new Date(),
          isRunning: true,
          lastError: null,
        },
      });

      const svc = new StudentsSheetsSyncService(this.prisma);
      const spreadsheetId =
        await this.sheetsSettings.getEffectiveStudentsSpreadsheetId(
          this.prisma,
        );
      try {
        await svc.syncOnce({
          reason: "worker",
          spreadsheetId: spreadsheetId ?? undefined,
        });
        this.failures = 0;
        this.nextAllowedRunAt = 0;

        await this.prisma.studentsSheetsWorkerState.update({
          where: { key: "students" },
          data: {
            lastHeartbeatAt: new Date(),
            lastFinishedAt: new Date(),
            isRunning: false,
            lastError: null,
          },
        });
      } catch (e) {
        await svc.recordFailure(e, spreadsheetId ?? undefined);
        // eslint-disable-next-line no-console
        console.error("[StudentsSheetsWorker] sync failed", e);

        this.failures += 1;
        const delayMs = Math.min(
          15 * 60_000,
          Math.max(5_000, this.opts.intervalMs) *
            Math.pow(2, Math.min(this.failures, 6)),
        );
        this.nextAllowedRunAt = Date.now() + delayMs;

        await this.prisma.studentsSheetsWorkerState.update({
          where: { key: "students" },
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
