import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "production" | "test";

export interface Env {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  clientOrigin: string;
  journalPassword: string;
  sessionSecret: string;
  mongodbUri: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === "production" || value === "test") return value;
  return "development";
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 4000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return port;
}

// The server refuses to start with a missing or placeholder secret,
// so a forgotten .env can never leave the journal open or guessable.
function requireSecret(name: string, value: string | undefined, minLength: number): string {
  if (!value || value.startsWith("change-me")) {
    throw new Error(`${name} is not set. Add a real value to backend/.env.`);
  }
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters.`);
  }
  return value;
}

function requireValue(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`${name} is not set. Add it to backend/.env.`);
  }
  return value.trim();
}

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);

export const env: Env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: parsePort(process.env.PORT),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  journalPassword: requireSecret("JOURNAL_PASSWORD", process.env.JOURNAL_PASSWORD, 8),
  sessionSecret: requireSecret("SESSION_SECRET", process.env.SESSION_SECRET, 32),
  mongodbUri: requireValue("MONGODB_URI", process.env.MONGODB_URI),
  cloudinaryCloudName: requireValue("CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME),
  cloudinaryApiKey: requireValue("CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY),
  cloudinaryApiSecret: requireValue("CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET),
};