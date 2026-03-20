import { prisma } from "../../config/prisma";

export class AiDataService {
  async getSystemSummary() {
    const [
      departments,
      groups,
      rooms,
      timeSlots,
      studentCount,
      teacherCount,
      lessonCount,
    ] = await Promise.all([
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.group.findMany({ select: { id: true, name: true } }),
      prisma.room.findMany({ select: { id: true, name: true } }),
      prisma.timeSlot.findMany({ orderBy: { slotNumber: "asc" } }),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.lesson.count(),
    ]);

    return {
      departments,
      groups,
      rooms,
      timeSlots,
      stats: {
        totalStudents: studentCount,
        totalTeachers: teacherCount,
        totalLessons: lessonCount,
      },
    };
  }

  async searchStudents(query: string) {
    const rows = await prisma.student.findMany({
      where: {
        OR: [
          { fullName: { contains: query } },
          { studentNumber: { contains: query } },
        ],
      },
      include: {
        studentGroups: {
          where: { leftAt: null },
          select: { group: { select: { id: true, name: true } } },
          orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      take: 10,
    });

    return rows.map((s) => ({
      ...s,
      group: s.studentGroups[0]?.group ?? null,
      studentGroups: undefined,
    }));
  }

  async getGroupDetails(groupName: string) {
    const group = await prisma.group.findFirst({
      where: { name: { equals: groupName } },
      include: {
        studentGroups: {
          where: { leftAt: null },
          select: {
            student: { select: { fullName: true, studentNumber: true } },
          },
          take: 500,
        },
        lessons: {
          select: {
            startsAt: true,
            endsAt: true,
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });

    if (!group) return null;

    return {
      ...group,
      students: group.studentGroups.map((x) => x.student),
      studentGroups: undefined,
    };
  }
}
