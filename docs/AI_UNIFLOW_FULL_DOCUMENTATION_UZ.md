# UniFlow loyihasida AI qanday ishlaydi (to‘liq hujjat)

Ushbu hujjat UniFlow ichida “AI” deb ataladigan funksiyalarni **backend (Express/TS + Prisma)**, **admin (Next.js)** va **user (Next.js)** qatlamlari bo‘yicha izohlaydi.

> Muhim: Bu loyihada “AI” 1 ta narsa emas. 2 ta asosiy yo‘l bor:
>
> 1. **Unified AI assistant (tool-first, SSE)** — `POST /api/ai/chat`
> 2. **Schedule “AI generator”** esa LLM emas: **Python OR-Tools constraint solver**.
>
> Eslatma: `/api/ai/llm/chat` va `/api/ai/assistant/chat` legacy endpointlar olib tashlangan (hammasi `POST /api/ai/chat` ga birlashtirilgan).

---

## 1) AI Logic (backend oqimi)

### 1.1. Asosiy AI route’lar

AI uchun route’lar: `backend/src/routes/ai.routes.ts`

- `GET /api/ai/models` — user role bo‘yicha ruxsat etilgan chat modellar ro‘yxati
- `GET /api/ai/greeting` — chat bo‘sh holati uchun qisqa greeting (Uzbek)
- `GET /api/ai/context` — tizim bo‘yicha qisqa summary/context
- `POST /api/ai/students/verify` — (studentId + group) mosligini tekshiradi
- `GET /api/ai/search` — admin-only qidiruv (student/group)
- `POST /api/ai/chat` — unified AI assistant (tool-first, SSE streaming)
- Chat DB:
  - `GET /api/ai/chat/sessions`
  - `POST /api/ai/chat/sessions`
  - `PATCH /api/ai/chat/sessions/:sessionId`
  - `DELETE /api/ai/chat/sessions/:sessionId`
  - `GET /api/ai/chat/sessions/:sessionId/messages`
- (Removed) `POST /api/ai/llm/chat` — legacy
- (Removed) `POST /api/ai/assistant/chat` — legacy

> Eslatma: `backend/src/routes/ai.routes.ts` da barcha AI endpointlar `authMiddleware` bilan himoyalangan.

### 1.2. Oddiy intent-based `POST /api/ai/chat`

Manba: `backend/src/controllers/ai/AiController.ts`

Bu endpoint LLM ishlatmaydi, matndan “intent” topib, to‘g‘ridan-to‘g‘ri servislarni chaqiradi:

- `GET_TODAY_SCHEDULE`
  - Student bo‘lsa → `StudentService.getTodaySchedule(studentId)`
  - Teacher bo‘lsa → `TeacherService.getTodayLessons(teacherId)`
- `GET_TODAY_LESSONS` — faqat teacher
- `GET_ATTENDANCE` — faqat student

Agar intent topilmasa, qisqa yordamchi javob qaytaradi.

### 1.3. Greeting `GET /api/ai/greeting`

Manba: `backend/src/controllers/ai/AiController.ts`

- User context yig‘iladi: role, fullName, email, student/teacher qisqa profili, `UserProfile.interests/preferences`
- Model: `AiModelService.resolveChatModel({ role })`
- LLM: `GroqChatService.streamChat()` orqali stream qilinadi
- Max token juda kichik (80), 1 jumla (max 12 so‘z) talab qilinadi
- Himoya: `createThinkTagStripper()` bilan `<think>...</think>` bo‘lsa ham olib tashlanadi

### 1.4. Legacy LLM chat (removed)

Manba: `backend/src/controllers/ai/AiController.ts`

Bu endpoint 2 xil yo‘l bilan ishlaydi:

#### A) “Relational/university-data” savol bo‘lsa → tool-based assistantga routing

- `shouldUseToolAssistant(message)` regex orqali savol “teacher/attendance/grades/schedule/group/subject” kabi bo‘lsa `true` qaytaradi
- Shunda:
  - ChatSession bo‘lmasa yaratadi (title=`New Chat`)
  - User message DBga yoziladi (`ChatSender.USER`)
  - Javob SSE sifatida qaytariladi (ammo bu javob aslida tool-based assistantdan keladi)
  - Yakunda assistant message DBga yoziladi (`ChatSender.ASSISTANT`)
  - `UserProfileService.inferFromMessage()` chaqiriladi

Bu yo‘lning maqsadi: **hallucination kamaytirish** va javobni DB’dagi real ma’lumotga “ground” qilish.

#### B) Oddiy LLM chat (Groq stream)

- Model tanlash: `AiModelService.resolveChatModel({ role, requestedModel })`
- ChatSession topiladi/yoki yaratiladi
- Context injeksiya qilinadi:
  - `AUTHENTICATED USER` meta (id/email/role/fullName/studentId/teacherId...)
  - `STUDENT CONTEXT (verified)` — agar request’da `studentId+group` bo‘lsa verify qilinadi; bo‘lmasa user.studentId orqali olinadi
  - `USER PROFILE CONTEXT` — `UserProfile`
  - `TODAY CONTEXT` — student uchun bugungi schedule yoki teacher uchun bugungi lessons (compact)
  - `RECENT CHAT HISTORY` — oxirgi N message (`contextLimit`, default env’dan)
- System prompt ichida qoidalar bor:
  - Default language Uzbek
  - “ALWAYS output a reasoning section wrapped in `<think>...</think>`...” degan talab bor
  - “Do NOT output an 'Izoh:' line ...” degan talab ham bor
- Stream: `GroqChatService.streamChat()` SSE orqali delta’larni uzatadi
- Yakunda assistant to‘liq kontent DBga saqlanadi

### 1.5. Streaming texnikasi (Groq)

Manba: `backend/src/services/ai/GroqChatService.ts`

- OpenAI-compatible endpoint: `POST https://api.groq.com/openai/v1/chat/completions` (yoki env `GROQ_API_URL`)
- `stream: true` bilan kelgan `data: {...}` SSE satrlarini parser qiladi
- `choices[0].delta.content` kelgan delta’lar callback orqali UI ga uzatiladi

---

## 2) AI Tools (tool-based assistant)

### 2.1. Tool-based assistant nima?

Manba: `backend/src/services/ai/AiAssistantService.ts`

Oqim:

1. Admin settings tekshiruvi: `AiSettings.isEnabled`
2. Model tanlash: `AiModel` ro‘yxatidan role bo‘yicha allowed (admin/user default model id ham bor)
3. **Planner LLM**: “qaysi tool ishlatish kerak?” degan prompt, natija **faqat JSON** bo‘lishi shart
4. JSON parse bo‘lmasa fallback: `pickFallbackTool()`
5. RBAC + tool enable/disable: `AiToolConfigService.listAllowed(role)`
6. Tool execution: `executeAiTool()`
7. Final LLM: toolResult JSON asosida userga natural javob (tool/internal JSON haqida gapirmaslik qoidalari bilan)
8. Audit: `AiUsageLogService` STARTED/OK/ERROR log

### 2.2. Tool ro‘yxati

Manba: `backend/src/services/ai-tools/toolNames.ts`

Student-scoped:

- `getStudentProfile`
- `getStudentFullContext`
- `getStudentGroupSubjects`
- `getStudentGrades`
- `getStudentAttendance`
- `getStudentGroup`
- `getStudentSchedule`
- `getStudentMonthlySchedule`

Group-scoped:

- `getGroupStudents`
- `getGroupGrades`
- `getGroupAttendance`

Admin/system:

- `getTopStudents`
- `getFailingStudents`
- `getSystemStats`

### 2.3. RBAC (ruxsat nazorati) qayerda?

- Guard helpers: `backend/src/services/ai-tools/access.ts`
- Central dispatcher: `backend/src/services/ai-tools/executeTool.ts`

Asosiy qoidalar:

- **Student**: faqat o‘z `studentId` ma’lumotini oladi (`assertStudentSelf`)
- **Teacher**: faqat o‘zi dars beradigan guruhlar/ulardagi studentlar (`assertTeacherGroupAccess`, `assertTeacherStudentAccess`)
  - tekshiruv `ScheduleEntry` yoki `Lesson` orqali qilinadi
- **Admin**: system tool’lar uchun to‘liq ruxsat (`assertRole([ADMIN])`)

### 2.4. Tool konfiguratsiya (enable/disable)

Manba: `backend/src/services/ai/AiToolConfigService.ts`

- DB modeli: `AiToolConfig`
- `ensureDefaults()` har bir tool uchun default row yaratadi
  - students: `getStudent*`
  - teachers: `getStudent*` + `getGroup*`
  - admins: hammasi

### 2.5. Tool’larning DB query implementatsiyasi

- Dispatcher → `student.tools.ts`, `group.tools.ts`, `admin.tools.ts`
- “Full context” query: `backend/src/services/ai/StudentFullContextService.ts`
  - izoh: ataylab “single include-heavy Prisma query” qilib, N+1 va tool-time overheadni kamaytiradi

---

## 3) AI Schedule generator (Monthly schedule) — Python OR-Tools

Bu qism **LLM emas**. Bu “AI” nomi bilan UI’da ko‘rsatilgan bo‘lsa-da, aslida constraint solver.

### 3.1. Admin endpointlar

Manba: `backend/src/routes/admin.routes.ts`, `backend/src/controllers/admin/AdminAiScheduleController.ts`

- `POST /api/admin/ai-schedule/generate`
  - Input: `month, year, requirements[] (yoki legacy rules[])`, `holidays[]`, `workingDays[]`, `teacherUnavailable[]`, `maxSeconds`
  - Output: `generatedLessons[]` va nechta record yaratildi

- `POST /api/admin/ai-schedule/one-tap-generate`
  - Input: `month, year, cohortId?`, `holidays[]`, `workingDays[]`, `maxSeconds`
  - Requirements’ni o‘zi taxmin qiladi (GradeBook asosida)

### 3.2. Generator service: qanday payload yasaladi?

Manba: `backend/src/services/scheduling/AIScheduleGeneratorService.ts`

1. Oyni kunlarga bo‘ladi (UTC) → `days = [{date:"YYYY-MM-DD"}, ...]`
2. TimeSlot’larni DB’dan oladi (`isBreak=false`) → `timeSlots = [{id, slotNumber}, ...]`
3. Existing schedule’larni DB’dan oladi va “blocked” timeIndex’lar quradi:
   - `blocked.teacher[teacherId] = [timeIndex...]`
   - `blocked.group[groupId] = [timeIndex...]`
   - `blocked.room[roomId] = [timeIndex...]`
   - timeIndex = `dayIndex * slotsPerDay + slotIndex`
4. `teacherUnavailable[]` ham teacher blocked’ga qo‘shiladi
5. `requirements[]` → ko‘paytirib `lessons[]` (har bir lesson instance `ruleIndex` bilan)
6. Python solverga stdin orqali JSON yuboriladi

Python ishga tushirish:

- exe: `UNIFLOW_PYTHON` yoki `PYTHON` env, bo‘lmasa Windows’da `python`
- script: `src/services/scheduling/solver/solve_monthly_schedule.py`

### 3.3. Python solver: constraintlar va objective

Manba: `backend/src/services/scheduling/solver/solve_monthly_schedule.py`

Hard constraints:

- Har bir lesson **exactly once** joylashtiriladi
- Bitta timeslot’da:
  - teacher conflict yo‘q
  - group conflict yo‘q
  - room conflict (room bo‘lsa) yo‘q
- Existing schedule/unavailability bo‘yicha blocked joylar umuman ruxsat etilmaydi

Soft constraints (minimize objective):

- Bir kunda bir guruhda bir subject ketma-ket slotlarda ko‘p chiqmasin (adjacency penalty, weight=10)
- Bir xil `ruleIndex` (ya’ni bitta requirement) bir kunda 1 tadan ko‘p bo‘lsa penalti (weight=3)
- Teacher’ning kunlik yuklamasi (max daily load) kichik bo‘lsin (weight=1)

Output:

- `{ ok: true, generatedLessons: [{date, timeSlotId, groupId, teacherId, subjectId, roomId?, note?}, ...] }`

### 3.4. DBga saqlash (all-or-nothing)

`AdminAiScheduleController.generate/oneTapGenerate` yakunda `AdminMonthlyScheduleService.bulkCreate(..., {mode:"all_or_nothing"})` ishlatadi.

Ma’no: agar conflict bo‘lsa, “yarim yozish” qilmaydi.

---

## 4) AI chat (UI integratsiya)

### 4.1. User app: Edge proxy API

Manba:

- `user/src/app/api/chat/route.ts` — user chat SSE proxy → backend `POST /api/ai/chat`
- `user/src/app/api/greeting/route.ts` — greeting proxy → backend `GET /api/ai/greeting`

Auth:

- Token cookie’dan olinadi (`token`) va backend’ga `Authorization: Bearer <token>` bilan uzatiladi.

### 4.2. SSE stream parser (frontend)

Manba: `user/src/components/chat/ChatLayout.tsx`

Frontend quyidagi formatni kutadi:

- `data: {"content":"...","sessionId":"..."}`
- `data: [DONE]`

### 4.3. “Reasoning”/`<think>`

Manba: `user/src/components/chat/AssistantMessageBubble.tsx`

`<think>` va “Reasoning” UI legacy edi va olib tashlangan. Hozir assistant javobi to‘g‘ridan-to‘g‘ri ko‘rsatiladi.

---

## 5) AI chat DB info (Prisma modellar)

Manba: `backend/prisma/schema.prisma`

### 5.1. ChatSession / Chat

- `ChatSession`:
  - `id`, `userId`, `title`, `createdAt`, `updatedAt`
  - `@@index([userId, updatedAt])`
- `Chat`:
  - `id`, `userId`, `sessionId`, `message`, `sender`, `timestamp`
  - `@@index([userId, timestamp])`, `@@index([sessionId, timestamp])`

Backend servis: `backend/src/services/chat/ChatService.ts`

- Session CRUD
- Message list (limit bilan)
- Message add → session `updatedAt` bump qiladi

### 5.2. UserProfile

- `UserProfile` userga bog‘langan (`userId unique`)
- `interests`, `preferences` JSON bo‘lishi mumkin
- Chatdan keyin `UserProfileService.inferFromMessage()` minimal inference qiladi

### 5.3. AI governance modellari (admin boshqaruvi)

- `AiModel` — provider/model/displayName/modality, enabled flags
- `AiSettings` — singleton: `isEnabled`, `systemPrompt`, `toolPlannerPrompt`, default model id’lar
- `AiToolConfig` — tool enable/disable (global + per-role)
- `AiUsageLog` — audit log
  - `status: STARTED/OK/ERROR`
  - `toolName`, `toolArgs`, `ms`, `meta` kabi field’lar

Admin endpointlar (hammasi admin-only):

- `GET /api/admin/ai/models`
- `PATCH /api/admin/ai/models/:id`
- `GET /api/admin/ai/settings`
- `PATCH /api/admin/ai/settings`
- `GET /api/admin/ai/tools`
- `PATCH /api/admin/ai/tools/:name`
- `GET /api/admin/ai/logs`
- `POST /api/admin/ai/test-chat`, `POST /api/admin/ai/test-tool`

---

## 6) Confusing joylar, xatoliklar va improvement takliflari

### 6.1. `<think>` talabi inconsistent

- `llmChat` system prompt: “ALWAYS output `<think>...</think>`” deydi
- Greeting prompt esa “Do not output `<think>`” deydi va server-side stripper bilan olib tashlaydi
- Tool-based assistant final prompt esa `<think>` haqida gapirmaydi

Taklif:

- 1 ta standartga kelish: `<think>` umuman kerak bo‘lmasa, direct chat prompt’dan ham olib tashlash.
- Agar kerak bo‘lsa, barcha javoblar bir xil formatda bo‘lsin va DB’ga saqlashda ham “final answer only” saqlash variantini ko‘rib chiqish.

### 6.2. Tool-based routing heuristikasi “ko‘r” qolishi mumkin

`shouldUseToolAssistant()` faqat regex asosida.

Taklif:

- Regex ro‘yxatini test bilan mustahkamlash (ko‘proq Uzbek/RU sinonimlar)
- Yoki default’ni tool-based’ga yaqinlashtirish (ayniqsa student/teacher data savollarida)

### 6.3. Model policy va provider aralashmasi

- Direct `AiModelService.resolveChatModel()` requestedModel bo‘lsa faqat `provider:"groq"` ni tekshiradi
- Tool-based assistant esa `AiModel.provider` bo‘yicha `openai|groq` tanlay oladi

Taklif:

- Direct chat uchun ham provider-aware tanlash qo‘shish (agar kerak bo‘lsa)
- Aks holda hujjatda aniq yozish: “Direct chat faqat Groq; openai faqat assistant/arrange”

### 6.4. StudentFullContextService og‘ir query bo‘lishi mumkin

`StudentFullContextService` attendance va gradeRecords’ni to‘liq include qiladi.

Taklif:

- Attendance’ni “recent N” bilan cheklash
- GradeRecords’ni kerakli range (oxirgi X) bilan cheklash

### 6.5. Schedule solver operatsion muammolari (Windows)

- Python + `ortools` dependency kerak
- `UNIFLOW_PYTHON` env bilan virtualenv/conda python’ni ko‘rsatish tavsiya

Taklif:

- Backend startup’da solver health-check (python mavjudmi, `ortools` bor-mi)
- Script path mavjudligini oldindan tekshirish

---

## 7) “Source of truth” (tez topish uchun)

Backend:

- `backend/src/routes/ai.routes.ts`
- `backend/src/controllers/ai/AiController.ts`
- `backend/src/controllers/ai/AiAssistantController.ts`
- `backend/src/services/ai/GroqChatService.ts`
- `backend/src/services/ai/OpenAiCompatibleClient.ts`
- `backend/src/services/ai/AiAssistantService.ts`
- `backend/src/services/ai/AiModelService.ts`
- `backend/src/services/ai/AiSettingsService.ts`
- `backend/src/services/ai/AiToolConfigService.ts`
- `backend/src/services/ai/AiUsageLogService.ts`
- `backend/src/services/ai-tools/toolNames.ts`
- `backend/src/services/ai-tools/access.ts`
- `backend/src/services/ai-tools/executeTool.ts`
- `backend/src/services/ai-tools/student.tools.ts`
- `backend/src/services/ai/StudentFullContextService.ts`
- `backend/src/services/chat/ChatService.ts`

Schedule generator:

- `backend/src/controllers/admin/AdminAiScheduleController.ts`
- `backend/src/services/scheduling/AIScheduleGeneratorService.ts`
- `backend/src/services/scheduling/solver/solve_monthly_schedule.py`

Frontend (user):

- `user/src/app/api/chat/route.ts`
- `user/src/components/chat/ChatLayout.tsx`
- `user/src/components/chat/AssistantMessageBubble.tsx`

DB:

- `backend/prisma/schema.prisma`
