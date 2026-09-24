import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ message: "Not found" });
}

// Express recognises error handlers by their four arguments, so `_next` must stay.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : "Unexpected error";
  if (!env.isProduction) console.error(err);
  res.status(500).json({ message: env.isProduction ? "Server error" : message });
}