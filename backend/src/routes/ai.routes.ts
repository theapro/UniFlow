import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { AiController } from "../controllers/ai/AiController";
import { AiAssistantController } from "../controllers/ai/AiAssistantController";
import { StudentService } from "../services/user/StudentService";
import { TeacherService } from "../services/user/TeacherService";
import { UserRole } from "@prisma/client";

const router = Router();

const aiController = new AiController(
  new StudentService(),
  new TeacherService(),
);

const aiAssistantController = new AiAssistantController();

// All AI endpoints require auth (avoid leaking university/student data)
router.use(authMiddleware);

// Models allowed by admin policy for this user
router.get("/models", aiController.listAllowedModels);

// Personalized greeting for empty chat state
router.get("/greeting", aiController.getGreeting);

// Safe, aggregated context (authenticated)
router.get("/context", aiController.getSystemContext);

// Student context verification (before AI query)
router.post("/students/verify", aiController.verifyStudent);

// Potentially sensitive search endpoints (admin only)
router.get(
  "/search",
  roleMiddleware([UserRole.ADMIN]),
  aiController.searchData,
);

router.post("/chat", aiController.chat);

// DB-backed chat sessions/messages
router.get("/chat/sessions", aiController.listChatSessions);
router.post("/chat/sessions", aiController.createChatSession);
router.patch("/chat/sessions/:sessionId", aiController.renameChatSession);
router.delete("/chat/sessions/:sessionId", aiController.deleteChatSession);
router.get("/chat/sessions/:sessionId/messages", aiController.listChatMessages);

// LLM chat (streams SSE, stores messages in DB, injects context)
router.post("/llm/chat", aiController.llmChat);

// Tool-based assistant (RBAC + tool toggles + usage logs)
router.post("/assistant/chat", aiAssistantController.chat);

export default router;
