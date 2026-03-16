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
import { AdminCohortController } from "../controllers/admin/AdminCohortController";
import { AdminCohortService } from "../services/admin/AdminCohortService";
import { AdminParentGroupController } from "../controllers/admin/AdminParentGroupController";
import { AdminParentGroupService } from "../services/admin/AdminParentGroupService";
import { AdminAiModelController } from "../controllers/admin/AdminAiModelController";
import { AiModelService } from "../services/ai/AiModelService";
import { AdminAiSettingsController } from "../controllers/admin/AdminAiSettingsController";
import { AiSettingsService } from "../services/ai/AiSettingsService";
import { AdminAiToolsController } from "../controllers/admin/AdminAiToolsController";
import { AiToolConfigService } from "../services/ai/AiToolConfigService";
import { AdminAiLogsController } from "../controllers/admin/AdminAiLogsController";
import { AiUsageLogService } from "../services/ai/AiUsageLogService";
import { AdminAiTestController } from "../controllers/admin/AdminAiTestController";
import { AdminStudentsSheetsController } from "../controllers/admin/AdminStudentsSheetsController";
import { AdminTeachersSheetsController } from "../controllers/admin/AdminTeachersSheetsController";
import { AdminAttendanceSheetsController } from "../controllers/admin/AdminAttendanceSheetsController";
import { AdminGradesSheetsController } from "../controllers/admin/AdminGradesSheetsController";
import { AdminPurgeController } from "../controllers/admin/AdminPurgeController";
import { AdminMonthlyScheduleController } from "../controllers/admin/AdminMonthlyScheduleController";
import { AdminMonthlyScheduleService } from "../services/admin/AdminMonthlyScheduleService";
import { AdminAiScheduleController } from "../controllers/admin/AdminAiScheduleController";
import { AIScheduleGeneratorService } from "../services/scheduling/AIScheduleGeneratorService";
import { AdminAiGroupsController } from "../controllers/admin/AdminAiGroupsController";
import { AiGroupLayoutService } from "../services/scheduling/AiGroupLayoutService";
import { AdminRoomsController } from "../controllers/admin/AdminRoomsController";
import { AdminRoomsService } from "../services/admin/AdminRoomsService";
import { AdminTimeSlotsController } from "../controllers/admin/AdminTimeSlotsController";
import { AdminTimeSlotsService } from "../services/admin/AdminTimeSlotsService";

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
const adminCohortController = new AdminCohortController(
  new AdminCohortService(),
);
const adminLessonController = new AdminLessonController(
  new AdminLessonService(),
);
const adminParentGroupController = new AdminParentGroupController(
  new AdminParentGroupService(),
);
const adminAiModelController = new AdminAiModelController(new AiModelService());
const adminAiSettingsController = new AdminAiSettingsController(
  new AiSettingsService(),
);
const adminAiToolsController = new AdminAiToolsController(
  new AiToolConfigService(),
);
const adminAiLogsController = new AdminAiLogsController(
  new AiUsageLogService(),
);
const adminAiTestController = new AdminAiTestController();
const adminStudentsSheetsController = new AdminStudentsSheetsController();
const adminTeachersSheetsController = new AdminTeachersSheetsController();
const adminAttendanceSheetsController = new AdminAttendanceSheetsController();
const adminGradesSheetsController = new AdminGradesSheetsController();
const adminPurgeController = new AdminPurgeController();
const adminMonthlyScheduleService = new AdminMonthlyScheduleService();
const adminMonthlyScheduleController = new AdminMonthlyScheduleController(
  adminMonthlyScheduleService,
);
const adminAiScheduleController = new AdminAiScheduleController(
  new AIScheduleGeneratorService(),
  adminMonthlyScheduleService,
);
const adminAiGroupsController = new AdminAiGroupsController(
  new AiGroupLayoutService(),
);
const adminRoomsController = new AdminRoomsController(new AdminRoomsService());
const adminTimeSlotsController = new AdminTimeSlotsController(
  new AdminTimeSlotsService(),
);

// Inter-service wiring for Subjects <-> TeachersSheets
adminSubjectController.setSyncService(
  adminTeachersSheetsController.getSyncService(),
);

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

// Monthly Schedule Builder
router.get(
  "/monthly-schedule/months",
  adminMonthlyScheduleController.listMonths,
);
router.get("/monthly-schedule", adminMonthlyScheduleController.list);
router.post("/monthly-schedule", adminMonthlyScheduleController.create);
router.put("/monthly-schedule/:id", adminMonthlyScheduleController.update);
router.delete("/monthly-schedule/:id", adminMonthlyScheduleController.remove);

// AI Automatic Schedule Generator
router.post("/ai-schedule/generate", adminAiScheduleController.generate);

// AI Helpers
router.post("/ai-groups/arrange", adminAiGroupsController.arrange);

// Rooms / TimeSlots
router.get("/rooms", adminRoomsController.list);
router.get("/rooms/:id", adminRoomsController.getById);
router.post("/rooms", adminRoomsController.create);
router.put("/rooms/:id", adminRoomsController.update);
router.delete("/rooms/:id", adminRoomsController.remove);
router.get("/time-slots", adminTimeSlotsController.list);

// Attendance
router.get("/attendance", adminAttendanceController.list);
router.get("/attendance/by-date", adminAttendanceController.getByDate);
router.get("/attendance/:id", adminAttendanceController.getById);
router.post("/attendance", adminAttendanceController.create);
router.post("/attendance/bulk", adminAttendanceController.bulkMark);
router.post(
  "/attendance/by-date/bulk",
  adminAttendanceController.bulkMarkByDate,
);
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

// Cohorts
router.get("/cohorts", adminCohortController.list);
router.get("/cohorts/:id", adminCohortController.getById);
router.post("/cohorts", adminCohortController.create);
router.put("/cohorts/:id", adminCohortController.update);
router.delete("/cohorts/:id", adminCohortController.remove);

// Parent Groups
router.get("/parent-groups", adminParentGroupController.list);
router.get("/parent-groups/:id", adminParentGroupController.getById);
router.post("/parent-groups", adminParentGroupController.create);
router.put("/parent-groups/:id", adminParentGroupController.update);
router.delete("/parent-groups/:id", adminParentGroupController.remove);

// Lessons
router.get("/lessons", adminLessonController.list);
router.get("/lessons/:id", adminLessonController.getById);
router.post("/lessons", adminLessonController.create);
router.put("/lessons/:id", adminLessonController.update);
router.delete("/lessons/:id", adminLessonController.remove);

// AI Models
router.get("/ai/models", adminAiModelController.list);
router.patch("/ai/models/:id", adminAiModelController.update);

// AI Settings / Tools / Logs
router.get("/ai/settings", adminAiSettingsController.get);
router.patch("/ai/settings", adminAiSettingsController.patch);

router.get("/ai/tools", adminAiToolsController.list);
router.patch("/ai/tools/:name", adminAiToolsController.patch);

router.get("/ai/logs", adminAiLogsController.list);

// Admin-only AI testing endpoint (impersonates student/teacher roles)
router.post("/ai/test-chat", adminAiTestController.chat);

// Students Spreadsheet (Google Sheets) Sync
router.get("/students-sheets/health", adminStudentsSheetsController.getHealth);
router.get("/students-sheets/status", adminStudentsSheetsController.getStatus);
router.post("/students-sheets/sync", adminStudentsSheetsController.syncNow);
router.get(
  "/students-sheets/groups/status",
  adminStudentsSheetsController.getGroupsStatus,
);
router.post(
  "/students-sheets/groups/sync",
  adminStudentsSheetsController.syncGroupsNow,
);
router.get(
  "/students-sheets/conflicts",
  adminStudentsSheetsController.listConflicts,
);
router.get(
  "/students-sheets/conflicts/:id",
  adminStudentsSheetsController.getConflict,
);
router.post(
  "/students-sheets/conflicts/:id/resolve",
  adminStudentsSheetsController.resolveConflict,
);

// Teachers Spreadsheet (Google Sheets) Sync
router.get("/teachers-sheets/health", adminTeachersSheetsController.getHealth);
router.get("/teachers-sheets/status", adminTeachersSheetsController.getStatus);
router.post("/teachers-sheets/sync", adminTeachersSheetsController.syncNow);
router.post(
  "/teachers-sheets/sync-to-sheets",
  adminTeachersSheetsController.syncDbToSheetsNow,
);

// Attendance Spreadsheet (Google Sheets) Sync
router.get(
  "/attendance-sheets/health",
  adminAttendanceSheetsController.getHealth,
);
router.get(
  "/attendance-sheets/status",
  adminAttendanceSheetsController.getStatus,
);
router.post("/attendance-sheets/sync", adminAttendanceSheetsController.syncNow);
router.get("/attendance-sheets/tabs", adminAttendanceSheetsController.listTabs);
router.post(
  "/attendance-sheets/tabs",
  adminAttendanceSheetsController.createTab,
);
router.get(
  "/attendance-sheets/preview",
  adminAttendanceSheetsController.previewTab,
);

// Grades Spreadsheet (Google Sheets)
router.get("/grades-sheets/health", adminGradesSheetsController.getHealth);
router.get("/grades-sheets/status", adminGradesSheetsController.getStatus);
router.post("/grades-sheets/sync", adminGradesSheetsController.syncNow);
router.post(
  "/grades-sheets/force-sync",
  adminGradesSheetsController.forceSyncNow,
);
router.get("/grades-sheets/tabs", adminGradesSheetsController.listTabs);
router.get("/grades-sheets/preview", adminGradesSheetsController.previewTab);
router.post("/grades-sheets/update", adminGradesSheetsController.updateTab);

// Danger zone: bulk purge (keeps ADMIN users)
router.post("/purge", adminPurgeController.purgeAll);

export default router;
