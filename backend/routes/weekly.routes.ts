import { Router } from "express";
import {
  addWeeklyItem,
  deleteWeeklyItem,
  getWeeklyPlan,
  reorderWeeklyItems,
  updateWeeklyItem,
} from "../controller/weekly.controller";

const router = Router();

router.get("/:weekStart", getWeeklyPlan);
router.post("/:weekStart/items", addWeeklyItem);
router.put("/:weekStart/items/:itemId", updateWeeklyItem);
router.delete("/:weekStart/items/:itemId", deleteWeeklyItem);
router.put("/:weekStart/reorder", reorderWeeklyItems);

export default router;