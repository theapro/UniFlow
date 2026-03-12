import { PrismaClient, UserRole, Weekday } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULTS = {
  adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@uniflow.com",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "admin123",
};

function timeToUtcDate(hhmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) throw new Error(`Invalid time: ${hhmm}`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
    throw new Error(`Invalid time: ${hhmm}`);
  return new Date(Date.UTC(1970, 0, 1, hh, mm, 0, 0));
}

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
    { slotNumber: 1, startTime: "08:30", endTime: "09:50" },
    { slotNumber: 2, startTime: "10:00", endTime: "11:20" },
    { slotNumber: 3, startTime: "11:30", endTime: "12:50" },
    { slotNumber: 4, startTime: "13:30", endTime: "14:50" },
    { slotNumber: 5, startTime: "15:00", endTime: "16:20" },
    { slotNumber: 6, startTime: "16:30", endTime: "17:50" },
  ]) {
    await prisma.timeSlot.upsert({
      where: { slotNumber: slot.slotNumber },
      update: {
        startTime: timeToUtcDate(slot.startTime),
        endTime: timeToUtcDate(slot.endTime),
      },
      create: {
        slotNumber: slot.slotNumber,
        startTime: timeToUtcDate(slot.startTime),
        endTime: timeToUtcDate(slot.endTime),
      },
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
    where: { studentNumber: "S001" },
    update: { groupId: group.id },
    create: {
      fullName: "Jane Student",
      studentNumber: "S001",
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

  const slot1 = await prisma.timeSlot.findUnique({ where: { slotNumber: 1 } });
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

async function seedAiModels() {
  // Curated list based on the provided model IDs list.
  // Note: we only *use* CHAT models in the app today, but we store modalities
  // so admin can manage them as the system expands.
  const models: Array<{
    provider: string;
    model: string;
    displayName: string;
    modality: "CHAT" | "VISION" | "STT" | "TTS" | "MODERATION";
    enabledForUsers: boolean;
    sortOrder: number;
  }> = [
    // TEXT / CHAT
    {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      displayName: "GPT OSS 120B",
      modality: "CHAT",
      enabledForUsers: true,
      sortOrder: 10,
    },
    {
      provider: "groq",
      model: "openai/gpt-oss-20b",
      displayName: "GPT OSS 20B",
      modality: "CHAT",
      enabledForUsers: true,
      sortOrder: 20,
    },
    {
      provider: "groq",
      model: "qwen/qwen3-32b",
      displayName: "Qwen 3 32B",
      modality: "CHAT",
      enabledForUsers: true,
      sortOrder: 30,
    },
    {
      provider: "groq",
      model: "moonshotai/kimi-k2-instruct-0905",
      displayName: "Kimi K2 Instruct",
      modality: "CHAT",
      enabledForUsers: true,
      sortOrder: 40,
    },
    {
      provider: "groq",
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      displayName: "Llama 4 Scout 17B Instruct",
      modality: "CHAT",
      enabledForUsers: true,
      sortOrder: 50,
    },
    {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      displayName: "Llama 3.3 70B Versatile",
      modality: "CHAT",
      enabledForUsers: true,
      sortOrder: 60,
    },

    // TEXT TO SPEECH
    {
      provider: "groq",
      model: "canopylabs/orpheus-v1-english",
      displayName: "Orpheus v1 English (TTS)",
      modality: "TTS",
      enabledForUsers: false,
      sortOrder: 200,
    },

    // SPEECH TO TEXT
    {
      provider: "groq",
      model: "whisper-large-v3",
      displayName: "Whisper Large v3 (STT)",
      modality: "STT",
      enabledForUsers: false,
      sortOrder: 300,
    },
    {
      provider: "groq",
      model: "whisper-large-v3-turbo",
      displayName: "Whisper Large v3 Turbo (STT)",
      modality: "STT",
      enabledForUsers: false,
      sortOrder: 310,
    },
  ];

  for (const m of models) {
    // Create/update the correct record by (provider, model)
    const createdOrUpdated = await prisma.aiModel.upsert({
      where: { provider_model: { provider: m.provider, model: m.model } },
      update: {
        displayName: m.displayName,
        modality: m.modality as any,
        enabledForUsers: m.enabledForUsers,
        sortOrder: m.sortOrder,
        isEnabled: true,
        enabledForAdmins: true,
      },
      create: {
        provider: m.provider,
        model: m.model,
        displayName: m.displayName,
        modality: m.modality as any,
        enabledForUsers: m.enabledForUsers,
        enabledForAdmins: true,
        isEnabled: true,
        sortOrder: m.sortOrder,
      },
      select: { id: true, model: true },
    });

    // If there is an older record with the same displayName but wrong/empty model,
    // migrate it by deleting (so we don't leave model="" rows around).
    const wrongByName = await prisma.aiModel.findFirst({
      where: {
        provider: m.provider,
        displayName: m.displayName,
        NOT: { id: createdOrUpdated.id },
      },
      select: { id: true, model: true },
    });

    if (wrongByName && wrongByName.model !== createdOrUpdated.model) {
      await prisma.aiModel.delete({ where: { id: wrongByName.id } });
    }
  }

  // Clean any accidental blank-model rows.
  await prisma.aiModel.deleteMany({ where: { model: "" } });

  // Remove legacy/non-existent model IDs from earlier seeds.
  await prisma.aiModel.deleteMany({
    where: {
      provider: "groq",
      model: {
        in: [
          "gpt-oss-120b",
          "gpt-oss-20b",
          "kimi-k2",
          "llama-4-scout",
          "llama-3.3-70b",
          "llama-4-scout-vision",
          "orpheus-english",
          "orpheus-arabic-saudi",
          "safety-gpt-oss-20b",
        ],
      },
    },
  });
}

async function main() {
  console.log("Seeding database...");
  await upsertAdmin();
  await seedReferenceData();
  await seedAiModels();
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
