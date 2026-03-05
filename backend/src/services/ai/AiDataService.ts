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
      prisma.timeSlot.findMany({ orderBy: { order: "asc" } }),
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
    return prisma.student.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { studentNo: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { group: { select: { name: true } } },
      take: 10,
    });
  }

  async getGroupDetails(groupName: string) {
    return prisma.group.findFirst({
      where: { name: { equals: groupName, mode: "insensitive" } },
      include: {
        students: { select: { fullName: true, studentNo: true } },
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
  }
}
