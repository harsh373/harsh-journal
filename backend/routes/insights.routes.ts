import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  analyzeDay,
  askQuestion,
  listMemory,
  listOpenLoops,
  setLoopStatus,
} from "../controller/insights.controller";

const router = Router();

router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, slow down a little" },
  }),
);

const askLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many questions, wait a minute and try again" },
});

router.post("/analyze/:date", analyzeDay);
router.post("/ask", askLimiter, askQuestion);
router.get("/memory", listMemory);
router.get("/open-loops", listOpenLoops);
router.patch("/open-loops/:id", setLoopStatus);

export default router;