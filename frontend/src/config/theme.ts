import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "journal-theme";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// Runs once, as soon as this module is imported — before the app renders.
// Without this, the toggle only ever changed the theme for the current tab;
// a refresh silently fell back to light every time because nothing read the
// saved preference back. Falls back to the OS-level preference on first visit.
(function initTheme() {
  let initial: Theme = "light";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      initial = saved;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initial = "dark";
    }
  } catch {
    // Storage or matchMedia blocked; light is a safe default.
  }
  document.documentElement.dataset.theme = initial;
})();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the theme still changes for this visit.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { theme, toggleTheme };
}