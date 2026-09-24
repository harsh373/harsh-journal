import type { NextFunction, Request, Response } from "express";
import { hasValidSession } from "./session";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!hasValidSession(req)) {
    res.status(401).json({ message: "Not signed in" });
    return;
  }
  next();
}