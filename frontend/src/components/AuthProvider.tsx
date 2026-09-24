import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { UNAUTHORIZED_EVENT } from "../api/api";
import * as authApi from "../api/auth.api";

type AuthStatus = "loading" | "locked" | "unlocked";

interface AuthContextValue {
  status: AuthStatus;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    authApi
      .fetchSession()
      .then((valid) => setStatus(valid ? "unlocked" : "locked"))
      .catch(() => setStatus("locked"));
  }, []);

  // Any private request that comes back "not signed in" sends you back to the gate.
  useEffect(() => {
    const onUnauthorized = () => setStatus("locked");
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const unlock = useCallback(async (password: string) => {
    await authApi.login(password);
    setStatus("unlocked");
  }, []);

  const lock = useCallback(async () => {
    await authApi.logout();
    setStatus("locked");
  }, []);

  const value = useMemo(() => ({ status, unlock, lock }), [status, unlock, lock]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}