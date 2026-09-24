import mongoose from "mongoose";
import { env } from "./env";

// On a serverless platform, this module can be evaluated once per cold start
// and then reused across many requests on the same warm instance. Reconnecting
// on every request would waste time; connecting in parallel on a burst of
// simultaneous cold starts would open multiple connections toward Atlas's limit.
// This caches both the "already connected" state and any in-flight connection.
let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
    });
    connectionPromise = mongoose
      .connect(env.mongodbUri, { serverSelectionTimeoutMS: 10_000 })
      .catch((error) => {
        connectionPromise = null; // let the next request retry instead of staying stuck
        throw error;
      });
  }

  await connectionPromise;
  console.log("MongoDB connected");
}