import { Router } from "express";
import adminRoutes from "./admin.routes";
import userRoutes from "./user.routes";
import aiRoutes from "./ai.routes";
import authRoutes from "./auth.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/user", userRoutes);
router.use("/ai", aiRoutes);

export default router;
