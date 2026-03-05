export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatStore = {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  isStreaming: boolean;

  // Actions
  loadSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  createSession: () => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastMessage: (sessionId: string, content: string) => void;
  setLoading: (isLoading: boolean) => void;
  setStreaming: (isStreaming: boolean) => void;
  clearMessages: (sessionId: string) => void;
  regenerateMessage: (sessionId: string) => void;
};

export type GroqChatRequest = {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream: boolean;
};

export type GroqChatResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
};

export type GroqStreamChunk = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
};
