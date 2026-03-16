import type { Request, Response } from "express";
import { ok, fail } from "../../utils/responses";
import { AIScheduleGeneratorService } from "../../services/scheduling/AIScheduleGeneratorService";
import { AdminMonthlyScheduleService } from "../../services/admin/AdminMonthlyScheduleService";

export class AdminAiScheduleController {
  constructor(
    private readonly generatorService: AIScheduleGeneratorService,
    private readonly monthlyScheduleService: AdminMonthlyScheduleService,
  ) {}

  generate = async (req: Request, res: Response) => {
    try {
      const {
        month,
        year,
        requirements,
        rules,
        workingDays,
        notes,
        holidays,
        teacherUnavailable,
        maxSeconds,
      } = req.body ?? {};

      const m = Number(month);
      const y = Number(year);

      const gen = await this.generatorService.generateMonthlySchedule({
        month: m,
        year: y,
        requirements: Array.isArray(requirements)
          ? requirements
          : Array.isArray(rules)
            ? rules
            : [],
        holidays: Array.isArray(holidays) ? holidays : [],
        workingDays: Array.isArray(workingDays) ? workingDays : undefined,
        notes: typeof notes === "string" ? notes : undefined,
        teacherUnavailable: Array.isArray(teacherUnavailable)
          ? teacherUnavailable
          : [],
        maxSeconds:
          maxSeconds !== undefined && Number.isFinite(Number(maxSeconds))
            ? Number(maxSeconds)
            : undefined,
      });

      if (!gen.ok) {
        return fail(res, gen.status, gen.message);
      }

      // Save safely (no overwrites). If anything conflicts, we abort without writing.
      const saved = await this.monthlyScheduleService.bulkCreate(
        gen.generatedLessons.map((l) => ({
          date: String(l.date),
          timeSlotId: String(l.timeSlotId),
          groupId: String(l.groupId),
          teacherId: String(l.teacherId),
          subjectId: String(l.subjectId),
          roomId: l.roomId ? String(l.roomId) : null,
          note: l.note ? String(l.note) : null,
        })),
        { mode: "all_or_nothing" },
      );

      if (!saved.ok) {
        return fail(res, saved.status, saved.message);
      }

      return ok(res, "AI schedule generated", {
        generatedLessons: gen.generatedLessons,
        created: saved.data.created,
      });
    } catch (err: any) {
      return fail(res, 500, err?.message ?? "Failed to generate AI schedule");
    }
  };
}
