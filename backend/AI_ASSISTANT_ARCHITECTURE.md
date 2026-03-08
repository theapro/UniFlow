# UniFlow AI Assistant (Tool-Based, RBAC, Prisma)

This backend implements a **tool-based AI gateway**:

- The LLM never queries the database directly.
- The LLM can only access data through **backend tools** in `src/services/ai-tools/`.
- Every tool call is validated against **role-based permissions**.
- Admins can control AI behavior via DB-backed settings, tool toggles, and usage logs.

## Folder Structure

- `src/services/ai-tools/`
  - `toolNames.ts` — tool name registry
  - `access.ts` — RBAC guard helpers
  - `student.tools.ts` — student-scoped tools
  - `group.tools.ts` — group-scoped tools
  - `admin.tools.ts` — admin/system tools
  - `executeTool.ts` — single dispatcher + centralized access validation
- `src/services/ai/`
  - `AiAssistantService.ts` — orchestration (planner → tool → final answer → logs)
  - `OpenAiCompatibleClient.ts` — OpenAI-compatible `chat.completions` client (Groq/OpenAI)
  - `AiSettingsService.ts` — singleton settings (enabled + prompts + default models)
  - `AiToolConfigService.ts` — tool toggles (global + per-role)
  - `AiUsageLogService.ts` — request logging for admins
- `src/controllers/ai/AiAssistantController.ts`
  - `POST /api/ai/assistant/chat`
- `src/controllers/admin/`
  - `AdminAiSettingsController.ts` — `GET/PATCH /api/admin/ai/settings`
  - `AdminAiToolsController.ts` — `GET/PATCH /api/admin/ai/tools`
  - `AdminAiLogsController.ts` — `GET /api/admin/ai/logs`

## Tool List (Implemented)

Student tools:

- `getStudentProfile(studentId)`
- `getStudentGrades(studentId)`
- `getStudentAttendance(studentId)`
- `getStudentGroup(studentId)`
- `getStudentSchedule(studentId)`

Teacher tools:

- `getGroupStudents(groupId)`
- `getGroupGrades(groupId)`
- `getGroupAttendance(groupId)`

Admin tools:

- `getTopStudents(limit)`
- `getFailingStudents()`
- `getSystemStats()`

## RBAC Rules (Enforced)

- Student: can only access their own `studentId`.
- Teacher: can only access groups they teach (via `ScheduleEntry` or `Lesson`), and only students belonging to those groups.
- Admin: full access.

## Prompts

### Tool Planner Prompt (example)

Stored in `AiSettings.toolPlannerPrompt` (default provided by `AiSettingsService`).

Key requirements:

- Output **ONLY JSON**.
- Choose exactly one tool call OR ask 1 clarifying question.
- Never invent IDs.

Example output:

```json
{
  "tool": "getStudentAttendance",
  "args": { "studentId": "<uuid>" },
  "needsClarification": false,
  "clarifyingQuestion": ""
}
```

### System Prompt (example)

Stored in `AiSettings.systemPrompt`.

Minimal production rules:

- Role-aware privacy
- Ask for missing identifiers
- Don’t mention internal tooling

## Admin Controls

- Enable/disable AI: `PATCH /api/admin/ai/settings` with `{ "isEnabled": false }`
- Change prompts: `PATCH /api/admin/ai/settings` with `{ "systemPrompt": "...", "toolPlannerPrompt": "..." }`
- Enable/disable tools: `PATCH /api/admin/ai/tools/:name`
- Monitor logs: `GET /api/admin/ai/logs`

## Notes on Grades

Grades are stored in Prisma as `GradeBook` / `GradeRecord`.

`GradesSheetsSyncService.syncOnce()` now optionally persists HW columns into these tables when constructed with a Prisma client (admin sync already passes Prisma).

Run `prisma migrate dev` + `prisma generate` after applying schema changes.
