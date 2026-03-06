import { Router } from "express";
import adminRoutes from "./admin.routes";
import userRoutes from "./user.routes";
import aiRoutes from "./ai.routes";
import authRoutes from "./auth.routes";
import webhooksRoutes from "./webhooks.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/user", userRoutes);
router.use("/ai", aiRoutes);
router.use("/webhooks", webhooksRoutes);

export default router;
