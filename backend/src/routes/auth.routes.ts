import { Router } from "express";
import { AuthController } from "../controllers/auth/AuthController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.post("/login", AuthController.login);
router.post("/google", AuthController.googleLogin);
router.post("/login-code/request", AuthController.requestLoginCode);
router.post("/login-code/verify", AuthController.verifyLoginCode);

// Protected routes
router.get("/me", authMiddleware, AuthController.me);

export default router;
