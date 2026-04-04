import { Router } from "express";
import multer from "multer";
import { ReceptionistPublicController } from "../controllers/receptionist/ReceptionistPublicController";
import { ReceptionistPublicService } from "../services/receptionist/ReceptionistPublicService";
import { ReceptionistVoiceService } from "../services/receptionist/ReceptionistVoiceService";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

const controller = new ReceptionistPublicController(
  new ReceptionistPublicService(),
  new ReceptionistVoiceService(),
);

router.get("/init", controller.init);
router.post("/chat", controller.chat);
router.post("/voice", upload.single("audio"), controller.voiceChat);

export default router;
