import { Router } from "express";
import { createEntry, getRecent, getTodayCount, updatePresentState } from "../controller/now.controller";

const router = Router();

router.post("/entries", createEntry);
router.patch("/entries/:id", updatePresentState);
router.get("/today", getTodayCount);
router.get("/recent", getRecent);

export default router;