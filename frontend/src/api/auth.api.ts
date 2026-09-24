import { isAxiosError } from "axios";
import { api } from "./api";

// True if the browser holds a valid session cookie. A 401 is a normal "no", not an error.
export async function fetchSession(): Promise<boolean> {
  try {
    await api.get("/auth/session");
    return true;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) return false;
    throw error;
  }
}

export async function login(password: string): Promise<void> {
  await api.post("/auth/login", { password });
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

// Turns a failed login into a sentence the gate can show.
export function loginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (!error.response) return "Can't reach the server.";
  }
  return "Something went wrong. Try again.";
}