import axios, { isAxiosError } from "axios";

export const UNAUTHORIZED_EVENT = "journal:unauthorized";

// In production the browser talks only to the frontend's own domain. vercel.json forwards
// /api to the backend, which keeps the login cookie first-party (works on every browser).
// VITE_API_URL is used only during local development (npm run dev), never in a deployed build.
const backendOrigin = import.meta.env.DEV ? (import.meta.env.VITE_API_URL ?? "") : "";

export const api = axios.create({
  baseURL: `${backendOrigin}/api`,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const isAuthCall = isAxiosError(error) && error.config?.url?.startsWith("/auth/");
    if (isAxiosError(error) && error.response?.status === 401 && !isAuthCall) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);