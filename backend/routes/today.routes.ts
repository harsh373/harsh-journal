import { Router } from "express";
import { addTodayItem, deleteTodayItem, getTodayPlan, updateTodayItem } from "../controller/today.controller";

const router = Router();

router.get("/:date", getTodayPlan);
router.post("/:date/items", addTodayItem);
router.put("/:date/items/:itemId", updateTodayItem);
router.delete("/:date/items/:itemId", deleteTodayItem);

export default router;