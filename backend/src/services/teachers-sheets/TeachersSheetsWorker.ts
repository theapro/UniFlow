import type { PrismaClient } from "@prisma/client";
import { TeachersSheetsSyncService } from "./TeachersSheetsSyncService";
import { SheetsSettingsService } from "../sheets/SheetsSettingsService";

export class TeachersSheetsWorker {
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

      await this.prisma.teachersSheetsWorkerState.upsert({
        where: { key: "teachers" },
        update: {
          lastHeartbeatAt: new Date(),
          lastStartedAt: new Date(),
          isRunning: true,
          lastError: null,
        },
        create: {
          key: "teachers",
          lastHeartbeatAt: new Date(),
          lastStartedAt: new Date(),
          isRunning: true,
          lastError: null,
        },
      });

      const svc = new TeachersSheetsSyncService(this.prisma);
      const spreadsheetId =
        await this.sheetsSettings.getEffectiveTeachersSpreadsheetId(
          this.prisma,
        );
      try {
        await svc.syncOnce({
          reason: "worker",
          spreadsheetId: spreadsheetId ?? undefined,
        });
        this.failures = 0;
        this.nextAllowedRunAt = 0;

        await this.prisma.teachersSheetsWorkerState.update({
          where: { key: "teachers" },
          data: {
            lastHeartbeatAt: new Date(),
            lastFinishedAt: new Date(),
            isRunning: false,
            lastError: null,
          },
        });
      } catch (e) {
        try {
          await svc.recordFailure(e, spreadsheetId ?? undefined);
        } catch {
          // ignore
        }
        // svc.recordFailure already updates sync state, but we also want to record in worker state
        // eslint-disable-next-line no-console
        console.error("[TeachersSheetsWorker] sync failed", e);

        this.failures += 1;
        const delayMs = Math.min(
          15 * 60_000,
          Math.max(5_000, this.opts.intervalMs) *
            Math.pow(2, Math.min(this.failures, 6)),
        );
        this.nextAllowedRunAt = Date.now() + delayMs;

        await this.prisma.teachersSheetsWorkerState.update({
          where: { key: "teachers" },
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
