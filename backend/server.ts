import { connectDatabase } from "./config/db";
import { env } from "./config/env";
import app from "./app";

// Local/self-hosted entry point only. On Vercel, app.ts is imported directly
// as the serverless function and this file is never executed.
async function start(): Promise<void> {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`Journal API listening on http://localhost:${env.port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Could not start:", error instanceof Error ? error.message : error);
  process.exit(1);
});