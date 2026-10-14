import { useCallback, useEffect, useState } from "react";
import { fetchArchivePage } from "../api/journal.api";
import type { ArchiveEntry } from "../api/journal.api";
import type { DayKey } from "../config/dates";

export type ArchiveState = "loading" | "ready" | "error";

// Reads the whole archive through the same authorized endpoint the "All Days"
// page uses, page by page. Nothing is cached outside this component and no
// journal text leaves the app.
export function useArchiveEntries() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [state, setState] = useState<ArchiveState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    (async () => {
      try {
        const all: ArchiveEntry[] = [];
        let cursor: DayKey | null = null;
        let pages = 0;
        do {
          const page = await fetchArchivePage(cursor);
          all.push(...page.entries);
          cursor = page.nextCursor;
          pages += 1;
        } while (cursor && pages < 500 && !cancelled);

        if (!cancelled) {
          setEntries(all);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { entries, state, retry };
}