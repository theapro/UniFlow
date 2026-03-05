import { PrismaClient, UserRole, Weekday } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULTS = {
  adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@uniflow.com",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "admin123",
};

async function upsertAdmin() {
  const passwordHash = bcrypt.hashSync(DEFAULTS.adminPassword, 10);
  await prisma.user.upsert({
    where: { email: DEFAULTS.adminEmail },
    update: {
      role: UserRole.ADMIN,
      passwordHash,
    },
    create: {
      email: DEFAULTS.adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });
}

async function seedReferenceData() {
  const department = await prisma.department.upsert({
    where: { name: "Computer Science" },
    update: {},
    create: { name: "Computer Science" },
  });

  const group = await prisma.group.upsert({
    where: { name: "CS-101" },
    update: {},
    create: { name: "CS-101" },
  });

  const room = await prisma.room.upsert({
    where: { name: "Room A" },
    update: { capacity: 30 },
    create: { name: "Room A", capacity: 30 },
  });

  // 1..6 slots
  for (const slot of [
    { order: 1, startTime: "08:30", endTime: "09:50" },
    { order: 2, startTime: "10:00", endTime: "11:20" },
    { order: 3, startTime: "11:30", endTime: "12:50" },
    { order: 4, startTime: "13:30", endTime: "14:50" },
    { order: 5, startTime: "15:00", endTime: "16:20" },
    { order: 6, startTime: "16:30", endTime: "17:50" },
  ]) {
    await prisma.timeSlot.upsert({
      where: { order: slot.order },
      update: { startTime: slot.startTime, endTime: slot.endTime },
      create: slot,
    });
  }

  const teacher = await prisma.teacher.upsert({
    where: { staffNo: "T001" },
    update: { departmentId: department.id },
    create: {
      fullName: "John Teacher",
      staffNo: "T001",
      departmentId: department.id,
    },
  });

  const student = await prisma.student.upsert({
    where: { studentNo: "S001" },
    update: { groupId: group.id },
    create: {
      fullName: "Jane Student",
      studentNo: "S001",
      groupId: group.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "teacher@uniflow.com" },
    update: { role: UserRole.TEACHER, teacherId: teacher.id },
    create: {
      email: "teacher@uniflow.com",
      passwordHash: bcrypt.hashSync("teacher123", 10),
      role: UserRole.TEACHER,
      teacherId: teacher.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "student@uniflow.com" },
    update: { role: UserRole.STUDENT, studentId: student.id },
    create: {
      email: "student@uniflow.com",
      passwordHash: bcrypt.hashSync("student123", 10),
      role: UserRole.STUDENT,
      studentId: student.id,
    },
  });

  const subject = await prisma.subject.upsert({
    where: { code: "CS101" },
    update: { name: "Introduction to Programming" },
    create: { name: "Introduction to Programming", code: "CS101" },
  });

  const slot1 = await prisma.timeSlot.findUnique({ where: { order: 1 } });
  if (slot1) {
    await prisma.scheduleEntry.upsert({
      where: {
        groupId_weekday_timeSlotId: {
          groupId: group.id,
          weekday: Weekday.MON,
          timeSlotId: slot1.id,
        },
      },
      update: {
        teacherId: teacher.id,
        subjectId: subject.id,
        roomId: room.id,
      },
      create: {
        weekday: Weekday.MON,
        groupId: group.id,
        teacherId: teacher.id,
        subjectId: subject.id,
        timeSlotId: slot1.id,
        roomId: room.id,
      },
    });
  }
}

async function main() {
  console.log("Seeding database...");
  await upsertAdmin();
  await seedReferenceData();
  console.log("✓ Seed complete");
  console.log(
    `✓ Admin login: ${DEFAULTS.adminEmail} / ${DEFAULTS.adminPassword}`,
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
