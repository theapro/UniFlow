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
  console.log("Setting up time slots...");

  // Faqat dars vaqtlari (TimeSlots) qoldirildi, chunki bu tizimning strukturasi uchun kerak
  for (const slot of [
    { slotNumber: 1, startTime: "09:00", endTime: "10:15" },
    { slotNumber: 2, startTime: "10:25", endTime: "11:40" },
    { slotNumber: 3, startTime: "11:50", endTime: "13:05" },
    { slotNumber: 4, startTime: "13:50", endTime: "15:05" },
    { slotNumber: 5, startTime: "15:15", endTime: "16:30" },
    { slotNumber: 6, startTime: "16:40", endTime: "17:55" },
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

  console.log("Skipping subjects, teachers, and groups as requested.");
}

async function seedAiModels() {
  const models: Array<{
    provider: string;
    model: string;
    displayName: string;
    modality: "CHAT" | "VISION" | "STT" | "TTS" | "MODERATION";
    enabledForUsers: boolean;
    sortOrder: number;
  }> = [
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
    {
      provider: "groq",
      model: "canopylabs/orpheus-v1-english",
      displayName: "Orpheus v1 English (TTS)",
      modality: "TTS",
      enabledForUsers: false,
      sortOrder: 200,
    },
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

  await prisma.aiModel.deleteMany({ where: { model: "" } });
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
