import type { Request, Response } from "express";

import { ScheduleGeneratorService } from "../../services/scheduling/ScheduleGeneratorService";
import { fail } from "../../utils/responses";

export class AdminScheduleGeneratorController {
  constructor(private readonly generator: ScheduleGeneratorService) {}

  generate = async (_req: Request, res: Response) => {
    try {
      const result = await this.generator.generateSchedule({
        clearExisting: true,
      });

      return res.status(200).json({
        success: true,
        totalLessonsCreated: result.totalLessonsCreated,
      });
    } catch (e: any) {
      return fail(
        res,
        500,
        e?.message ? String(e.message) : "Failed to generate schedule",
      );
    }
  };
}
