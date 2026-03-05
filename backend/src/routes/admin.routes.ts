import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";
import { AdminStudentController } from "../controllers/admin/AdminStudentController";
import { AdminStudentService } from "../services/admin/AdminStudentService";
import { AdminTeacherController } from "../controllers/admin/AdminTeacherController";
import { AdminTeacherService } from "../services/admin/AdminTeacherService";
import { AdminScheduleController } from "../controllers/admin/AdminScheduleController";
import { AdminScheduleService } from "../services/admin/AdminScheduleService";
import { AdminAttendanceController } from "../controllers/admin/AdminAttendanceController";
import { AdminAttendanceService } from "../services/admin/AdminAttendanceService";
import { AdminSubjectController } from "../controllers/admin/AdminSubjectController";
import { AdminSubjectService } from "../services/admin/AdminSubjectService";
import { AdminGroupController } from "../controllers/admin/AdminGroupController";
import { AdminGroupService } from "../services/admin/AdminGroupService";
import { AdminLessonController } from "../controllers/admin/AdminLessonController";
import { AdminLessonService } from "../services/admin/AdminLessonService";
import { AdminAiModelController } from "../controllers/admin/AdminAiModelController";
import { AiModelService } from "../services/ai/AiModelService";

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware([UserRole.ADMIN]));

// Verify endpoint - validates token and returns user info
router.get("/verify", (req, res) => {
  // If we reach here, token is valid (checked by authMiddleware)
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

const adminStudentController = new AdminStudentController(
  new AdminStudentService(),
);
const adminTeacherController = new AdminTeacherController(
  new AdminTeacherService(),
);
const adminScheduleController = new AdminScheduleController(
  new AdminScheduleService(),
);
const adminAttendanceController = new AdminAttendanceController(
  new AdminAttendanceService(),
);
const adminSubjectController = new AdminSubjectController(
  new AdminSubjectService(),
);
const adminGroupController = new AdminGroupController(new AdminGroupService());
const adminLessonController = new AdminLessonController(
  new AdminLessonService(),
);
const adminAiModelController = new AdminAiModelController(new AiModelService());

// Students
router.get("/students", adminStudentController.list);
router.get("/students/:id", adminStudentController.getById);
router.post("/students", adminStudentController.create);
router.post(
  "/students/:id/resend-credentials",
  adminStudentController.resendCredentials,
);
router.put("/students/:id", adminStudentController.update);
router.delete("/students/:id", adminStudentController.remove);

// Teachers
router.get("/teachers", adminTeacherController.list);
router.get("/teachers/:id", adminTeacherController.getById);
router.post("/teachers", adminTeacherController.create);
router.post(
  "/teachers/:id/resend-credentials",
  adminTeacherController.resendCredentials,
);
router.put("/teachers/:id", adminTeacherController.update);
router.delete("/teachers/:id", adminTeacherController.remove);

// Schedule
router.get("/schedule", adminScheduleController.list);
router.get("/schedule/:id", adminScheduleController.getById);
router.post("/schedule", adminScheduleController.create);
router.put("/schedule/:id", adminScheduleController.update);
router.delete("/schedule/:id", adminScheduleController.remove);

// Attendance
router.get("/attendance", adminAttendanceController.list);
router.get("/attendance/:id", adminAttendanceController.getById);
router.post("/attendance", adminAttendanceController.create);
router.post("/attendance/bulk", adminAttendanceController.bulkMark);
router.put("/attendance/:id", adminAttendanceController.update);
router.delete("/attendance/:id", adminAttendanceController.remove);

// Subjects
router.get("/subjects", adminSubjectController.list);
router.get("/subjects/:id", adminSubjectController.getById);
router.post("/subjects", adminSubjectController.create);
router.put("/subjects/:id", adminSubjectController.update);
router.delete("/subjects/:id", adminSubjectController.remove);

// Groups
router.get("/groups", adminGroupController.list);
router.get("/groups/:id", adminGroupController.getById);
router.post("/groups", adminGroupController.create);
router.put("/groups/:id", adminGroupController.update);
router.delete("/groups/:id", adminGroupController.remove);

// Lessons
router.get("/lessons", adminLessonController.list);
router.get("/lessons/:id", adminLessonController.getById);
router.post("/lessons", adminLessonController.create);
router.put("/lessons/:id", adminLessonController.update);
router.delete("/lessons/:id", adminLessonController.remove);

// AI Models
router.get("/ai/models", adminAiModelController.list);
router.patch("/ai/models/:id", adminAiModelController.update);

export default router;
