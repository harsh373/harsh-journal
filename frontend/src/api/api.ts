import axios, { isAxiosError } from "axios";

export const UNAUTHORIZED_EVENT = "journal:unauthorized";

// Two separate Vercel projects means two separate domains, so this can't be a
// relative "/api" path — it has to point at wherever the backend is actually
// deployed. VITE_API_URL is baked in at build time (see below for where to set it).
const backendOrigin = import.meta.env.VITE_API_URL ?? "";

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