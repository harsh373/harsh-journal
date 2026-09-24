import { Router } from "express";
import {
  createLog,
  createTrack,
  deleteLog,
  deleteTrack,
  getTrack,
  listLogs,
  listLogsForDay,
  listTracks,
  updateLog,
  updateTrack,
} from "../controller/track.controller";

const router = Router();

// "/logs" must come before "/:id", otherwise "logs" would be read as a track id.
router.get("/logs", listLogsForDay);

router.get("/", listTracks);
router.post("/", createTrack);
router.get("/:id", getTrack);
router.put("/:id", updateTrack);
router.delete("/:id", deleteTrack);

router.get("/:id/logs", listLogs);
router.post("/:id/logs", createLog);
router.put("/:id/logs/:logId", updateLog);
router.delete("/:id/logs/:logId", deleteLog);

export default router;