import { Router } from "express";
import { Prisma, ReceptionistLanguage, Role } from "@prisma/client";

import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/access-control.middleware";
import { created, fail, ok } from "../utils/responses";

function coerceLanguage(raw: unknown): ReceptionistLanguage | undefined {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "UZ") return "UZ";
  if (v === "EN") return "EN";
  if (v === "JP" || v === "JA") return "JP";
  return undefined;
}

function coerceNumber(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function coerceBoolean(raw: unknown): boolean | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "boolean") return raw;
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return undefined;
}

function coerceStringOrNull(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === "string") return raw;
  return undefined;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function asSearchQuery(raw: unknown): string {
  return String(raw ?? "").trim();
}

function parseTakeSkip(query: any) {
  const take = clampInt(Number(query?.take ?? 200), 0, 500);
  const skip = clampInt(Number(query?.skip ?? 0), 0, 1_000_000);
  return { take, skip };
}

export const universityDataRoutes = Router();

// Admin-only CRUD (mounted at /api/*)
// Limit middleware to the specific CRUD prefixes to avoid affecting other /api routes.
universityDataRoutes.use(
  [
    "/universities",
    "/diplomas",
    "/departments",
    "/specialties",
    "/fees",
    "/facilities",
    "/announcements",
    "/ai-knowledge",
  ],
  authMiddleware,
  requireRole(Role.ADMIN),
);

// --- Universities ---
universityDataRoutes.get("/universities", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.university.findMany({
      where: q
        ? {
            OR: [{ name: { contains: q } }, { description: { contains: q } }],
          }
        : {},
      orderBy: [{ updatedAt: "desc" }],
      take,
      skip,
    });

    return ok(res, "Universities fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch universities");
  }
});

universityDataRoutes.post("/universities", async (req, res) => {
  try {
    const { name, description } = req.body ?? {};
    if (!name || typeof name !== "string") {
      return fail(res, 400, "name is required");
    }

    const row = await prisma.university.create({
      data: {
        name: String(name).trim().slice(0, 180),
        description:
          typeof description === "string" && description.trim()
            ? String(description).trim().slice(0, 20_000)
            : null,
      },
    });

    return created(res, "University created", row);
  } catch (err: any) {
    if (err?.code === "P2002")
      return fail(res, 400, "University already exists");
    return fail(res, 500, "Failed to create university");
  }
});

universityDataRoutes.put("/universities/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};
    const row = await prisma.university.update({
      where: { id: req.params.id },
      data: {
        ...(patch.name !== undefined
          ? {
              name: String(patch.name ?? "")
                .trim()
                .slice(0, 180),
            }
          : {}),
        ...(patch.description !== undefined
          ? {
              description:
                typeof patch.description === "string" &&
                patch.description.trim()
                  ? String(patch.description).trim().slice(0, 20_000)
                  : null,
            }
          : {}),
      },
    });

    return ok(res, "University updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "University not found");
    if (err?.code === "P2002")
      return fail(res, 400, "University already exists");
    return fail(res, 500, "Failed to update university");
  }
});

universityDataRoutes.delete("/universities/:id", async (req, res) => {
  try {
    await prisma.university.delete({ where: { id: req.params.id } });
    return ok(res, "University deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "University not found");
    if (err?.code === "P2003" || err?.code === "P2014") {
      return fail(res, 409, "University is in use and cannot be deleted");
    }
    return fail(res, 500, "Failed to delete university");
  }
});

// --- Diplomas ---
universityDataRoutes.get("/diplomas", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const universityId = String(req.query?.universityId ?? "").trim();
    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.universityDiploma.findMany({
      where: {
        ...(universityId ? { universityId } : {}),
        ...(q
          ? {
              OR: [{ name: { contains: q } }, { description: { contains: q } }],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
      skip,
      include: { university: { select: { id: true, name: true } } },
    });

    return ok(res, "Diplomas fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch diplomas");
  }
});

universityDataRoutes.post("/diplomas", async (req, res) => {
  try {
    const { universityId, name, description } = req.body ?? {};
    if (!universityId || typeof universityId !== "string") {
      return fail(res, 400, "universityId is required");
    }
    if (!name || typeof name !== "string") {
      return fail(res, 400, "name is required");
    }

    const row = await prisma.universityDiploma.create({
      data: {
        universityId: universityId.trim(),
        name: name.trim().slice(0, 180),
        description:
          typeof description === "string" && description.trim()
            ? String(description).trim().slice(0, 20_000)
            : null,
      },
      include: { university: { select: { id: true, name: true } } },
    });

    return created(res, "Diploma created", row);
  } catch (err: any) {
    if (err?.code === "P2002") return fail(res, 400, "Diploma already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to create diploma");
  }
});

universityDataRoutes.put("/diplomas/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};
    const row = await prisma.universityDiploma.update({
      where: { id: req.params.id },
      data: {
        ...(patch.universityId !== undefined
          ? { universityId: String(patch.universityId ?? "").trim() }
          : {}),
        ...(patch.name !== undefined
          ? {
              name: String(patch.name ?? "")
                .trim()
                .slice(0, 180),
            }
          : {}),
        ...(patch.description !== undefined
          ? {
              description:
                typeof patch.description === "string" &&
                patch.description.trim()
                  ? String(patch.description).trim().slice(0, 20_000)
                  : null,
            }
          : {}),
      },
      include: { university: { select: { id: true, name: true } } },
    });

    return ok(res, "Diploma updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Diploma not found");
    if (err?.code === "P2002") return fail(res, 400, "Diploma already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to update diploma");
  }
});

universityDataRoutes.delete("/diplomas/:id", async (req, res) => {
  try {
    await prisma.universityDiploma.delete({ where: { id: req.params.id } });
    return ok(res, "Diploma deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Diploma not found");
    return fail(res, 500, "Failed to delete diploma");
  }
});

// --- Departments (UniversityDepartment) ---
universityDataRoutes.get("/departments", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const universityId = String(req.query?.universityId ?? "").trim();
    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.universityDepartment.findMany({
      where: {
        ...(universityId ? { universityId } : {}),
        ...(q
          ? {
              OR: [{ name: { contains: q } }, { description: { contains: q } }],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
      skip,
      include: { university: { select: { id: true, name: true } } },
    });

    return ok(res, "Departments fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch departments");
  }
});

universityDataRoutes.post("/departments", async (req, res) => {
  try {
    const { universityId, name, description } = req.body ?? {};
    if (!universityId || typeof universityId !== "string") {
      return fail(res, 400, "universityId is required");
    }
    if (!name || typeof name !== "string") {
      return fail(res, 400, "name is required");
    }

    const row = await prisma.universityDepartment.create({
      data: {
        universityId: universityId.trim(),
        name: name.trim().slice(0, 180),
        description:
          typeof description === "string" && description.trim()
            ? String(description).trim().slice(0, 20_000)
            : null,
      },
      include: { university: { select: { id: true, name: true } } },
    });

    return created(res, "Department created", row);
  } catch (err: any) {
    if (err?.code === "P2002")
      return fail(res, 400, "Department already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to create department");
  }
});

universityDataRoutes.put("/departments/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};
    const row = await prisma.universityDepartment.update({
      where: { id: req.params.id },
      data: {
        ...(patch.universityId !== undefined
          ? { universityId: String(patch.universityId ?? "").trim() }
          : {}),
        ...(patch.name !== undefined
          ? {
              name: String(patch.name ?? "")
                .trim()
                .slice(0, 180),
            }
          : {}),
        ...(patch.description !== undefined
          ? {
              description:
                typeof patch.description === "string" &&
                patch.description.trim()
                  ? String(patch.description).trim().slice(0, 20_000)
                  : null,
            }
          : {}),
      },
      include: { university: { select: { id: true, name: true } } },
    });

    return ok(res, "Department updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Department not found");
    if (err?.code === "P2002")
      return fail(res, 400, "Department already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to update department");
  }
});

universityDataRoutes.delete("/departments/:id", async (req, res) => {
  try {
    await prisma.universityDepartment.delete({ where: { id: req.params.id } });
    return ok(res, "Department deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Department not found");
    if (err?.code === "P2003" || err?.code === "P2014") {
      return fail(res, 409, "Department is in use and cannot be deleted");
    }
    return fail(res, 500, "Failed to delete department");
  }
});

// --- Specialties ---
universityDataRoutes.get("/specialties", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const departmentId = String(req.query?.departmentId ?? "").trim();
    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.universitySpecialty.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(q
          ? {
              OR: [{ name: { contains: q } }, { description: { contains: q } }],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
      skip,
      include: {
        department: {
          include: { university: { select: { id: true, name: true } } },
        },
      },
    });

    return ok(res, "Specialties fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch specialties");
  }
});

universityDataRoutes.post("/specialties", async (req, res) => {
  try {
    const { departmentId, name, description } = req.body ?? {};
    if (!departmentId || typeof departmentId !== "string") {
      return fail(res, 400, "departmentId is required");
    }
    if (!name || typeof name !== "string") {
      return fail(res, 400, "name is required");
    }

    const row = await prisma.universitySpecialty.create({
      data: {
        departmentId: departmentId.trim(),
        name: name.trim().slice(0, 180),
        description:
          typeof description === "string" && description.trim()
            ? String(description).trim().slice(0, 20_000)
            : null,
      },
      include: {
        department: {
          include: { university: { select: { id: true, name: true } } },
        },
      },
    });

    return created(res, "Specialty created", row);
  } catch (err: any) {
    if (err?.code === "P2002")
      return fail(res, 400, "Specialty already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid departmentId");
    return fail(res, 500, "Failed to create specialty");
  }
});

universityDataRoutes.put("/specialties/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};
    const row = await prisma.universitySpecialty.update({
      where: { id: req.params.id },
      data: {
        ...(patch.departmentId !== undefined
          ? { departmentId: String(patch.departmentId ?? "").trim() }
          : {}),
        ...(patch.name !== undefined
          ? {
              name: String(patch.name ?? "")
                .trim()
                .slice(0, 180),
            }
          : {}),
        ...(patch.description !== undefined
          ? {
              description:
                typeof patch.description === "string" &&
                patch.description.trim()
                  ? String(patch.description).trim().slice(0, 20_000)
                  : null,
            }
          : {}),
      },
      include: {
        department: {
          include: { university: { select: { id: true, name: true } } },
        },
      },
    });

    return ok(res, "Specialty updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Specialty not found");
    if (err?.code === "P2002")
      return fail(res, 400, "Specialty already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid departmentId");
    return fail(res, 500, "Failed to update specialty");
  }
});

universityDataRoutes.delete("/specialties/:id", async (req, res) => {
  try {
    await prisma.universitySpecialty.delete({ where: { id: req.params.id } });
    return ok(res, "Specialty deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Specialty not found");
    if (err?.code === "P2003" || err?.code === "P2014") {
      return fail(res, 409, "Specialty is in use and cannot be deleted");
    }
    return fail(res, 500, "Failed to delete specialty");
  }
});

// --- Fees ---
universityDataRoutes.get("/fees", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const universityId = String(req.query?.universityId ?? "").trim();
    const specialtyId = String(req.query?.specialtyId ?? "").trim();
    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.universityFee.findMany({
      where: {
        ...(universityId ? { universityId } : {}),
        ...(specialtyId ? { specialtyId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
      skip,
      include: {
        university: { select: { id: true, name: true } },
        specialty: { select: { id: true, name: true } },
      },
    });

    return ok(res, "Fees fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch fees");
  }
});

universityDataRoutes.post("/fees", async (req, res) => {
  try {
    const { universityId, specialtyId, title, amount, currency, description } =
      req.body ?? {};
    if (!universityId || typeof universityId !== "string") {
      return fail(res, 400, "universityId is required");
    }
    if (!title || typeof title !== "string") {
      return fail(res, 400, "title is required");
    }

    const amountNum = coerceNumber(amount);
    const amountDecimal =
      amount === undefined || amount === null || amount === ""
        ? null
        : amountNum !== undefined
          ? new Prisma.Decimal(amountNum)
          : undefined;
    if (amountDecimal === undefined) {
      return fail(res, 400, "amount must be a number or null");
    }

    const row = await prisma.universityFee.create({
      data: {
        universityId: universityId.trim(),
        specialtyId:
          typeof specialtyId === "string" && specialtyId.trim()
            ? specialtyId.trim()
            : null,
        title: title.trim().slice(0, 180),
        amount: amountDecimal,
        currency:
          typeof currency === "string" && currency.trim()
            ? currency.trim().slice(0, 8)
            : "UZS",
        description:
          typeof description === "string" && description.trim()
            ? String(description).trim().slice(0, 20_000)
            : null,
      },
      include: {
        university: { select: { id: true, name: true } },
        specialty: { select: { id: true, name: true } },
      },
    });

    return created(res, "Fee created", row);
  } catch (err: any) {
    if (err?.code === "P2003") {
      return fail(res, 400, "Invalid universityId or specialtyId");
    }
    return fail(res, 500, "Failed to create fee");
  }
});

universityDataRoutes.put("/fees/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};

    const amountNum = coerceNumber(patch.amount);
    const amountDecimal =
      patch.amount === undefined
        ? undefined
        : patch.amount === null || patch.amount === ""
          ? null
          : amountNum !== undefined
            ? new Prisma.Decimal(amountNum)
            : undefined;
    if (patch.amount !== undefined && amountDecimal === undefined) {
      return fail(res, 400, "amount must be a number or null");
    }

    const row = await prisma.universityFee.update({
      where: { id: req.params.id },
      data: {
        ...(patch.universityId !== undefined
          ? { universityId: String(patch.universityId ?? "").trim() }
          : {}),
        ...(patch.specialtyId !== undefined
          ? {
              specialtyId:
                typeof patch.specialtyId === "string" &&
                patch.specialtyId.trim()
                  ? patch.specialtyId.trim()
                  : null,
            }
          : {}),
        ...(patch.title !== undefined
          ? {
              title: String(patch.title ?? "")
                .trim()
                .slice(0, 180),
            }
          : {}),
        ...(amountDecimal !== undefined ? { amount: amountDecimal } : {}),
        ...(patch.currency !== undefined
          ? {
              currency:
                typeof patch.currency === "string" && patch.currency.trim()
                  ? patch.currency.trim().slice(0, 8)
                  : "UZS",
            }
          : {}),
        ...(patch.description !== undefined
          ? {
              description:
                typeof patch.description === "string" &&
                patch.description.trim()
                  ? String(patch.description).trim().slice(0, 20_000)
                  : null,
            }
          : {}),
      },
      include: {
        university: { select: { id: true, name: true } },
        specialty: { select: { id: true, name: true } },
      },
    });

    return ok(res, "Fee updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Fee not found");
    if (err?.code === "P2003") {
      return fail(res, 400, "Invalid universityId or specialtyId");
    }
    return fail(res, 500, "Failed to update fee");
  }
});

universityDataRoutes.delete("/fees/:id", async (req, res) => {
  try {
    await prisma.universityFee.delete({ where: { id: req.params.id } });
    return ok(res, "Fee deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Fee not found");
    return fail(res, 500, "Failed to delete fee");
  }
});

// --- Facilities ---
universityDataRoutes.get("/facilities", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const universityId = String(req.query?.universityId ?? "").trim();
    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.universityFacility.findMany({
      where: {
        ...(universityId ? { universityId } : {}),
        ...(q
          ? {
              OR: [{ name: { contains: q } }, { description: { contains: q } }],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
      skip,
      include: { university: { select: { id: true, name: true } } },
    });

    return ok(res, "Facilities fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch facilities");
  }
});

universityDataRoutes.post("/facilities", async (req, res) => {
  try {
    const { universityId, name, description } = req.body ?? {};
    if (!universityId || typeof universityId !== "string") {
      return fail(res, 400, "universityId is required");
    }
    if (!name || typeof name !== "string") {
      return fail(res, 400, "name is required");
    }

    const row = await prisma.universityFacility.create({
      data: {
        universityId: universityId.trim(),
        name: name.trim().slice(0, 180),
        description:
          typeof description === "string" && description.trim()
            ? String(description).trim().slice(0, 20_000)
            : null,
      },
      include: { university: { select: { id: true, name: true } } },
    });

    return created(res, "Facility created", row);
  } catch (err: any) {
    if (err?.code === "P2002") return fail(res, 400, "Facility already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to create facility");
  }
});

universityDataRoutes.put("/facilities/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};
    const row = await prisma.universityFacility.update({
      where: { id: req.params.id },
      data: {
        ...(patch.universityId !== undefined
          ? { universityId: String(patch.universityId ?? "").trim() }
          : {}),
        ...(patch.name !== undefined
          ? {
              name: String(patch.name ?? "")
                .trim()
                .slice(0, 180),
            }
          : {}),
        ...(patch.description !== undefined
          ? {
              description:
                typeof patch.description === "string" &&
                patch.description.trim()
                  ? String(patch.description).trim().slice(0, 20_000)
                  : null,
            }
          : {}),
      },
      include: { university: { select: { id: true, name: true } } },
    });

    return ok(res, "Facility updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Facility not found");
    if (err?.code === "P2002") return fail(res, 400, "Facility already exists");
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to update facility");
  }
});

universityDataRoutes.delete("/facilities/:id", async (req, res) => {
  try {
    await prisma.universityFacility.delete({ where: { id: req.params.id } });
    return ok(res, "Facility deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Facility not found");
    if (err?.code === "P2003" || err?.code === "P2014") {
      return fail(res, 409, "Facility is in use and cannot be deleted");
    }
    return fail(res, 500, "Failed to delete facility");
  }
});

// --- Announcements (re-using receptionist announcements table) ---
universityDataRoutes.get("/announcements", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const universityId = String(req.query?.universityId ?? "").trim();
    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.receptionistAnnouncement.findMany({
      where: {
        ...(universityId ? { universityId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
                { targetAudience: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take,
      skip,
    });

    return ok(res, "Announcements fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch announcements");
  }
});

universityDataRoutes.post("/announcements", async (req, res) => {
  try {
    const {
      universityId,
      title,
      content,
      targetAudience,
      language,
      isActive,
      startsAt,
      endsAt,
    } = req.body ?? {};

    if (!title || typeof title !== "string")
      return fail(res, 400, "title is required");
    if (!content || typeof content !== "string")
      return fail(res, 400, "content is required");
    if (!targetAudience || typeof targetAudience !== "string") {
      return fail(res, 400, "targetAudience is required");
    }

    const lang =
      language === null
        ? null
        : language !== undefined
          ? coerceLanguage(language)
          : undefined;
    if (language !== undefined && language !== null && !lang) {
      return fail(res, 400, "language must be UZ|EN|JP or null");
    }

    const active = coerceBoolean(isActive);
    if (isActive !== undefined && active === undefined) {
      return fail(res, 400, "isActive must be a boolean");
    }

    const row = await prisma.receptionistAnnouncement.create({
      data: {
        universityId:
          typeof universityId === "string" && universityId.trim()
            ? universityId.trim()
            : null,
        title: title.trim().slice(0, 200),
        content: content.trim(),
        targetAudience: targetAudience.trim().slice(0, 80),
        language: lang ?? null,
        isActive: active ?? true,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });

    return created(res, "Announcement created", row);
  } catch (err: any) {
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to create announcement");
  }
});

universityDataRoutes.put("/announcements/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};

    const lang =
      patch.language === null
        ? null
        : patch.language !== undefined
          ? coerceLanguage(patch.language)
          : undefined;
    if (patch.language !== undefined && patch.language !== null && !lang) {
      return fail(res, 400, "language must be UZ|EN|JP or null");
    }

    const active = coerceBoolean(patch.isActive);
    if (patch.isActive !== undefined && active === undefined) {
      return fail(res, 400, "isActive must be a boolean");
    }

    const row = await prisma.receptionistAnnouncement.update({
      where: { id: req.params.id },
      data: {
        ...(patch.universityId !== undefined
          ? {
              universityId:
                typeof patch.universityId === "string" &&
                patch.universityId.trim()
                  ? patch.universityId.trim()
                  : null,
            }
          : {}),
        ...(patch.title !== undefined
          ? {
              title: String(patch.title ?? "")
                .trim()
                .slice(0, 200),
            }
          : {}),
        ...(patch.content !== undefined
          ? { content: String(patch.content ?? "").trim() }
          : {}),
        ...(patch.targetAudience !== undefined
          ? {
              targetAudience: String(patch.targetAudience ?? "")
                .trim()
                .slice(0, 80),
            }
          : {}),
        ...(patch.language !== undefined ? { language: lang } : {}),
        ...(patch.isActive !== undefined ? { isActive: active! } : {}),
        ...(patch.startsAt !== undefined
          ? { startsAt: patch.startsAt ? new Date(patch.startsAt) : null }
          : {}),
        ...(patch.endsAt !== undefined
          ? { endsAt: patch.endsAt ? new Date(patch.endsAt) : null }
          : {}),
      },
    });

    return ok(res, "Announcement updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Announcement not found");
    if (err?.code === "P2003") return fail(res, 400, "Invalid universityId");
    return fail(res, 500, "Failed to update announcement");
  }
});

universityDataRoutes.delete("/announcements/:id", async (req, res) => {
  try {
    await prisma.receptionistAnnouncement.delete({
      where: { id: req.params.id },
    });
    return ok(res, "Announcement deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Announcement not found");
    return fail(res, 500, "Failed to delete announcement");
  }
});

// --- AI Knowledge (re-using receptionist knowledge base table) ---
universityDataRoutes.get("/ai-knowledge", async (req, res) => {
  try {
    const q = asSearchQuery(req.query?.q);
    const category = String(req.query?.category ?? "").trim();
    const language =
      req.query?.language !== undefined
        ? coerceLanguage(req.query?.language)
        : undefined;
    if (req.query?.language !== undefined && !language) {
      return fail(res, 400, "language must be UZ|EN|JP");
    }

    const { take, skip } = parseTakeSkip(req.query);

    const rows = await prisma.receptionistKnowledgeBaseEntry.findMany({
      where: {
        ...(category ? { category: { contains: category } } : {}),
        ...(language ? { language } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
                { category: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take,
      skip,
    });

    return ok(res, "AI knowledge fetched", rows);
  } catch {
    return fail(res, 500, "Failed to fetch AI knowledge");
  }
});

universityDataRoutes.post("/ai-knowledge", async (req, res) => {
  try {
    const { title, content, category, language, tags, priority } =
      req.body ?? {};
    if (!title || typeof title !== "string")
      return fail(res, 400, "title is required");
    if (!content || typeof content !== "string")
      return fail(res, 400, "content is required");
    if (!category || typeof category !== "string")
      return fail(res, 400, "category is required");

    const lang = coerceLanguage(language);
    if (!lang) return fail(res, 400, "language is required (UZ|EN|JP)");

    const pr = priority !== undefined ? coerceNumber(priority) : undefined;
    if (priority !== undefined && pr === undefined) {
      return fail(res, 400, "priority must be a number");
    }

    const row = await prisma.receptionistKnowledgeBaseEntry.create({
      data: {
        title: title.trim().slice(0, 255),
        content: content.trim(),
        category: category.trim().slice(0, 64),
        language: lang,
        tags: tags ?? undefined,
        priority: pr ?? 0,
      },
    });

    return created(res, "AI knowledge created", row);
  } catch (err: any) {
    if (err?.code === "P2002") return fail(res, 400, "Duplicate entry");
    return fail(res, 500, "Failed to create AI knowledge entry");
  }
});

universityDataRoutes.put("/ai-knowledge/:id", async (req, res) => {
  try {
    const patch = req.body ?? {};
    const lang =
      patch.language !== undefined ? coerceLanguage(patch.language) : undefined;
    if (patch.language !== undefined && !lang) {
      return fail(res, 400, "language must be UZ|EN|JP");
    }

    const pr =
      patch.priority !== undefined ? coerceNumber(patch.priority) : undefined;
    if (patch.priority !== undefined && pr === undefined) {
      return fail(res, 400, "priority must be a number");
    }

    const row = await prisma.receptionistKnowledgeBaseEntry.update({
      where: { id: req.params.id },
      data: {
        ...(patch.title !== undefined
          ? {
              title: String(patch.title ?? "")
                .trim()
                .slice(0, 255),
            }
          : {}),
        ...(patch.content !== undefined
          ? { content: String(patch.content ?? "").trim() }
          : {}),
        ...(patch.category !== undefined
          ? {
              category: String(patch.category ?? "")
                .trim()
                .slice(0, 64),
            }
          : {}),
        ...(patch.language !== undefined ? { language: lang! } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.priority !== undefined ? { priority: pr! } : {}),
      },
    });

    return ok(res, "AI knowledge updated", row);
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Entry not found");
    return fail(res, 500, "Failed to update AI knowledge entry");
  }
});

universityDataRoutes.delete("/ai-knowledge/:id", async (req, res) => {
  try {
    await prisma.receptionistKnowledgeBaseEntry.delete({
      where: { id: req.params.id },
    });
    return ok(res, "AI knowledge deleted");
  } catch (err: any) {
    if (err?.code === "P2025") return fail(res, 404, "Entry not found");
    return fail(res, 500, "Failed to delete AI knowledge entry");
  }
});
