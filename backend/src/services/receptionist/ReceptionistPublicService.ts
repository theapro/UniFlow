import {
  ReceptionistLanguage,
  ReceptionistMessageModality,
  ReceptionistMessageSender,
  ReceptionistPersonality,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { ReceptionistIntentClassifier } from "./ReceptionistIntentClassifier";
import { ReceptionistLlmService } from "./ReceptionistLlmService";
import {
  coerceReceptionistLanguage,
  detectReceptionistLanguage,
  normalizeText,
  stripThinkBlocks,
} from "./receptionistText";

export type ReceptionistInitResponse = {
  conversationId: string;
  avatar: {
    name: string;
    modelUrl: string | null;
    voice: string | null;
    // Back-compat (represents output language)
    language: ReceptionistLanguage;
    inputLanguage: ReceptionistLanguage;
    outputLanguage: ReceptionistLanguage;
    personality: ReceptionistPersonality;
  };
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    targetAudience: string;
    language: ReceptionistLanguage | null;
    startsAt: string | null;
    endsAt: string | null;
  }>;
  messages: Array<{
    id: string;
    sender: ReceptionistMessageSender;
    modality: ReceptionistMessageModality;
    text: string;
    createdAt: string;
  }>;
};

export type ReceptionistChatResponse = {
  conversationId: string;
  intent: string;
  replyText: string;
};

function nowIso(d: Date) {
  return d.toISOString();
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export class ReceptionistPublicService {
  private readonly classifier = new ReceptionistIntentClassifier();
  private readonly llm = new ReceptionistLlmService();

  // In-process cache (used only when autoRefreshKnowledge=false).
  // Keeps the last loaded snapshot per language.
  private static kbCache = new Map<
    ReceptionistLanguage,
    {
      loadedAt: number;
      rows: Array<{
        id: string;
        title: string;
        content: string;
        category: string;
        priority: number;
        updatedAtMs: number;
      }>;
    }
  >();

  async getAvatar() {
    return this.getOrCreateAvatar();
  }

  async init(params: {
    conversationId?: string | null;
    language?: ReceptionistLanguage | null;
    messageLimit?: number;
  }): Promise<ReceptionistInitResponse> {
    const limit = clampInt(params.messageLimit ?? 80, 0, 400);

    const avatar = await this.getOrCreateAvatar();

    const language: ReceptionistLanguage =
      params.language ??
      (params.conversationId
        ? await this.getConversationLanguage(params.conversationId)
        : null) ??
      avatar.outputLanguage ??
      "UZ";

    const conversationId = await this.ensureConversation({
      conversationId: params.conversationId,
      language,
    });

    const announcements = await this.listActiveAnnouncements({
      language,
      take: 10,
    });

    const messages =
      limit > 0
        ? await prisma.receptionistMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            take: limit,
            select: {
              id: true,
              sender: true,
              modality: true,
              text: true,
              createdAt: true,
            },
          })
        : [];

    return {
      conversationId,
      avatar: {
        name: avatar.name,
        modelUrl: avatar.modelUrl ?? null,
        voice: avatar.voice ?? null,
        language: avatar.outputLanguage,
        inputLanguage: avatar.inputLanguage,
        outputLanguage: avatar.outputLanguage,
        personality: avatar.personality,
      },
      announcements,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        modality: m.modality,
        text: m.text,
        createdAt: nowIso(m.createdAt),
      })),
    };
  }

  async chat(params: {
    conversationId?: string | null;
    message: string;
    language?: ReceptionistLanguage | null;
    modality?: ReceptionistMessageModality;
    assistantModality?: ReceptionistMessageModality;
  }): Promise<ReceptionistChatResponse> {
    const cleaned = normalizeText(params.message);
    if (!cleaned) throw new Error("message is required");

    const avatar = await this.getOrCreateAvatar();

    const detected = detectReceptionistLanguage(cleaned);
    const language = params.language ?? avatar.outputLanguage ?? detected;

    const conversationId = await this.ensureConversation({
      conversationId: params.conversationId ?? undefined,
      language,
    });

    await prisma.receptionistConversation.update({
      where: { id: conversationId },
      data: { lastActiveAt: new Date() },
      select: { id: true },
    });

    await prisma.receptionistMessage.create({
      data: {
        conversationId,
        sender: "USER",
        modality: params.modality ?? "TEXT",
        text: cleaned.slice(0, 5000),
      },
      select: { id: true },
    });

    const decision = await this.classifier.classify({
      message: cleaned,
      useLlm: true,
    });

    const replyText = await this.buildReply({
      message: cleaned,
      language,
      intent: decision.intent,
      avatar,
    });

    // Ensure hidden LLM reasoning never reaches storage or clients.
    const safeReplyText = stripThinkBlocks(replyText) || replyText;

    await prisma.receptionistMessage.create({
      data: {
        conversationId,
        sender: "ASSISTANT",
        modality: params.assistantModality ?? "TEXT",
        text: safeReplyText.slice(0, 9000),
        meta: {
          intent: decision.intent,
          confidence: decision.confidence,
        },
      },
      select: { id: true },
    });

    return {
      conversationId,
      intent: decision.intent,
      replyText: safeReplyText,
    };
  }

  private async getConversationLanguage(
    conversationId: string,
  ): Promise<ReceptionistLanguage | null> {
    const row = await prisma.receptionistConversation.findUnique({
      where: { id: conversationId },
      select: { language: true },
    });
    return row?.language ?? null;
  }

  private async ensureConversation(params: {
    conversationId?: string | null;
    language: ReceptionistLanguage;
  }): Promise<string> {
    const id = String(params.conversationId ?? "").trim();
    const conversationId = id.length > 0 ? id : randomUUID();

    await prisma.receptionistConversation.upsert({
      where: { id: conversationId },
      update: {
        language: params.language,
        lastActiveAt: new Date(),
      },
      create: {
        id: conversationId,
        language: params.language,
        lastActiveAt: new Date(),
      },
      select: { id: true },
    });

    return conversationId;
  }

  private async getOrCreateAvatar() {
    return prisma.receptionistAiAvatar.upsert({
      where: { key: "default" },
      update: {},
      create: {
        key: "default",
        name: "LEIA",
        language: "UZ",
        inputLanguage: "UZ",
        outputLanguage: "UZ",
        personality: "FRIENDLY",
      },
      select: {
        id: true,
        key: true,
        name: true,
        modelUrl: true,
        voice: true,
        language: true,
        inputLanguage: true,
        outputLanguage: true,
        personality: true,

        systemPrompt: true,
        responseStyle: true,
        maxResponseTokens: true,
        temperature: true,

        autoRefreshKnowledge: true,
        allowedTopics: true,
        blockedTopics: true,
      },
    });
  }

  private async listActiveAnnouncements(params: {
    language: ReceptionistLanguage;
    take: number;
  }) {
    const now = new Date();

    const rows = await prisma.receptionistAnnouncement.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
        // Allow language-specific + language-agnostic
        OR: [{ language: null }, { language: params.language }],
      },
      orderBy: [{ createdAt: "desc" }],
      take: clampInt(params.take, 0, 50),
      select: {
        id: true,
        title: true,
        content: true,
        targetAudience: true,
        language: true,
        startsAt: true,
        endsAt: true,
      },
    });

    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      targetAudience: a.targetAudience,
      language: a.language ?? null,
      startsAt: a.startsAt ? nowIso(a.startsAt) : null,
      endsAt: a.endsAt ? nowIso(a.endsAt) : null,
    }));
  }

  private async buildReply(params: {
    message: string;
    language: ReceptionistLanguage;
    intent: string;
    avatar: {
      name: string;
      language: ReceptionistLanguage;
      personality: ReceptionistPersonality;

      systemPrompt?: string | null;
      responseStyle?: string | null;
      maxResponseTokens?: number;
      temperature?: number;

      autoRefreshKnowledge?: boolean;
      allowedTopics?: any;
      blockedTopics?: any;
    };
  }): Promise<string> {
    const lang = params.language;

    const msgNorm = normalizeText(params.message).toLowerCase();
    const intentNorm = String(params.intent ?? "")
      .trim()
      .toLowerCase();

    const toStringList = (raw: any): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) {
        return raw
          .map((x) => normalizeText(String(x ?? "")))
          .filter(Boolean)
          .slice(0, 60);
      }
      if (typeof raw === "string") {
        return raw
          .split(/[\n,]+/g)
          .map((s) => normalizeText(s))
          .filter(Boolean)
          .slice(0, 60);
      }
      return [];
    };

    const matchesTopic = (topicRaw: string) => {
      const t = normalizeText(topicRaw).toLowerCase();
      if (!t) return false;
      if (t === intentNorm) return true;
      return msgNorm.includes(t);
    };

    const blockedTopics = toStringList(params.avatar.blockedTopics);
    if (blockedTopics.length > 0 && blockedTopics.some(matchesTopic)) {
      return this.wrapLang(
        lang,
        "Sorry — I can't help with that topic.",
        "Kechirasiz — bu mavzu bo'yicha yordam bera olmayman.",
        "申し訳ありませんが、その話題には対応できません。",
      );
    }

    const allowedTopics = toStringList(params.avatar.allowedTopics);
    if (allowedTopics.length > 0 && !allowedTopics.some(matchesTopic)) {
      const list = allowedTopics.join(", ").slice(0, 220);
      return this.wrapLang(
        lang,
        `I can help with these topics: ${list}.`,
        `Men quyidagi mavzular bo'yicha yordam bera olaman: ${list}.`,
        `対応できる話題: ${list}。`,
      );
    }

    // Always attempt structured lookup first.
    const [locations, kb, schedule, announcements] = await Promise.all([
      this.findLocations({ query: params.message, take: 5 }),
      this.findKnowledgeBase({
        query: params.message,
        language: lang,
        take: 5,
        autoRefreshKnowledge: params.avatar.autoRefreshKnowledge !== false,
      }),
      this.findSchedule({ query: params.message, take: 12 }),
      this.findAnnouncementsByQuery({
        query: params.message,
        language: lang,
        take: 5,
      }),
    ]);

    const contextIsEmpty =
      locations.length === 0 &&
      kb.length === 0 &&
      schedule.length === 0 &&
      announcements.length === 0;

    // If intent is clear and we have deterministic answers, return without LLM.
    if (params.intent === "announcement" && announcements.length > 0) {
      const lines = announcements.map((a) =>
        `- ${a.title}: ${a.content}`.slice(0, 500),
      );
      return this.wrapLang(
        lang,
        `${params.avatar.name}: Here are the latest announcements:\n${lines.join("\n")}`,
        `#${params.avatar.name}: Oxirgi e'lonlar:\n${lines.join("\n")}`,
        `${params.avatar.name}: 最新のお知らせです。\n${lines.join("\n")}`,
      );
    }

    if (params.intent === "location" && locations.length > 0) {
      const best = locations[0];
      const parts = [
        best.name,
        best.building ? `Building: ${best.building}` : null,
        best.floor ? `Floor: ${best.floor}` : null,
        best.description ? best.description : null,
      ].filter(Boolean);

      const textEn = `The location is: ${parts.join(". ")}.`;
      const textUz = `Joylashuv: ${[
        best.name,
        best.building ? `Bino: ${best.building}` : null,
        best.floor ? `Qavat: ${best.floor}` : null,
        best.description ? best.description : null,
      ]
        .filter(Boolean)
        .join(". ")}.`;
      const textJp = `場所: ${best.name}${best.building ? `（建物: ${best.building}）` : ""}${best.floor ? `（階: ${best.floor}）` : ""}${best.description ? `。${best.description}` : ""}`;

      return this.wrapLang(lang, textEn, textUz, textJp);
    }

    if (params.intent === "schedule" && schedule.length > 0) {
      const lines = schedule.map(
        (s) => `- ${s.weekday} ${s.time} — ${s.subject} (${s.group})`,
      );
      const textEn = `Here is what I found in the schedule:\n${lines.join("\n")}`;
      const textUz = `Jadvaldan topilgan natijalar:\n${lines.join("\n")}`;
      const textJp = `時間割の検索結果です。\n${lines.join("\n")}`;
      return this.wrapLang(lang, textEn, textUz, textJp);
    }

    // Otherwise: RAG-ish LLM response.
    const persona = this.personaPrompt({
      name: params.avatar.name,
      personality: params.avatar.personality,
      language: lang,
    });

    const systemPrompt =
      typeof params.avatar.systemPrompt === "string" &&
      params.avatar.systemPrompt.trim()
        ? String(params.avatar.systemPrompt).trim().slice(0, 12000)
        : "";

    const responseStyle =
      typeof params.avatar.responseStyle === "string" &&
      params.avatar.responseStyle.trim()
        ? String(params.avatar.responseStyle).trim().slice(0, 6000)
        : "";

    const temperatureRaw = Number(params.avatar.temperature);
    const temperature =
      Number.isFinite(temperatureRaw) &&
      temperatureRaw >= 0 &&
      temperatureRaw <= 1
        ? temperatureRaw
        : 0.4;

    const maxTokensRaw = Number(params.avatar.maxResponseTokens);
    const maxTokens =
      Number.isFinite(maxTokensRaw) &&
      maxTokensRaw >= 80 &&
      maxTokensRaw <= 2000
        ? Math.floor(maxTokensRaw)
        : 900;

    const context = {
      locations,
      knowledgeBase: kb,
      schedule,
      announcements,
    };

    // DB > Knowledge Base > AI: only allow AI fallback when intent is general.
    if (contextIsEmpty && params.intent !== "general") {
      return this.wrapLang(
        lang,
        "I don't have enough information for that right now. Please contact the university staff.",
        "Hozir bu savol bo'yicha yetarli ma'lumotim yo'q. Iltimos, universitet xodimlariga murojaat qiling.",
        "その質問に答えるための十分な情報がありません。大学の担当者にお問い合わせください。",
      );
    }

    try {
      const baseRules =
        "You are a real university receptionist. Be concise, helpful, and ask a clarifying question if needed. " +
        "Do NOT include <think> tags or hidden reasoning. Return only the final answer.";

      const styleRule = responseStyle
        ? `\nResponse style:\n${responseStyle}`
        : "";

      const adminSystem = systemPrompt
        ? `\nAdditional system instructions:\n${systemPrompt}`
        : "";

      // If we have context, strictly ground facts in it.
      if (!contextIsEmpty) {
        const messages: any[] = [
          {
            role: "system",
            content:
              persona +
              adminSystem +
              styleRule +
              "\n" +
              baseRules +
              "\nUse ONLY the provided CONTEXT data as facts. If data is missing, say you are not sure and suggest contacting staff.",
          },
          {
            role: "user",
            content: `USER_QUESTION:\n${params.message}\n\nCONTEXT_JSON:\n${JSON.stringify(context)}`,
          },
        ];

        const res = await this.llm.chat({
          messages,
          temperature,
          maxTokens,
        });

        const content = normalizeText(stripThinkBlocks(res.content));
        if (content) return content.slice(0, 3000);
      }

      // AI fallback (general only): do not invent university-specific facts.
      const messages: any[] = [
        {
          role: "system",
          content:
            persona +
            adminSystem +
            styleRule +
            "\n" +
            baseRules +
            "\nYou may answer general questions. Do NOT guess or invent university-specific facts (fees, deadlines, rules, schedules, office locations). " +
            "If the user asks for those, say you are not sure and suggest contacting staff.",
        },
        {
          role: "user",
          content: params.message,
        },
      ];

      const res = await this.llm.chat({
        messages,
        temperature,
        maxTokens,
      });

      const content = normalizeText(stripThinkBlocks(res.content));
      if (content) return content.slice(0, 3000);
    } catch {
      // fall through
    }

    // Last resort fallback.
    return this.wrapLang(
      lang,
      "I can help with locations, directions, schedules, and admissions. What exactly do you need?",
      "Men joylashuvlar, yo'nalishlar, jadval va qabul bo'yicha yordam bera olaman. Aniq nimani bilmoqchisiz?",
      "場所、行き方、時間割、入学情報について案内できます。具体的に何を知りたいですか？",
    );
  }

  private wrapLang(
    lang: ReceptionistLanguage,
    en: string,
    uz: string,
    jp: string,
  ) {
    if (lang === "JP") return jp;
    if (lang === "UZ") return uz;
    return en;
  }

  private personaPrompt(params: {
    name: string;
    personality: ReceptionistPersonality;
    language: ReceptionistLanguage;
  }): string {
    const base = `Your name is ${params.name}.`;

    const tone =
      params.personality === "FORMAL"
        ? "Use a formal, professional tone."
        : "Use a warm, friendly, professional tone.";

    const lang =
      params.language === "JP"
        ? "Reply in Japanese."
        : params.language === "UZ"
          ? "Reply in Uzbek."
          : "Reply in English.";

    return `${base} ${tone} ${lang}`;
  }

  private async findLocations(params: { query: string; take: number }) {
    const q = normalizeText(params.query);
    if (!q) return [];

    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .map((t) =>
        t.replace(/[^a-z0-9а-яёўқғҳ\u3040-\u30FF\u4E00-\u9FFF]/gi, ""),
      )
      .filter((t) => t.length >= 3)
      .slice(0, 8);

    const or = tokens.map((t) => ({
      OR: [
        { name: { contains: t } },
        { building: { contains: t } },
        { description: { contains: t } },
      ],
    }));

    const rows = await prisma.receptionistLocation.findMany({
      where:
        tokens.length > 0 ? { OR: or.map((x) => (x as any).OR).flat() } : {},
      orderBy: [{ name: "asc" }],
      take: clampInt(params.take, 0, 20),
      select: {
        id: true,
        name: true,
        building: true,
        floor: true,
        description: true,
      },
    });

    return rows.map((l) => ({
      id: l.id,
      name: l.name,
      building: l.building ?? null,
      floor: l.floor ?? null,
      description: l.description ?? null,
    }));
  }

  private async findKnowledgeBase(params: {
    query: string;
    language: ReceptionistLanguage;
    take: number;
    autoRefreshKnowledge?: boolean;
  }) {
    const q = normalizeText(params.query);
    if (!q) return [];

    const take = clampInt(params.take, 0, 20);

    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .slice(0, 10);

    // Default behavior: always query DB (fresh).
    if (params.autoRefreshKnowledge !== false) {
      const or = tokens.flatMap((t) => [
        { title: { contains: t } },
        { content: { contains: t } },
        { category: { contains: t } },
      ]);

      const rows = await prisma.receptionistKnowledgeBaseEntry.findMany({
        where: {
          language: params.language,
          ...(or.length > 0 ? { OR: or as any } : {}),
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        take,
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          priority: true,
        },
      });

      return rows.map((k) => ({
        id: k.id,
        title: k.title,
        content: k.content,
        category: k.category,
        priority: k.priority,
      }));
    }

    // Cache mode: load a language snapshot once and then do token matching in-memory.
    const cached = ReceptionistPublicService.kbCache.get(params.language);
    let snapshot = cached?.rows ?? null;

    if (!snapshot) {
      const all = await prisma.receptionistKnowledgeBaseEntry.findMany({
        where: { language: params.language },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        take: 5000,
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          priority: true,
          updatedAt: true,
        },
      });

      snapshot = all.map((k) => ({
        id: k.id,
        title: k.title,
        content: k.content,
        category: k.category,
        priority: k.priority,
        updatedAtMs: k.updatedAt instanceof Date ? k.updatedAt.getTime() : 0,
      }));

      ReceptionistPublicService.kbCache.set(params.language, {
        loadedAt: Date.now(),
        rows: snapshot,
      });
    }

    const matches = snapshot.filter((row) => {
      const title = row.title.toLowerCase();
      const content = row.content.toLowerCase();
      const category = row.category.toLowerCase();
      return tokens.some(
        (t) => title.includes(t) || content.includes(t) || category.includes(t),
      );
    });

    matches.sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) ||
        (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0),
    );

    return matches.slice(0, take).map((k) => ({
      id: k.id,
      title: k.title,
      content: k.content,
      category: k.category,
      priority: k.priority,
    }));
  }

  private async findAnnouncementsByQuery(params: {
    query: string;
    language: ReceptionistLanguage;
    take: number;
  }) {
    const q = normalizeText(params.query);
    if (!q) return [];

    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .slice(0, 10);

    const or = tokens.flatMap((t) => [
      { title: { contains: t } },
      { content: { contains: t } },
    ]);

    const now = new Date();

    const rows = await prisma.receptionistAnnouncement.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
        OR: [{ language: null }, { language: params.language }],
        ...(or.length > 0 ? { OR: or as any } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: clampInt(params.take, 0, 20),
      select: {
        id: true,
        title: true,
        content: true,
      },
    });

    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
    }));
  }

  private async findSchedule(params: { query: string; take: number }) {
    const q = normalizeText(params.query);
    if (!q) return [];

    // Very lightweight extraction: try to locate a group code token.
    const groupToken = (q.match(/\b\d{2,4}[A-Za-z]{0,2}\b/) ?? [])[0];

    const group = groupToken
      ? await prisma.group.findFirst({
          where: { name: { contains: groupToken } },
          select: { id: true, name: true },
        })
      : null;

    const rows = await prisma.scheduleEntry.findMany({
      where: group ? { groupId: group.id } : undefined,
      orderBy: [{ weekday: "asc" }, { timeSlot: { slotNumber: "asc" } }],
      take: clampInt(params.take, 0, 50),
      select: {
        weekday: true,
        group: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { fullName: true } },
        room: { select: { name: true } },
        timeSlot: {
          select: { slotNumber: true, startTime: true, endTime: true },
        },
      },
    });

    return rows.map((r) => ({
      weekday: r.weekday,
      group: r.group.name,
      subject: r.subject.name,
      teacher: r.teacher.fullName,
      room: r.room?.name ?? null,
      time: `${String(r.timeSlot.startTime).slice(11, 16)}-${String(r.timeSlot.endTime).slice(11, 16)}`,
    }));
  }

  // Used for API input normalization when needed.
  static normalizeLanguage(raw: unknown, fallback: ReceptionistLanguage) {
    return coerceReceptionistLanguage(raw, fallback);
  }
}
