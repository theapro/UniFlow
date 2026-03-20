# UniFlow AI: Database’dan ma’lumot olish (to‘liq izoh)

Bu hujjat UniFlow backend’ida AI (assistant) foydalanuvchiga javob berishda database’dan (MySQL + Prisma) qanday ma’lumot olishini, qaysi joylarda query ishlashini va debug trace’lar qayerga yozilishini tushuntiradi.

> Muhim: LLM (model) database’ga bevosita ulanmaydi. DB bilan faqat backend kod (Prisma orqali) ishlaydi. LLM faqat backend bergan `context` va/yoki `tool` natijalari asosida javob generatsiya qiladi.

## 1) Asosiy oqim (request → javob)

AI chat endpoint:

- [src/routes/ai.routes.ts](src/routes/ai.routes.ts) ichida `POST /chat`
- `app.use("/api", ...)` bo‘lgani uchun real URL: `POST /api/ai/chat`

Oqim ketma-ketligi:

1. **Auth**: `authMiddleware` JWT token’dan user’ni aniqlaydi.
2. **Chat session**: `AiOrchestrator` chat session yaratadi yoki mavjudini topadi, user xabarini DB’ga yozadi.
3. **Context build**: `buildContext()` user identifikatsiyasi, student/teacher profili va so‘nggi chat xabarlarini DB’dan olib “safe context” qiladi.
4. **Router (AiClassifier)**: LLM (router) `context` + ruxsat berilgan tools ro‘yxatiga qarab qaror qiladi:
   - `type="tool"` → biror tool’ni ishga tushirish
   - `type="llm"` → tool’siz, mavjud context asosida javob berish
5. **Tool execution (ixtiyoriy)**: `executeTool()` DB/service layer’dan kerakli ma’lumotni oladi.
6. **Response format**: `AiResponder` tool natijasini foydalanuvchiga o‘qiladigan formatga keltiradi.
7. **SSE stream**: javob `text/event-stream` orqali chunk’lab client’ga yuboriladi.
8. **Logging + Debug trace**: `AiUsageLog` jadvaliga (Prisma orqali) yoziladi.

Asosiy orchestrator:

- [src/ai/core/AiOrchestrator.ts](src/ai/core/AiOrchestrator.ts)

## 2) DB qayerda o‘qiladi?

AI tarafdan DB o‘qilishi 2 ta asosiy joyda bo‘ladi:

### A) Context build (tool’siz ham DB o‘qiladi)

`buildContext()` har bir AI chat so‘rovida ishlaydi va quyidagilarni DB’dan oladi:

- Student profili: `prisma.student.findUnique(...)`
- Teacher profili: `prisma.teacher.findUnique(...)`
- Shu session bo‘yicha so‘nggi chat xabarlari: `prisma.chat.findMany(...)`
- Bugungi jadval (student) yoki bugungi darslar (teacher): `StudentService.getTodaySchedule()` / `TeacherService.getTodayLessons()`

Fayl:

- [src/ai/context/buildContext.ts](src/ai/context/buildContext.ts)

Natija sifatida LLM’ga “kontekst” beriladi:

- `identity` (userId, role, email, studentId/teacherId)
- `student` yoki `teacher` minimal profili
- `today` (bugungi jadval/darslar) — qisqa preview
- `recentMessages` (so‘nggi chat tarixi)

Shu sababli “Men haqimdagi ma’lumot” degan savolda LLM ko‘pincha **tool ishlatmasdan** ham to‘g‘ri javob bera oladi (chunki profil context’da bor).

### B) Tools orqali DB o‘qish (aniq funksional query’lar)

Tool’lar — bu LLM tanlay oladigan “server-side funksiyalar”. Har bir tool ichida service/Prisma query’lar bo‘lishi mumkin.

Student tool’lari misol:

- `getStudentProfile`
- `getStudentScheduleToday`
- `getStudentAttendanceRecent`
- `getStudentGradesRecent`

Kodlar:

- [src/ai/tools/studentTools.ts](src/ai/tools/studentTools.ts)
- [src/ai/tools/toolRegistry.ts](src/ai/tools/toolRegistry.ts)
- [src/ai/tools/executeTool.ts](src/ai/tools/executeTool.ts)

Tool ishlatilganda:

- `AiClassifier` tool + args tanlaydi
- `executeTool` RBAC va allowed tools tekshiradi
- tool implementatsiyasi kerakli DB ma’lumotni olib qaytaradi

## 3) RBAC: AI qaysi tool’ni ishlata oladi?

Bu ikki bosqichli:

1. **Code-level ruxsat**: har bir tool definitsiyasida `allowedRoles` bor.
2. **DB-level ruxsat (config)**: `AiToolConfigService` DB’dan shu role uchun yoqilgan tool’larni o‘qiydi.

Shu joylarda tekshiriladi:

- `toolRegistry` → `allowedRoles`
- `AiToolConfigService.listAllowed(role)` → DB config

Natijada LLM tool tanlagan bo‘lsa ham, agar config’da o‘chirilgan bo‘lsa tool ishlamaydi va assistant “ruxsat yo‘q” degan javob qaytaradi.

## 4) Prisma query’lar va debug trace qanday yoziladi?

### AiUsageLog (admin debug console uchun)

Har bir chat so‘rovi uchun backend quyidagilarni DB’ga yozadi:

- start: `AiUsageLogService.logStart()`
- finish: `AiUsageLogService.logFinish()`

Fayl:

- [src/services/ai/AiUsageLogService.ts](src/services/ai/AiUsageLogService.ts)

`logFinish` ichida `meta.debugTrace` ham yozilishi mumkin.

### Debug trace (AsyncLocalStorage runtime)

Debug yoqilgan bo‘lsa, `AiOrchestrator` “runtime” yaratadi:

- `createAiDebugRuntime(...)`
- `runWithAiDebugRuntime(...)`
- `finalizeAiDebugTrace(...)`

Fayl:

- [src/services/ai-debug/aiDebugTrace.ts](src/services/ai-debug/aiDebugTrace.ts)

Bu runtime odatda quyidagilarni yig‘adi:

- tool tanlovi va sabab
- warning/error’lar
- Prisma query’lar (agar Prisma instrumentation ulab qo‘yilgan bo‘lsa)

So‘ng `AiUsageLog.meta.debugTrace` ga tushadi va admin panelda ko‘rinadi.

## 5) Admin “AI Debug Console” qayerdan o‘qiydi?

Admin endpoint:

- `GET /api/admin/ai/debug-traces`

Kod:

- [src/controllers/admin/AdminAiDebugController.ts](src/controllers/admin/AdminAiDebugController.ts)

Endpoint `AiUsageLogService.listDebugTraces()` orqali oxirgi log’larni qaytaradi.

Eslatma: Debug trace bo‘lmasa ham log row qaytadi; UI boyroq ko‘rsatish uchun `meta.debugTrace` bor-yo‘qligiga qarab render qiladi.

## 6) Terminal’dan tez tekshirish (dev)

1. Student login:

- `POST /api/auth/login` → JWT token olasiz.

2. AI chat:

- `POST /api/ai/chat` (SSE)

3. Admin debug traces:

- `GET /api/admin/ai/debug-traces?take=10`

Amalda siz tekshiradigan field’lar:

- `toolName` (qaysi tool ishladi yoki `null`)
- `status` (`OK` / `ERROR`)
- `meta.debugTrace` (trace bor-yo‘qligi)

## 7) Qachon tool, qachon context?

Soddalashtirilgan qoida:

- **Profil / bugungi jadval** kabi ma’lumotlar `buildContext` orqali kelayotgan bo‘lsa, router ko‘pincha `type="llm"` tanlaydi.
- **Ko‘proq aniqlik yoki kengroq dataset** kerak bo‘lsa (attendance, grades, tarixiy schedule, search), router `type="tool"` tanlashi kerak.

Agar tool noto‘g‘ri tanlanayotgan bo‘lsa, odatda 3 ta sabab bo‘ladi:

1. `AiClassifier` prompt/router instruktsiyasi haddan tashqari umumiy
2. allowed tool ro‘yxati kam yoki DB config’da o‘chirilgan
3. context ichida yetarli ma’lumot borligi uchun router tool ishlatmayapti (bu har doim ham muammo emas)

## 8) Yangi tool qo‘shish (qisqa cheklist)

1. Tool implementatsiya:

- `src/ai/tools/...`

2. Registry’ga qo‘shish:

- `src/ai/tools/toolRegistry.ts`

3. Name’ni ro‘yxatga kiritish:

- `src/services/ai-tools/toolNames.ts`

4. Default config:

- `AiToolConfigService` (role’lar bo‘yicha enable)

5. Response format:

- `src/ai/core/AiResponder.ts`

6. Router instruktsiya:

- `src/ai/core/AiClassifier.ts`

## 9) Xavfsizlik va data minimizatsiya

- `buildContext` faqat “minimal identity + kerakli preview” beradi.
- DB’dan olingan sensitive ma’lumotlar tool’lar orqali ham RBAC/config bilan cheklanadi.
- Admin debug trace’larda user ma’lumoti/loglar ko‘p bo‘lishi mumkin — production’da debug’ni ehtiyotkor yoqing.

---

Agar xohlasangiz, keyingi qadam sifatida:

- student uchun `getStudentGradesRecent` va `getStudentAttendanceRecent` tool’lari real ma’lumot qaytarayotganini terminal orqali ham tekshirib beraman (DB’da grade/attendance data bo‘lsa).
