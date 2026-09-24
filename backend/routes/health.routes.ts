import { Router } from "express";
import { getHealth } from "../controller/health.controller";

const router = Router();

router.get("/", getHealth);

export default router;