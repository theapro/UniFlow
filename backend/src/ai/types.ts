import type { UserRole } from "@prisma/client";

export type AiChatRequest = {
  message: string;
  sessionId?: string;
  requestedModel?: string;
  temperature?: number;
  contextLimit?: number;
};

export type AiLanguage = "uz" | "en" | "ru";

export type AiUserIdentity = {
  userId: string;
  role: UserRole;
  email: string;
  fullName: string | null;
  studentId: string | null;
  teacherId: string | null;
};

export type AiBuiltContext = {
  identity: AiUserIdentity;
  student?: {
    id: string;
    fullName: string;
    studentNumber: string | null;
    group: { id: string; name: string } | null;
  } | null;
  teacher?: {
    id: string;
    fullName: string;
    staffNo: string | null;
    department: { id: string; name: string } | null;
  } | null;
  today?:
    | {
        kind: "student_schedule";
        scheduleToday: Array<{
          subject: string | null;
          teacher: string | null;
          room: string | null;
          startTime: string | null;
          endTime: string | null;
        }>;
      }
    | {
        kind: "teacher_lessons";
        lessonsToday: Array<{
          subject: string | null;
          group: string | null;
          startsAt: string | null;
          endsAt: string | null;
        }>;
      }
    | null;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type AiToolDecision = {
  type: "tool" | "llm";
  tool: string | null;
  args: Record<string, unknown> | null;
  confidence: number;
  reason?: string | null;
  response: string | null;
};
