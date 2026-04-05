import type { Request, Response } from "express";
import { ReceptionistLanguage, ReceptionistPersonality } from "@prisma/client";
import { created, fail, ok } from "../../utils/responses";
import { AdminReceptionistService } from "../../services/receptionist/AdminReceptionistService";
import { normalizeText } from "../../services/receptionist/receptionistText";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

function coerceLanguage(raw: unknown): ReceptionistLanguage | undefined {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "UZ") return "UZ";
  if (v === "EN") return "EN";
  if (v === "JP" || v === "JA") return "JP";
  return undefined;
}

function coercePersonality(raw: unknown): ReceptionistPersonality | undefined {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "FRIENDLY") return "FRIENDLY";
  if (v === "FORMAL") return "FORMAL";
  return undefined;
}

function ensureUploadsDir(): string {
  const dir = path.resolve(process.cwd(), "uploads", "receptionist");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeExt(originalName: string): string {
  const ext = path.extname(originalName || "").toLowerCase();
  if (ext === ".glb" || ext === ".gltf") return ext;
  return "";
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

function coerceNumber(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function coerceStringOrNull(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === "string") return raw;
  return undefined;
}

function coerceStringList(raw: unknown): string[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  const toList = (items: unknown[]) =>
    items
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, 60);

  if (Array.isArray(raw)) {
    const out = toList(raw);
    return out.length ? out : null;
  }

  if (typeof raw === "string") {
    const out = toList(
      raw
        .split(/[\n,]+/g)
        .map((s) => s.trim())
        .filter(Boolean),
    );
    return out.length ? out : null;
  }

  return undefined;
}

export class AdminReceptionistController {
  constructor(private readonly service: AdminReceptionistService) {}

  // --- Knowledge Base ---
  listKnowledgeBase = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const category =
        typeof req.query.category === "string" ? req.query.category : undefined;
      const language = coerceLanguage(req.query.language);
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const data = await this.service.listKnowledgeBase({
        q,
        category,
        language,
        take,
        skip,
      });
      return ok(res, "Knowledge base fetched", data);
    } catch {
      return fail(res, 500, "Failed to fetch knowledge base");
    }
  };

  createKnowledgeBase = async (req: Request, res: Response) => {
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

      const row = await this.service.createKnowledgeBase({
        title,
        content,
        category,
        language: lang,
        tags,
        priority,
      });

      return created(res, "Knowledge base entry created", row);
    } catch (err: any) {
      if (err?.code === "P2002") return fail(res, 400, "Duplicate entry");
      return fail(res, 500, "Failed to create knowledge base entry");
    }
  };

  updateKnowledgeBase = async (req: Request, res: Response) => {
    try {
      const patch = req.body ?? {};
      const lang =
        patch.language !== undefined
          ? coerceLanguage(patch.language)
          : undefined;
      if (patch.language !== undefined && !lang) {
        return fail(res, 400, "language must be UZ|EN|JP");
      }

      const row = await this.service.updateKnowledgeBase(req.params.id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.language !== undefined ? { language: lang! } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      });

      return ok(res, "Knowledge base entry updated", row);
    } catch (err: any) {
      if (err?.code === "P2025") return fail(res, 404, "Entry not found");
      return fail(res, 500, "Failed to update knowledge base entry");
    }
  };

  deleteKnowledgeBase = async (req: Request, res: Response) => {
    try {
      await this.service.deleteKnowledgeBase(req.params.id);
      return ok(res, "Knowledge base entry deleted");
    } catch (err: any) {
      if (err?.code === "P2025") return fail(res, 404, "Entry not found");
      return fail(res, 500, "Failed to delete knowledge base entry");
    }
  };

  // --- Locations ---
  listLocations = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const data = await this.service.listLocations({ q, take, skip });
      return ok(res, "Locations fetched", data);
    } catch {
      return fail(res, 500, "Failed to fetch locations");
    }
  };

  createLocation = async (req: Request, res: Response) => {
    try {
      const { name, building, floor, description } = req.body ?? {};
      if (!name || typeof name !== "string")
        return fail(res, 400, "name is required");

      const row = await this.service.createLocation({
        name,
        building: typeof building === "string" ? building : null,
        floor: typeof floor === "string" ? floor : null,
        description: typeof description === "string" ? description : null,
      });

      return created(res, "Location created", row);
    } catch (err: any) {
      if (err?.code === "P2002")
        return fail(res, 400, "Location name must be unique");
      return fail(res, 500, "Failed to create location");
    }
  };

  updateLocation = async (req: Request, res: Response) => {
    try {
      const patch = req.body ?? {};
      const row = await this.service.updateLocation(req.params.id, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.building !== undefined ? { building: patch.building } : {}),
        ...(patch.floor !== undefined ? { floor: patch.floor } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
      });
      return ok(res, "Location updated", row);
    } catch (err: any) {
      if (err?.code === "P2002")
        return fail(res, 400, "Location name must be unique");
      if (err?.code === "P2025") return fail(res, 404, "Location not found");
      return fail(res, 500, "Failed to update location");
    }
  };

  deleteLocation = async (req: Request, res: Response) => {
    try {
      await this.service.deleteLocation(req.params.id);
      return ok(res, "Location deleted");
    } catch (err: any) {
      if (err?.code === "P2003" || err?.code === "P2014") {
        return fail(res, 409, "Location is in use and cannot be deleted");
      }
      if (err?.code === "P2025") return fail(res, 404, "Location not found");
      return fail(res, 500, "Failed to delete location");
    }
  };

  // --- Directions ---
  listDirections = async (req: Request, res: Response) => {
    try {
      const fromLocationId =
        typeof req.query.fromLocationId === "string"
          ? req.query.fromLocationId
          : undefined;
      const toLocationId =
        typeof req.query.toLocationId === "string"
          ? req.query.toLocationId
          : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const data = await this.service.listDirections({
        fromLocationId,
        toLocationId,
        take,
        skip,
      });

      return ok(res, "Directions fetched", data);
    } catch {
      return fail(res, 500, "Failed to fetch directions");
    }
  };

  createDirection = async (req: Request, res: Response) => {
    try {
      const { fromLocationId, toLocationId, instructions } = req.body ?? {};
      if (!fromLocationId || typeof fromLocationId !== "string") {
        return fail(res, 400, "fromLocationId is required");
      }
      if (!toLocationId || typeof toLocationId !== "string") {
        return fail(res, 400, "toLocationId is required");
      }
      if (!instructions || typeof instructions !== "string") {
        return fail(res, 400, "instructions is required");
      }

      const row = await this.service.createDirection({
        fromLocationId,
        toLocationId,
        instructions,
      });

      return created(res, "Direction created", row);
    } catch (err: any) {
      if (err?.code === "P2002")
        return fail(res, 400, "Direction already exists");
      if (err?.code === "P2003") return fail(res, 400, "Invalid location id");
      return fail(res, 500, "Failed to create direction");
    }
  };

  updateDirection = async (req: Request, res: Response) => {
    try {
      const patch = req.body ?? {};
      const row = await this.service.updateDirection(req.params.id, {
        ...(patch.fromLocationId !== undefined
          ? { fromLocationId: patch.fromLocationId }
          : {}),
        ...(patch.toLocationId !== undefined
          ? { toLocationId: patch.toLocationId }
          : {}),
        ...(patch.instructions !== undefined
          ? { instructions: patch.instructions }
          : {}),
      });

      return ok(res, "Direction updated", row);
    } catch (err: any) {
      if (err?.code === "P2002")
        return fail(res, 400, "Direction already exists");
      if (err?.code === "P2003") return fail(res, 400, "Invalid location id");
      if (err?.code === "P2025") return fail(res, 404, "Direction not found");
      return fail(res, 500, "Failed to update direction");
    }
  };

  deleteDirection = async (req: Request, res: Response) => {
    try {
      await this.service.deleteDirection(req.params.id);
      return ok(res, "Direction deleted");
    } catch (err: any) {
      if (err?.code === "P2025") return fail(res, 404, "Direction not found");
      return fail(res, 500, "Failed to delete direction");
    }
  };

  // --- Avatar ---
  getAvatar = async (_req: Request, res: Response) => {
    try {
      const data = await this.service.getAvatar();
      return ok(res, "Avatar fetched", data);
    } catch {
      return fail(res, 500, "Failed to fetch avatar");
    }
  };

  patchAvatar = async (req: Request, res: Response) => {
    try {
      const patch = req.body ?? {};

      const language =
        patch.language !== undefined
          ? coerceLanguage(patch.language)
          : undefined;
      if (patch.language !== undefined && !language) {
        return fail(res, 400, "language must be UZ|EN|JP");
      }

      const inputLanguage =
        patch.inputLanguage !== undefined
          ? coerceLanguage(patch.inputLanguage)
          : undefined;
      if (patch.inputLanguage !== undefined && !inputLanguage) {
        return fail(res, 400, "inputLanguage must be UZ|EN|JP");
      }

      const outputLanguage =
        patch.outputLanguage !== undefined
          ? coerceLanguage(patch.outputLanguage)
          : undefined;
      if (patch.outputLanguage !== undefined && !outputLanguage) {
        return fail(res, 400, "outputLanguage must be UZ|EN|JP");
      }

      const personality =
        patch.personality !== undefined
          ? coercePersonality(patch.personality)
          : undefined;
      if (patch.personality !== undefined && !personality) {
        return fail(res, 400, "personality must be FRIENDLY|FORMAL");
      }

      const systemPrompt = coerceStringOrNull(patch.systemPrompt);
      if (patch.systemPrompt !== undefined && systemPrompt === undefined) {
        return fail(res, 400, "systemPrompt must be a string or null");
      }

      const responseStyle = coerceStringOrNull(patch.responseStyle);
      if (patch.responseStyle !== undefined && responseStyle === undefined) {
        return fail(res, 400, "responseStyle must be a string or null");
      }

      const maxResponseTokens = coerceNumber(patch.maxResponseTokens);
      if (
        patch.maxResponseTokens !== undefined &&
        maxResponseTokens === undefined
      ) {
        return fail(res, 400, "maxResponseTokens must be a number");
      }

      const temperature = coerceNumber(patch.temperature);
      if (patch.temperature !== undefined && temperature === undefined) {
        return fail(res, 400, "temperature must be a number");
      }

      const autoRefreshKnowledge = coerceBoolean(patch.autoRefreshKnowledge);
      if (
        patch.autoRefreshKnowledge !== undefined &&
        autoRefreshKnowledge === undefined
      ) {
        return fail(res, 400, "autoRefreshKnowledge must be a boolean");
      }

      const allowedTopics = coerceStringList(patch.allowedTopics);
      if (patch.allowedTopics !== undefined && allowedTopics === undefined) {
        return fail(
          res,
          400,
          "allowedTopics must be a string[], string, or null",
        );
      }

      const blockedTopics = coerceStringList(patch.blockedTopics);
      if (patch.blockedTopics !== undefined && blockedTopics === undefined) {
        return fail(
          res,
          400,
          "blockedTopics must be a string[], string, or null",
        );
      }

      const data = await this.service.updateAvatar({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.modelUrl !== undefined ? { modelUrl: patch.modelUrl } : {}),
        ...(patch.voice !== undefined ? { voice: patch.voice } : {}),
        ...(patch.language !== undefined ? { language: language! } : {}),
        ...(patch.inputLanguage !== undefined
          ? { inputLanguage: inputLanguage! }
          : {}),
        ...(patch.outputLanguage !== undefined
          ? { outputLanguage: outputLanguage! }
          : {}),
        ...(patch.personality !== undefined
          ? { personality: personality! }
          : {}),

        ...(patch.systemPrompt !== undefined
          ? { systemPrompt: systemPrompt! }
          : {}),
        ...(patch.responseStyle !== undefined
          ? { responseStyle: responseStyle! }
          : {}),
        ...(patch.maxResponseTokens !== undefined
          ? { maxResponseTokens: maxResponseTokens! }
          : {}),
        ...(patch.temperature !== undefined
          ? { temperature: temperature! }
          : {}),

        ...(patch.autoRefreshKnowledge !== undefined
          ? { autoRefreshKnowledge: autoRefreshKnowledge! }
          : {}),
        ...(patch.allowedTopics !== undefined
          ? { allowedTopics: allowedTopics! }
          : {}),
        ...(patch.blockedTopics !== undefined
          ? { blockedTopics: blockedTopics! }
          : {}),
      });

      return ok(res, "Avatar updated", data);
    } catch {
      return fail(res, 500, "Failed to update avatar");
    }
  };

  uploadAvatarModel = async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return fail(res, 400, "model file is required");

      const ext = safeExt(file.originalname);
      if (!ext) return fail(res, 400, "Only .glb or .gltf files are allowed");

      const dir = ensureUploadsDir();
      const filename = `leia-${Date.now()}-${randomUUID()}${ext}`;
      const outPath = path.join(dir, filename);

      await fs.promises.writeFile(outPath, file.buffer);

      const modelUrl = `/uploads/receptionist/${filename}`;
      const data = await this.service.updateAvatar({ modelUrl });

      return ok(res, "Model uploaded", data);
    } catch {
      return fail(res, 500, "Failed to upload model");
    }
  };

  // --- Announcements ---
  listAnnouncements = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const activeOnly =
        req.query.activeOnly === "true" || req.query.activeOnly === "1";
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const data = await this.service.listAnnouncements({
        q,
        activeOnly,
        take,
        skip,
      });

      return ok(res, "Announcements fetched", data);
    } catch {
      return fail(res, 500, "Failed to fetch announcements");
    }
  };

  createAnnouncement = async (req: Request, res: Response) => {
    try {
      const {
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

      const lang = language === null ? null : coerceLanguage(language);
      if (language !== undefined && language !== null && !lang) {
        return fail(res, 400, "language must be UZ|EN|JP or null");
      }

      const row = await this.service.createAnnouncement({
        title,
        content,
        targetAudience,
        language: lang ?? null,
        isActive,
        startsAt,
        endsAt,
      });

      return created(res, "Announcement created", row);
    } catch {
      return fail(res, 500, "Failed to create announcement");
    }
  };

  updateAnnouncement = async (req: Request, res: Response) => {
    try {
      const patch = req.body ?? {};

      const lang =
        patch.language === null ? null : coerceLanguage(patch.language);
      if (patch.language !== undefined && patch.language !== null && !lang) {
        return fail(res, 400, "language must be UZ|EN|JP or null");
      }

      const row = await this.service.updateAnnouncement(req.params.id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.targetAudience !== undefined
          ? { targetAudience: patch.targetAudience }
          : {}),
        ...(patch.language !== undefined ? { language: lang } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt } : {}),
        ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt } : {}),
      });

      return ok(res, "Announcement updated", row);
    } catch (err: any) {
      if (err?.code === "P2025")
        return fail(res, 404, "Announcement not found");
      return fail(res, 500, "Failed to update announcement");
    }
  };

  deleteAnnouncement = async (req: Request, res: Response) => {
    try {
      await this.service.deleteAnnouncement(req.params.id);
      return ok(res, "Announcement deleted");
    } catch (err: any) {
      if (err?.code === "P2025")
        return fail(res, 404, "Announcement not found");
      return fail(res, 500, "Failed to delete announcement");
    }
  };
}
