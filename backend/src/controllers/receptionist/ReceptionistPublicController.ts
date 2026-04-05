import type { Request, Response } from "express";
import {
  ReceptionistLanguage,
  ReceptionistMessageModality,
} from "@prisma/client";
import { ok, fail } from "../../utils/responses";
import { ReceptionistPublicService } from "../../services/receptionist/ReceptionistPublicService";
import { ReceptionistVoiceService } from "../../services/receptionist/ReceptionistVoiceService";
import {
  normalizeText,
  stripThinkBlocks,
} from "../../services/receptionist/receptionistText";

function coerceModality(raw: unknown, fallback: ReceptionistMessageModality) {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "VOICE") return "VOICE";
  if (v === "TEXT") return "TEXT";
  return fallback;
}

export class ReceptionistPublicController {
  constructor(
    private readonly receptionist: ReceptionistPublicService,
    private readonly voice: ReceptionistVoiceService,
  ) {}

  init = async (req: Request, res: Response) => {
    try {
      const conversationId =
        typeof req.query.conversationId === "string"
          ? req.query.conversationId
          : undefined;

      const languageRaw =
        typeof req.query.language === "string" ? req.query.language : undefined;

      const language: ReceptionistLanguage =
        ReceptionistPublicService.normalizeLanguage(languageRaw, "UZ");

      const messageLimit =
        typeof req.query.limit === "string"
          ? Number(req.query.limit)
          : undefined;

      const data = await this.receptionist.init({
        conversationId,
        language,
        messageLimit,
      });

      return ok(res, "Receptionist initialized", data);
    } catch (err: any) {
      return fail(
        res,
        500,
        err?.message || "Failed to initialize receptionist",
      );
    }
  };

  chat = async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const message = normalizeText(body.message);
      if (!message) return fail(res, 400, "message is required");

      const conversationId =
        typeof body.conversationId === "string" ? body.conversationId : "";

      const language: ReceptionistLanguage | null =
        body.language !== undefined
          ? ReceptionistPublicService.normalizeLanguage(body.language, "UZ")
          : null;

      const modality = coerceModality(body.modality, "TEXT");

      const data = await this.receptionist.chat({
        conversationId,
        message,
        language,
        modality,
      });

      return ok(res, "Receptionist reply", data);
    } catch (err: any) {
      return fail(res, 500, err?.message || "Failed to chat");
    }
  };

  voiceChat = async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return fail(res, 400, "audio file is required");

      const mimeType =
        typeof file.mimetype === "string" && file.mimetype.trim()
          ? file.mimetype
          : "audio/webm";

      const conversationId =
        typeof req.body?.conversationId === "string"
          ? req.body.conversationId
          : "";

      const avatar = await this.receptionist.getAvatar();

      const language: ReceptionistLanguage | null =
        req.body?.language !== undefined
          ? ReceptionistPublicService.normalizeLanguage(req.body.language, "UZ")
          : null;

      const stt = await this.voice.stt({
        audioBytes: file.buffer,
        filename: file.originalname || "audio.webm",
        mimeType,
        language: avatar.inputLanguage,
      });

      const transcript = normalizeText(stt.text);
      if (!transcript) {
        return fail(res, 400, "Could not detect speech (empty transcript)");
      }

      const chat = await this.receptionist.chat({
        conversationId,
        message: transcript,
        language,
        modality: "VOICE",
        assistantModality: "VOICE",
      });

      const replyText = stripThinkBlocks(chat.replyText) || chat.replyText;

      let audioBase64 = "";
      let mime = "audio/mpeg";
      try {
        const tts = await this.voice.tts({
          text: replyText,
          model: avatar.voice ?? undefined,
          format: "wav",
        });
        audioBase64 = tts.audioBase64;
        mime = tts.mime || mime;
      } catch (e: any) {
        // Text-only fallback is allowed when TTS is unavailable.
        console.warn(
          "[receptionist] TTS failed; returning text-only reply:",
          String(e?.message ?? e),
        );
      }

      return ok(res, "Receptionist voice reply", {
        conversationId: chat.conversationId,
        transcript,
        intent: chat.intent,
        replyText,
        audioBase64,
        mime,
      });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.startsWith("STT_FAILED")) {
        return fail(res, 502, "Speech-to-text failed");
      }
      if (msg.startsWith("TTS_FAILED")) {
        return fail(res, 502, "Text-to-speech failed");
      }
      return fail(res, 500, "Failed to process voice");
    }
  };
}
