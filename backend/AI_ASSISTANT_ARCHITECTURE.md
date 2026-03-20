# UniFlow Unified AI Assistant (Tool-First, RBAC, Prisma)

This backend implements a **single unified AI assistant** behind one endpoint:

- The LLM never queries the database directly.
- The LLM can only access data through **backend tools**.
- Tools are **tool-first** and **role-gated** (RBAC).
- Admins can control tool enablement via DB-backed tool toggles and usage logs.

## API

- `POST /api/ai/chat` — unified chat endpoint (SSE streaming)

Legacy endpoints like `/api/ai/llm/chat` and `/api/ai/assistant/chat` are removed.

## Folder Structure

- `src/ai/`
  - `core/`
    - `AiOrchestrator.ts` — single entry orchestration (session → context → classify → tool/answer → persist → SSE)
    - `AiClassifier.ts` — 1-call LLM classifier/router (JSON-only decision)
    - `AiResponder.ts` — deterministic formatting for tool results (no extra LLM call)
  - `context/`
    - `buildContext.ts` — minimal, role-aware context injection (today + recent history)
  - `services/`
    - `LlmService.ts` — OpenAI-compatible client wrapper (Groq/OpenAI)
  - `tools/`
    - `toolRegistry.ts` — tool metadata + dispatcher
    - `executeTool.ts` — centralized RBAC + tool-config gating + usage logging
    - `studentTools.ts` — merged “smart tools” for students
    - `teacherTools.ts` — merged “smart tools” for teachers
    - `adminTools.ts` — merged “smart tools” for admins
  - `types.ts` — shared AI request/decision/result types

- `src/services/ai/`
  - `AiSettingsService.ts` — global AI enablement + system prompt + default models
  - `AiToolConfigService.ts` — tool toggles (global + per-role)
  - `AiUsageLogService.ts` — request logging for admins
  - `AiModelService.ts` — model resolution/allowlist

## Tool List (Merged Smart Tools)

- Student:
  - `getStudentDashboard`
- Teacher:
  - `getTeacherDashboard`
- Admin:
  - `getSystemStats`

## RBAC Rules (Enforced)

- Student: can only access their own data.
- Teacher: can only access teacher-scoped data.
- Admin: full access.

## Classification Contract

The classifier returns **JSON only** and decides:

- `{ "type": "tool", "tool": "getStudentDashboard", "args": { ... }, "confidence": 0.0-1.0 }`
- or `{ "type": "llm", "response": "...", "confidence": 0.0-1.0 }`

The system is designed to keep requests to **~1 LLM call** per chat turn (classifier embeds the fallback response for `type=llm`).
