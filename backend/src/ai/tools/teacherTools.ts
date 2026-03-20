import { TeacherService } from "../../services/user/TeacherService";
import { prisma } from "../../config/prisma";
import { UserRole } from "@prisma/client";

export async function getTeacherDashboard(params: {
  user: Express.User;
  teacherService: TeacherService;
}): Promise<{
  profile: {
    id: string;
    fullName: string;
    staffNo: string | null;
    department: { id: string; name: string } | null;
  };
  lessonsToday: Array<{
    subject: string | null;
    group: string | null;
    startsAt: string | null;
    endsAt: string | null;
  }>;
}> {
  if (params.user.role !== UserRole.TEACHER) {
    throw new Error("Only teachers can use this tool");
  }
  if (!params.user.teacherId) {
    throw new Error("Teacher profile not linked");
  }

  const [teacher, lessons] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id: params.user.teacherId },
      select: {
        id: true,
        fullName: true,
        staffNo: true,
        department: { select: { id: true, name: true } },
      },
    }),
    params.teacherService.getTodayLessons(params.user.teacherId),
  ]);

  if (!teacher) {
    throw new Error("Teacher not found");
  }

  return {
    profile: {
      id: teacher.id,
      fullName: teacher.fullName,
      staffNo: teacher.staffNo ?? null,
      department: teacher.department ?? null,
    },
    lessonsToday: lessons.slice(0, 10).map((l: any) => ({
      subject: l?.subject?.name ?? null,
      group: l?.group?.name ?? null,
      startsAt: l?.startsAt ? new Date(l.startsAt).toISOString() : null,
      endsAt: l?.endsAt ? new Date(l.endsAt).toISOString() : null,
    })),
  };
}
