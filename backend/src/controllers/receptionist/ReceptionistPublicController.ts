import type { Request, Response } from "express";
import {
  ReceptionistLanguage,
  ReceptionistMessageModality,
} from "@prisma/client";
import { ok, fail } from "../../utils/responses";
import { ReceptionistPublicService } from "../../services/receptionist/ReceptionistPublicService";
import { ReceptionistVoiceService } from "../../services/receptionist/ReceptionistVoiceService";
import {
  detectReceptionistLanguage,
  normalizeText,
  stripThinkBlocks,
} from "../../services/receptionist/receptionistText";

function enforceSupportedLanguageOrFail(
  res: Response,
  detected: ReceptionistLanguage,
) {
  if (detected === "UZ" || detected === "EN" || detected === "JP")
    return detected;
  fail(res, 400, "Please use Uzbek, English, or Japanese only");
  return null;
}

function looksLikeClearSpeech(transcript: string): boolean {
  const s = normalizeText(transcript);
  if (!s) return false;
  // Require at least one letter/number from common scripts.
  return /[0-9A-Za-z\u3040-\u30FF\u4E00-\u9FFF\u0400-\u04FF\u0500-\u052F\u00D8\u00F8\u011E\u011F\u0130\u0131\u015E\u015F\u0490\u0491\u0492\u0493]/.test(
    s,
  );
}

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

      // Policy: English-only responses; Japanese responses only when Japanese is detected.
      // All other languages are rejected.
      const detected = detectReceptionistLanguage(message);
      const language = enforceSupportedLanguageOrFail(res, detected);
      if (!language) return;

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

      const sttModel =
        typeof req.body?.sttModel === "string" ? req.body.sttModel : undefined;
      const sttLanguage =
        typeof req.body?.sttLanguage === "string"
          ? req.body.sttLanguage
          : avatar.inputLanguage || avatar.outputLanguage;

      const stt = await this.voice.stt({
        audioBytes: file.buffer,
        filename: file.originalname || "audio.webm",
        mimeType,
        model: sttModel,
        // Hint STT with the configured input language (improves accuracy).
        language: sttLanguage,
      });

      const transcript = normalizeText(stt.text);
      if (!transcript || !looksLikeClearSpeech(transcript)) {
        // Client treats this as a soft, ignorable turn.
        return fail(res, 400, "No speech detected");
      }

      const detected = detectReceptionistLanguage(transcript);
      const language = enforceSupportedLanguageOrFail(res, detected);
      if (!language) return;

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
          voice: avatar.voice ?? undefined,
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
