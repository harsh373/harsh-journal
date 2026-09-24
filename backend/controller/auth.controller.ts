import type { Request, Response } from "express";
import { env } from "../config/env";
import { passwordMatches } from "../utility/passwordCheck";
import { endSession, hasValidSession, startSession } from "../utility/session";

const MAX_PASSWORD_LENGTH = 200;

export function login(req: Request, res: Response): void {
  const password: unknown = req.body?.password;

  if (typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ message: "Enter your password" });
    return;
  }

  if (!passwordMatches(password, env.journalPassword)) {
    res.status(401).json({ message: "Incorrect password" });
    return;
  }

  startSession(res);
  res.status(200).json({ authenticated: true });
}

export function logout(_req: Request, res: Response): void {
  endSession(res);
  res.status(200).json({ authenticated: false });
}

export function session(req: Request, res: Response): void {
  if (!hasValidSession(req)) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.status(200).json({ authenticated: true });
}