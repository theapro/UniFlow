import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { AiController } from "../controllers/ai/AiController";
import { StudentService } from "../services/user/StudentService";
import { TeacherService } from "../services/user/TeacherService";
import { Role } from "@prisma/client";
import { AiOrchestrator } from "../ai/core/AiOrchestrator";
import { AiDebugRunController } from "../controllers/ai/AiDebugRunController";
import { requireRole } from "../middlewares/access-control.middleware";

const router = Router();

const aiController = new AiController(
  new StudentService(),
  new TeacherService(),
);
const orchestrator = new AiOrchestrator();
const aiDebugRunController = new AiDebugRunController();

// All AI endpoints require auth (avoid leaking university/student data)
router.use(authMiddleware);

// Only student/teacher (and optionally admin) can use AI chat features.
router.use(requireRole([Role.STUDENT, Role.TEACHER, Role.ADMIN]));

// Models allowed by admin policy for this user
router.get("/models", aiController.listAllowedModels);

// Personalized greeting for empty chat state
router.get("/greeting", aiController.getGreeting);

// Safe, aggregated context (authenticated)
router.get("/context", aiController.getSystemContext);

// Student context verification (before AI query)
router.post("/students/verify", aiController.verifyStudent);

// Potentially sensitive search endpoints (admin only)
router.get("/search", requireRole(Role.ADMIN), aiController.searchData);

// Unified AI assistant entry point (tool-first + RBAC)
router.post("/chat", orchestrator.handleChat);

// Force-run tools and raw debug queries (admin-only)
router.post("/debug-run", requireRole(Role.ADMIN), aiDebugRunController.run);

// DB-backed chat sessions/messages
router.get("/chat/sessions", aiController.listChatSessions);
router.post("/chat/sessions", aiController.createChatSession);
router.patch("/chat/sessions/:sessionId", aiController.renameChatSession);
router.delete("/chat/sessions/:sessionId", aiController.deleteChatSession);
router.get("/chat/sessions/:sessionId/messages", aiController.listChatMessages);
router.post("/chat/sessions/:sessionId/messages", aiController.addChatMessage);
router.get(
  "/chat/sessions/:sessionId/messages/export",
  aiController.exportChatMessages,
);

export default router;
