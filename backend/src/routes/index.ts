import { Router } from "express";
import adminRoutes from "./admin.routes";
import userRoutes from "./user.routes";
import aiRoutes from "./ai.routes";
import authRoutes from "./auth.routes";
import webhooksRoutes from "./webhooks.routes";
import scheduleRoutes from "./schedule.routes";
import receptionistRoutes from "./receptionist.routes";
import { universityDataRoutes } from "./university-data.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/schedule", scheduleRoutes);
router.use("/admin", adminRoutes);
router.use("/user", userRoutes);
router.use("/ai", aiRoutes);
router.use("/receptionist", receptionistRoutes);
router.use("/", universityDataRoutes);
router.use("/webhooks", webhooksRoutes);

export default router;
