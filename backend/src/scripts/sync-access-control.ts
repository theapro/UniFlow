import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PERMISSION_NAMES = [
  "VIEW_STUDENTS",
  "EDIT_STUDENTS",
  "VIEW_TEACHERS",
  "EDIT_TEACHERS",
  "MANAGE_SCHEDULE",
  "ACCESS_AI_SETTINGS",
  "VIEW_ATTENDANCE",
  "EDIT_ATTENDANCE",
  "VIEW_GRADES",
  "EDIT_GRADES",
] as const;

type PermissionName = (typeof DEFAULT_PERMISSION_NAMES)[number];

const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionName[]> = {
  [Role.ADMIN]: [...DEFAULT_PERMISSION_NAMES],
  [Role.TEACHER]: [
    "VIEW_STUDENTS",
    "MANAGE_SCHEDULE",
    "VIEW_ATTENDANCE",
    "EDIT_ATTENDANCE",
    "VIEW_GRADES",
    "EDIT_GRADES",
  ],
  [Role.MANAGER]: [
    "VIEW_STUDENTS",
    "EDIT_STUDENTS",
    "VIEW_TEACHERS",
    "EDIT_TEACHERS",
    "MANAGE_SCHEDULE",
    "VIEW_ATTENDANCE",
    "EDIT_ATTENDANCE",
    "VIEW_GRADES",
    "EDIT_GRADES",
  ],
  [Role.STAFF]: [
    "VIEW_STUDENTS",
    "VIEW_TEACHERS",
    "VIEW_ATTENDANCE",
    "VIEW_GRADES",
  ],
  [Role.STUDENT]: [],
};

async function main() {
  await prisma.permission.createMany({
    data: DEFAULT_PERMISSION_NAMES.map((name) => ({ name })),
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

  // Keep output short but actionable.
  console.log(
    `RBAC sync complete (ensured ${DEFAULT_PERMISSION_NAMES.length} permissions, ${rows.length} role-permissions; duplicates skipped).`,
  );
}

main()
  .catch((err) => {
    console.error("RBAC sync failed:");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
