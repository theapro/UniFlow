import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";
import { StudentController } from "../controllers/user/StudentController";
import { StudentService } from "../services/user/StudentService";
import { TeacherController } from "../controllers/user/TeacherController";
import { TeacherService } from "../services/user/TeacherService";
import { ScheduleController } from "../controllers/user/ScheduleController";
import { ScheduleService } from "../services/user/ScheduleService";
import { AttendanceController } from "../controllers/user/AttendanceController";
import { AttendanceService } from "../services/user/AttendanceService";

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware([UserRole.STUDENT, UserRole.TEACHER]));

const studentController = new StudentController(new StudentService());
const teacherController = new TeacherController(new TeacherService());
const scheduleController = new ScheduleController(new ScheduleService());
const attendanceController = new AttendanceController(new AttendanceService());

// Student endpoints
router.get("/student/me/schedule/today", studentController.getTodaySchedule);
router.get("/student/me/attendance", studentController.getAttendance);

// Teacher endpoints
router.get("/teacher/me/lessons/today", teacherController.getTodayLessons);
router.get(
  "/teacher/me/groups/:groupId/schedule",
  teacherController.getGroupSchedule,
);

// Schedule endpoints (both roles)
router.get("/schedule", scheduleController.getSchedule);

// Attendance endpoints (teacher only)
router.post("/attendance/mark", attendanceController.markAttendance);
router.get(
  "/attendance/lesson/:lessonId",
  attendanceController.getAttendanceByLesson,
);

export default router;
