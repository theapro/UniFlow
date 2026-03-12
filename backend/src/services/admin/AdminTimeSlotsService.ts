import { prisma } from "../../config/prisma";
import { formatDbTime } from "../../utils/time";

export class AdminTimeSlotsService {
  async list() {
    const rows = await prisma.timeSlot.findMany({
      orderBy: { slotNumber: "asc" },
    });

    return rows.map((r) => ({
      ...r,
      startTime: formatDbTime(r.startTime),
      endTime: formatDbTime(r.endTime),
    }));
  }
}
