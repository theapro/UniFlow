import { create } from "zustand";
import { ChatStore, ChatSession, Message, AllowedAiModel } from "@/types/chat";
import { generateId, generateChatTitle } from "@/lib/utils";
import { auth } from "@/lib/auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://localhost:3001";

function requireToken(): string {
  const token = auth.getStoredToken();
  if (!token) throw new Error("Missing auth token");
  return token;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},
  isLoading: false,
  isStreaming: false,

  models: [],
  selectedModelId: null,

  loadSessions: async () => {
    const token = requireToken();
    const response = await fetch(`${BACKEND_URL}/api/ai/chat/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to load sessions");
    const json = await response.json();
    const sessions: ChatSession[] = Array.isArray(json?.data)
      ? json.data.map((s: any) => ({
          id: String(s.id),
          title: String(s.title ?? "New Chat"),
          createdAt: toDate(s.createdAt),
          updatedAt: toDate(s.updatedAt),
        }))
      : [];

    set((state) => {
      const currentSessionId =
        state.currentSessionId ?? sessions[0]?.id ?? null;
      return { sessions, currentSessionId };
    });
  },

  loadModels: async () => {
    const token = requireToken();
    const response = await fetch(`${BACKEND_URL}/api/ai/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to load models");
    const json = await response.json();

    const models: AllowedAiModel[] = Array.isArray(json?.data)
      ? json.data
          .map((m: any) => ({
            id: String(m.id),
            provider: String(m.provider ?? "groq"),
            model: String(m.model ?? ""),
            displayName: String(m.displayName ?? m.model ?? "Model"),
            modality: (m.modality ?? "CHAT") as AllowedAiModel["modality"],
          }))
          .filter((m: AllowedAiModel) => m.model.length > 0)
      : [];

    set((state) => {
      const selectedStillValid =
        state.selectedModelId &&
        models.some((m) => m.id === state.selectedModelId);
      const selectedModelId = selectedStillValid
        ? state.selectedModelId
        : (models[0]?.id ?? null);
      return { models, selectedModelId };
    });
  },

  setSelectedModel: (modelId: string) => {
    set((state) => {
      if (!state.models.some((m) => m.id === modelId)) return state;
      return { selectedModelId: modelId };
    });
  },

  loadMessages: async (sessionId: string) => {
    const token = requireToken();
    const response = await fetch(
      `${BACKEND_URL}/api/ai/chat/sessions/${encodeURIComponent(sessionId)}/messages?limit=200`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error("Failed to load messages");
    const json = await response.json();
    const messages: Message[] = Array.isArray(json?.data)
      ? json.data
          .map((m: any) => {
            const sender = String(m.sender);
            const role = sender === "USER" ? "user" : "assistant";
            return {
              id: String(m.id),
              role,
              content: String(m.message ?? ""),
              createdAt: toDate(m.timestamp),
            } as Message;
          })
          .filter((m: Message) => m.content.length > 0)
      : [];

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: messages,
      },
    }));
  },

  createSession: async () => {
    // Avoid creating multiple empty drafts
    const state = get();
    const existingDraft = state.sessions.find((s) => {
      if (s.title !== "New Chat") return false;
      const msgs = state.messages[s.id] ?? [];
      return msgs.length === 0;
    });

    if (existingDraft) {
      set({ currentSessionId: existingDraft.id });
      return existingDraft.id;
    }

    const token = requireToken();
    const response = await fetch(`${BACKEND_URL}/api/ai/chat/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "New Chat" }),
    });
    if (!response.ok) throw new Error("Failed to create session");
    const json = await response.json();
    const s = json?.data;
    const newSession: ChatSession = {
      id: String(s.id),
      title: String(s.title ?? "New Chat"),
      createdAt: toDate(s.createdAt),
      updatedAt: toDate(s.updatedAt),
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id,
      messages: { ...state.messages, [newSession.id]: [] },
    }));

    return newSession.id;
  },

  deleteSession: async (sessionId: string) => {
    const token = requireToken();
    const response = await fetch(
      `${BACKEND_URL}/api/ai/chat/sessions/${encodeURIComponent(sessionId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error("Failed to delete session");

    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== sessionId);
      const newMessages = { ...state.messages };
      delete newMessages[sessionId];

      let newCurrentSessionId = state.currentSessionId;
      if (state.currentSessionId === sessionId) {
        newCurrentSessionId = newSessions[0]?.id || null;
      }

      return {
        sessions: newSessions,
        messages: newMessages,
        currentSessionId: newCurrentSessionId,
      };
    });
  },

  renameSession: async (sessionId: string, newTitle: string) => {
    const token = requireToken();
    const response = await fetch(
      `${BACKEND_URL}/api/ai/chat/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newTitle }),
      },
    );
    if (!response.ok) throw new Error("Failed to rename session");

    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, title: newTitle, updatedAt: new Date() }
          : session,
      ),
    }));
  },

  setCurrentSession: (sessionId: string) => {
    set({ currentSessionId: sessionId });
  },

  addMessage: (sessionId: string, message: Message) => {
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      const newMessages = {
        ...state.messages,
        [sessionId]: [...sessionMessages, message],
      };

      // Auto-generate title from first user message (UI only)
      const session = state.sessions.find((s) => s.id === sessionId);
      let updatedSessions = state.sessions;

      if (
        session &&
        session.title === "New Chat" &&
        message.role === "user" &&
        sessionMessages.length === 0
      ) {
        const newTitle = generateChatTitle(message.content);
        updatedSessions = state.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, title: newTitle, updatedAt: new Date() }
            : s,
        );
      }

      return {
        messages: newMessages,
        sessions: updatedSessions,
      };
    });
  },

  updateLastMessage: (sessionId: string, content: string) => {
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      if (sessionMessages.length === 0) return state;

      const lastMessage = sessionMessages[sessionMessages.length - 1];
      const updatedMessage = { ...lastMessage, content };

      return {
        messages: {
          ...state.messages,
          [sessionId]: [...sessionMessages.slice(0, -1), updatedMessage],
        },
      };
    });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setStreaming: (isStreaming: boolean) => {
    set({ isStreaming });
  },

  clearMessages: (sessionId: string) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [],
      },
    }));
  },

  regenerateMessage: (sessionId: string) => {
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      if (sessionMessages.length < 2) return state;

      // Remove last assistant message
      return {
        messages: {
          ...state.messages,
          [sessionId]: sessionMessages.slice(0, -1),
        },
      };
    });
  },
}));
