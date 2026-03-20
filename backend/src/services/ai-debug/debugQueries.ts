import { prisma } from "../../config/prisma";

export async function debugScheduleRaw() {
  return prisma.scheduleEntry.findMany({
    take: 10,
    include: {
      teacher: true,
      group: true,
      subject: true,
      timeSlot: true,
      room: true,
    },
    orderBy: [{ weekday: "asc" }, { timeSlot: { slotNumber: "asc" } }],
  });
}

export async function debugStudentFlow(params: { studentId: string }) {
  const studentId = String(params.studentId ?? "").trim();
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      email: true,
      studentNumber: true,
      status: true,
      createdAt: true,
    },
  });

  const memberships = await prisma.studentGroup.findMany({
    where: { studentId },
    include: {
      group: { select: { id: true, name: true } },
    },
    orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
    take: 5,
  });

  const membership = await prisma.studentGroup.findFirst({
    where: { studentId, leftAt: null },
    select: { groupId: true },
    orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
  });

  const scheduleSample = membership?.groupId
    ? await prisma.scheduleEntry.findMany({
        where: { groupId: membership.groupId },
        take: 5,
        include: {
          subject: true,
          teacher: true,
          timeSlot: true,
          room: true,
        },
        orderBy: [{ weekday: "asc" }, { timeSlot: { slotNumber: "asc" } }],
      })
    : [];

  return {
    student,
    memberships,
    membership,
    scheduleSample,
  };
}

export async function debugTeacherRelation() {
  // `ScheduleEntry.teacherId` is non-nullable in the schema. If you suspect
  // broken relations (e.g. legacy DB without FKs), check for orphaned refs.
  return prisma.$queryRawUnsafe(
    "SELECT se.id AS scheduleEntryId, se.teacherId AS teacherId FROM ScheduleEntry se LEFT JOIN Teacher t ON t.id = se.teacherId WHERE t.id IS NULL LIMIT 20",
  );
}
