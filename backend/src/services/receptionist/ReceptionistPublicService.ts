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
} from "./receptionistText";

export type ReceptionistInitResponse = {
  conversationId: string;
  avatar: {
    name: string;
    modelUrl: string | null;
    voice: string | null;
    language: ReceptionistLanguage;
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

  async getAvatar() {
    return this.getOrCreateAvatar();
  }

  async init(params: {
    conversationId?: string | null;
    language?: ReceptionistLanguage | null;
    messageLimit?: number;
  }): Promise<ReceptionistInitResponse> {
    const limit = clampInt(params.messageLimit ?? 80, 0, 400);

    const language: ReceptionistLanguage =
      params.language ??
      (params.conversationId
        ? await this.getConversationLanguage(params.conversationId)
        : null) ??
      "UZ";

    const conversationId = await this.ensureConversation({
      conversationId: params.conversationId,
      language,
    });

    const avatar = await this.getOrCreateAvatar();

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
        language: avatar.language,
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

    const detected = detectReceptionistLanguage(cleaned);
    const language = params.language ?? detected;

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

    const avatar = await this.getOrCreateAvatar();

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

    await prisma.receptionistMessage.create({
      data: {
        conversationId,
        sender: "ASSISTANT",
        modality: params.assistantModality ?? "TEXT",
        text: replyText.slice(0, 9000),
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
      replyText,
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
        personality: "FRIENDLY",
      },
      select: {
        id: true,
        key: true,
        name: true,
        modelUrl: true,
        voice: true,
        language: true,
        personality: true,
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
    };
  }): Promise<string> {
    const lang = params.language;

    // Always attempt structured lookup first.
    const [locations, kb, schedule, announcements] = await Promise.all([
      this.findLocations({ query: params.message, take: 5 }),
      this.findKnowledgeBase({
        query: params.message,
        language: lang,
        take: 5,
      }),
      this.findSchedule({ query: params.message, take: 12 }),
      this.findAnnouncementsByQuery({
        query: params.message,
        language: lang,
        take: 5,
      }),
    ]);

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

    const context = {
      locations,
      knowledgeBase: kb,
      schedule,
      announcements,
    };

    try {
      const messages: any[] = [
        {
          role: "system",
          content:
            persona +
            "\nYou are a real university receptionist. Be concise, helpful, and ask a clarifying question if needed. " +
            "Use ONLY the provided CONTEXT data as facts. If data is missing, say you are not sure and suggest contacting staff.",
        },
        {
          role: "user",
          content: `USER_QUESTION:\n${params.message}\n\nCONTEXT_JSON:\n${JSON.stringify(context)}`,
        },
      ];

      const res = await this.llm.chat({
        messages,
        temperature: 0.4,
        maxTokens: 900,
      });

      const content = normalizeText(res.content);
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
      { category: { contains: t } },
    ]);

    const rows = await prisma.receptionistKnowledgeBaseEntry.findMany({
      where: {
        language: params.language,
        ...(or.length > 0 ? { OR: or as any } : {}),
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: clampInt(params.take, 0, 20),
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
