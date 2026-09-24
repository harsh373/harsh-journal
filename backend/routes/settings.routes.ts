import { Router } from "express";
import { getSettings, saveSettings } from "../controller/settings.controller";

const router = Router();

router.get("/", getSettings);
router.put("/", saveSettings);

export default router;