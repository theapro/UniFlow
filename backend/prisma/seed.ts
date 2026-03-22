import { PrismaClient, Role, Weekday } from "@prisma/client";
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
      role: Role.ADMIN,
      passwordHash,
    },
    create: {
      email: DEFAULTS.adminEmail,
      passwordHash,
      role: Role.ADMIN,
    },
  });
}

const DEFAULT_PERMISSION_NAMES = [
  "VIEW_STUDENTS",
  "EDIT_STUDENTS",
  "VIEW_TEACHERS",
  "EDIT_TEACHERS",
  "MANAGE_SCHEDULE",
  "ACCESS_AI_SETTINGS",
] as const;

type PermissionName = (typeof DEFAULT_PERMISSION_NAMES)[number];

const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionName[]> = {
  [Role.ADMIN]: [...DEFAULT_PERMISSION_NAMES],
  [Role.TEACHER]: ["VIEW_STUDENTS", "MANAGE_SCHEDULE"],
  [Role.MANAGER]: [
    "VIEW_STUDENTS",
    "EDIT_STUDENTS",
    "VIEW_TEACHERS",
    "EDIT_TEACHERS",
    "MANAGE_SCHEDULE",
  ],
  [Role.STAFF]: ["VIEW_STUDENTS", "VIEW_TEACHERS"],
  [Role.STUDENT]: [],
};

async function seedAccessControl() {
  await prisma.permission.createMany({
    data: DEFAULT_PERMISSION_NAMES.map((name) => ({
      name,
    })),
    skipDuplicates: true,
  });

  const rows: Array<{ role: Role; permission: string }> = [];
  for (const role of Object.values(Role)) {
    const perms = DEFAULT_ROLE_PERMISSIONS[role as Role] ?? [];
    for (const permission of perms) {
      rows.push({ role: role as Role, permission });
    }
  }

  if (rows.length > 0) {
    await prisma.rolePermission.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
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
}

function slugEmailPart(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['`’]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
}

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const TR_FIRST = [
  "Ahmet",
  "Mehmet",
  "Mustafa",
  "Ali",
  "Ayşe",
  "Fatma",
  "Elif",
  "Zeynep",
  "Merve",
  "Emre",
  "Can",
  "Ece",
  "Hakan",
  "Kemal",
  "Yusuf",
  "Ömer",
  "Seda",
  "Sıla",
  "Cem",
  "Deniz",
];

const TR_LAST = [
  "Yılmaz",
  "Kaya",
  "Demir",
  "Şahin",
  "Çelik",
  "Yıldız",
  "Aydın",
  "Öztürk",
  "Arslan",
  "Doğan",
  "Koç",
  "Kurt",
  "Özdemir",
  "Aslan",
  "Acar",
  "Aksoy",
  "Güneş",
  "Polat",
  "Eren",
  "Kaplan",
];

function makeTurkishFullName() {
  const first = pick(TR_FIRST);
  const last = pick(TR_LAST);
  return { first, last, fullName: `${first} ${last}` };
}

type AcademicDepartmentName =
  | "IT"
  | "Japanese"
  | "Partner University"
  | "Employability/Cowork"
  | "Language University";

const ACADEMIC_DEPARTMENTS: AcademicDepartmentName[] = [
  "IT",
  "Japanese",
  "Partner University",
  "Employability/Cowork",
  "Language University",
];

const COHORTS: Array<{
  code: string;
  sortOrder: number;
  year?: number | null;
}> = [
  { code: "19/20/21", sortOrder: 10, year: 2021 },
  { code: "22", sortOrder: 20, year: 2022 },
  { code: "23", sortOrder: 30, year: 2023 },
  { code: "24", sortOrder: 40, year: 2024 },
  { code: "25", sortOrder: 50, year: 2025 },
];

function jpName(name: string) {
  // Keep global uniqueness in DB (Group.name is unique).
  // If Japanese list contains numeric-style names that collide with IT, prefix them.
  if (/^[0-9]{2}[A-Z]$/.test(name)) return `JP-${name}`;
  return name;
}

async function seedAcademicStructure() {
  console.log("Setting up academic departments (ParentGroup)...");

  const deptByName = new Map<string, { id: string; name: string }>();
  for (const name of ACADEMIC_DEPARTMENTS) {
    const row = await prisma.parentGroup.upsert({
      where: { name },
      update: {},
      create: { name },
      select: { id: true, name: true },
    });
    deptByName.set(row.name, row);
  }

  console.log("Setting up cohorts...");
  const cohortByCode = new Map<string, { id: string; code: string }>();
  for (const c of COHORTS) {
    const row = await prisma.cohort.upsert({
      where: { code: c.code },
      update: {
        sortOrder: c.sortOrder,
        year: c.year ?? null,
      },
      create: {
        code: c.code,
        sortOrder: c.sortOrder,
        year: c.year ?? null,
      },
      select: { id: true, code: true },
    });
    cohortByCode.set(row.code, row);
  }

  const deptId = (name: AcademicDepartmentName) => {
    const d = deptByName.get(name);
    if (!d) throw new Error(`Missing seeded department: ${name}`);
    return d.id;
  };

  const cohortId = (code: string | null) => {
    if (!code) return null;
    const c = cohortByCode.get(code);
    if (!c) throw new Error(`Missing seeded cohort: ${code}`);
    return c.id;
  };

  console.log("Setting up groups...");

  const groupsToUpsert: Array<{
    name: string;
    department: AcademicDepartmentName;
    cohortCode: string | null;
  }> = [
    // IT
    { name: "19/20/21", department: "IT", cohortCode: "19/20/21" },
    ...[
      "22A",
      "22B",
      "23A",
      "23B",
      "23C",
      "23D",
      "23E",
      "24A",
      "24B",
      "24C",
      "24D",
      "25A",
      "25B",
      "25C",
      "25D",
      "25E",
      "25F",
    ].map((name) => ({
      name,
      department: "IT" as const,
      cohortCode: name.startsWith("22")
        ? "22"
        : name.startsWith("23")
          ? "23"
          : name.startsWith("24")
            ? "24"
            : name.startsWith("25")
              ? "25"
              : null,
    })),

    // Japanese (not cohort-sorted; keep cohortCode null by default)
    ...[
      "N5A",
      "N5B",
      "N5C",
      "N5D",
      "25E",
      "25F",
      "N2A",
      "N2B",
      "N2C",
      "N2D",
      "N2E",
      "N3A",
      "N3B",
      "N3C",
      "N3D",
      "N3E",
      "N3F",
      "N3G",
      "N4",
    ].map((name) => ({
      name: jpName(name),
      department: "Japanese" as const,
      cohortCode: null,
    })),

    // Partner University
    ...["Sanno F", "Sanno K", "Okayama A", "Okayama B"].map((name) => ({
      name,
      department: "Partner University" as const,
      cohortCode: null,
    })),

    // Employability/Cowork
    {
      name: "Employability 19/20/21 / Co-work 19/20/21",
      department: "Employability/Cowork",
      cohortCode: "19/20/21",
    },
    {
      name: "Employability 22 / Co-work 22",
      department: "Employability/Cowork",
      cohortCode: "22",
    },
    {
      name: "Employability 23 / Co-work 23",
      department: "Employability/Cowork",
      cohortCode: "23",
    },
    {
      name: "Employability 24 / Co-work 24",
      department: "Employability/Cowork",
      cohortCode: "24",
    },
    {
      name: "Employability 25 A",
      department: "Employability/Cowork",
      cohortCode: "25",
    },
    {
      name: "Employability 25 B",
      department: "Employability/Cowork",
      cohortCode: "25",
    },

    // Language University
    ...[
      "UZBEK TILI A / Dinshunoslik A",
      "UZBEK TILI B / Dinshunoslik B",
      "UZBEK TILI D / Dinshunoslik D",
      "UZBEK TILI E / Dinshunoslik E",
      "UZBEK TILI F / Dinshunoslik F",
    ].map((name) => ({
      name,
      department: "Language University" as const,
      cohortCode: null,
    })),
  ];

  for (const g of groupsToUpsert) {
    await prisma.group.upsert({
      where: { name: g.name },
      update: {
        parentGroupId: deptId(g.department),
        cohortId: cohortId(g.cohortCode),
      },
      create: {
        name: g.name,
        parentGroupId: deptId(g.department),
        cohortId: cohortId(g.cohortCode),
      },
      select: { id: true },
    });
  }
}

async function seedRooms() {
  console.log("Setting up rooms...");

  const rooms = [
    { name: "A101", capacity: 30 },
    { name: "A102", capacity: 30 },
    { name: "A201", capacity: 40 },
    { name: "B101", capacity: 25 },
    { name: "B201", capacity: 35 },
    { name: "Lab-1", capacity: 24 },
    { name: "Lab-2", capacity: 24 },
    { name: "C301", capacity: 50 },
    { name: "D101", capacity: 20 },
    { name: "Conference", capacity: 60 },
  ];

  for (const r of rooms) {
    await prisma.room.upsert({
      where: { name: r.name },
      update: { capacity: r.capacity },
      create: { name: r.name, capacity: r.capacity },
      select: { id: true },
    });
  }
}

async function seedDepartments() {
  console.log("Setting up departments...");
  for (const name of ACADEMIC_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
      select: { id: true },
    });
  }
}

type SeedSubject = {
  name: string;
  parentGroup: AcademicDepartmentName;
  code?: string;
  weeklyLessons: number;
};

async function seedSubjectsAndTeachers() {
  console.log("Setting up subjects and teachers...");

  const parentGroups = await prisma.parentGroup.findMany({
    select: { id: true, name: true },
  });
  const parentGroupIdByName = new Map(parentGroups.map((p) => [p.name, p.id]));

  const subjects: SeedSubject[] = [
    // IT
    { name: "Algorithms", parentGroup: "IT", code: "IT-ALG", weeklyLessons: 5 },
    { name: "Databases", parentGroup: "IT", code: "IT-DB", weeklyLessons: 4 },
    {
      name: "Web Development",
      parentGroup: "IT",
      code: "IT-WEB",
      weeklyLessons: 3,
    },
    {
      name: "Backend Engineering",
      parentGroup: "IT",
      code: "IT-BE",
      weeklyLessons: 4,
    },
    {
      name: "Frontend Engineering",
      parentGroup: "IT",
      code: "IT-FE",
      weeklyLessons: 3,
    },
    {
      name: "Data Structures",
      parentGroup: "IT",
      code: "IT-DS",
      weeklyLessons: 5,
    },
    {
      name: "DevOps Basics",
      parentGroup: "IT",
      code: "IT-DEVOPS",
      weeklyLessons: 3,
    },

    // Japanese
    {
      name: "Japanese Grammar",
      parentGroup: "Japanese",
      code: "JP-G",
      weeklyLessons: 4,
    },
    {
      name: "Kanji",
      parentGroup: "Japanese",
      code: "JP-KAN",
      weeklyLessons: 3,
    },
    {
      name: "Japanese Conversation",
      parentGroup: "Japanese",
      code: "JP-CONV",
      weeklyLessons: 3,
    },
    {
      name: "JLPT N5 Prep",
      parentGroup: "Japanese",
      code: "JP-N5",
      weeklyLessons: 4,
    },

    // Employability/Cowork
    {
      name: "Employability Skills",
      parentGroup: "Employability/Cowork",
      code: "EMP-SK",
      weeklyLessons: 3,
    },
    {
      name: "Career Coaching",
      parentGroup: "Employability/Cowork",
      code: "EMP-CC",
      weeklyLessons: 3,
    },

    // Partner University / Language
    {
      name: "Academic Writing",
      parentGroup: "Partner University",
      code: "UNI-AW",
      weeklyLessons: 3,
    },
    {
      name: "Presentation Skills",
      parentGroup: "Partner University",
      code: "UNI-PS",
      weeklyLessons: 3,
    },
    {
      name: "Critical Thinking",
      parentGroup: "Partner University",
      code: "UNI-CT",
      weeklyLessons: 3,
    },
    {
      name: "English",
      parentGroup: "Language University",
      code: "LANG-EN",
      weeklyLessons: 4,
    },
    {
      name: "Uzbek Language",
      parentGroup: "Language University",
      code: "LANG-UZ",
      weeklyLessons: 4,
    },
    {
      name: "History",
      parentGroup: "Partner University",
      code: "UNI-HIS",
      weeklyLessons: 3,
    },
    {
      name: "Mathematics",
      parentGroup: "Partner University",
      code: "UNI-MATH",
      weeklyLessons: 5,
    },
  ];

  const subjectRows = [] as Array<{ id: string; name: string }>;

  for (const s of subjects) {
    const parentGroupId = parentGroupIdByName.get(s.parentGroup) ?? null;

    const row = await prisma.subject.upsert({
      where: { name: s.name },
      update: {
        code: s.code ?? null,
        parentGroupId,
        weeklyLessons: s.weeklyLessons,
      },
      create: {
        name: s.name,
        code: s.code ?? null,
        parentGroupId,
        weeklyLessons: s.weeklyLessons,
      },
      select: { id: true, name: true },
    });
    subjectRows.push(row);
  }

  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
  });
  const departmentIdByName = new Map(departments.map((d) => [d.name, d.id]));

  // Create a reasonable number of teachers; each teaches multiple subjects.
  const teacherCount = 18;
  for (let i = 1; i <= teacherCount; i++) {
    const { first, last, fullName } = makeTurkishFullName();
    const staffNo = `T${pad(i, 4)}`;
    const email = `${slugEmailPart(first)}.${slugEmailPart(last)}.${staffNo.toLowerCase()}@apro.edu`;

    const dept = pick(ACADEMIC_DEPARTMENTS);
    const departmentId = departmentIdByName.get(dept) ?? null;

    // Pick 2-4 subjects.
    const shuffled = [...subjectRows].sort(() => Math.random() - 0.5);
    const teach = shuffled.slice(0, 2 + (i % 3));

    await prisma.teacher.upsert({
      where: { staffNo },
      update: {
        fullName,
        email,
        departmentId,
        subjects: {
          connect: teach.map((s) => ({ id: s.id })),
        },
      },
      create: {
        fullName,
        staffNo,
        email,
        departmentId,
        subjects: {
          connect: teach.map((s) => ({ id: s.id })),
        },
      },
      select: { id: true },
    });
  }
}

async function seedStudents() {
  console.log("Setting up students (10 per group)...");

  const groups = await prisma.group.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  for (const g of groups) {
    const groupPrefix = String(g.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 18);

    for (let i = 1; i <= 10; i++) {
      const { first, last, fullName } = makeTurkishFullName();
      const studentNumber = `${groupPrefix}-${pad(i, 2)}`;
      const email = `${slugEmailPart(first)}.${slugEmailPart(last)}.${slugEmailPart(studentNumber)}@apro.edu`;

      const student = await prisma.student.upsert({
        where: { studentNumber },
        update: {
          fullName,
          email,
          status: "ACTIVE",
        },
        create: {
          fullName,
          email,
          studentNumber,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      await prisma.studentGroup.upsert({
        where: {
          studentId_groupId: { studentId: student.id, groupId: g.id },
        },
        update: {
          leftAt: null,
          joinedAt: new Date(),
        },
        create: {
          studentId: student.id,
          groupId: g.id,
          joinedAt: new Date(),
          leftAt: null,
        },
        select: { id: true },
      });
    }
  }
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
  await seedAccessControl();
  await seedReferenceData();
  await seedAcademicStructure();
  await seedRooms();
  await seedDepartments();
  await seedSubjectsAndTeachers();
  await seedStudents();
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
