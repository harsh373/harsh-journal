import { Router } from "express";
import { login, logout, session } from "../controller/auth.controller";
import { loginLimiter } from "../utility/loginLimiter";

const router = Router();

router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/session", session);

export default router;