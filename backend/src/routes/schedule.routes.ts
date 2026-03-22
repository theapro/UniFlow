import { Router } from "express";
import { Role } from "@prisma/client";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/access-control.middleware";
import { AdminScheduleGeneratorController } from "../controllers/admin/AdminScheduleGeneratorController";
import { ScheduleGeneratorService } from "../services/scheduling/ScheduleGeneratorService";

const router = Router();

router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));

const controller = new AdminScheduleGeneratorController(
  new ScheduleGeneratorService(),
);

router.post("/generate", controller.generate);

export default router;
