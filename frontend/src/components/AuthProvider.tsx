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

// Lives only as long as this browser tab. A new tab or a reopened browser has no flag,
// so the password is asked again even if the server cookie is still valid.
const TAB_FLAG = "journal-tab-unlocked";

function readTabFlag(): boolean {
  try {
    return sessionStorage.getItem(TAB_FLAG) === "1";
  } catch {
    return false;
  }
}

function writeTabFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(TAB_FLAG, "1");
    else sessionStorage.removeItem(TAB_FLAG);
  } catch {
    // storage blocked: ignore, the gate simply asks again next time
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    authApi
      .fetchSession()
      .then(async (valid) => {
        if (valid && !readTabFlag()) {
          // Server still trusts this browser, but this is a fresh visit: force the gate.
          await authApi.logout().catch(() => {});
          setStatus("locked");
          return;
        }
        setStatus(valid ? "unlocked" : "locked");
      })
      .catch(() => setStatus("locked"));
  }, []);

  // Any private request that comes back "not signed in" sends you back to the gate.
  useEffect(() => {
    const onUnauthorized = () => {
      writeTabFlag(false);
      setStatus("locked");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const unlock = useCallback(async (password: string) => {
    await authApi.login(password);
    writeTabFlag(true);
    setStatus("unlocked");
  }, []);

  const lock = useCallback(async () => {
    await authApi.logout();
    writeTabFlag(false);
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