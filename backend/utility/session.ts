import type { Request, Response } from "express";
import { env } from "../config/env";

export const SESSION_COOKIE = "journal_session";
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Cross-origin (frontend and backend on separate Vercel domains) requires
// SameSite=None, which browsers only honour alongside Secure. Locally, frontend
// and backend share the same site (just different ports), so Strict still works
// there and keeps local dev on plain http functioning without HTTPS.
const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: (env.isProduction ? "none" : "strict") as "none" | "strict",
  path: "/",
};

export function startSession(res: Response): void {
  const expiresAt = Date.now() + SESSION_DAYS * DAY_MS;
  res.cookie(SESSION_COOKIE, String(expiresAt), {
    ...cookieOptions,
    signed: true,
    // Deliberately no maxAge: this stays a browser session cookie, gone the
    // moment the browser itself is closed, not just the tab — a physical-access
    // privacy choice, not an oversight. expiresAt above is a separate, longer-lived
    // application-level check for while the browser stays open.
  });
}

export function endSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

export function hasValidSession(req: Request): boolean {
  const value: unknown = req.signedCookies?.[SESSION_COOKIE];
  if (typeof value !== "string") return false;
  const expiresAt = Number(value);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}