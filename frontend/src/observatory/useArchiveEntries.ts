import { useCallback, useEffect, useRef, useState } from "react";
import { fetchArchivePage } from "../api/journal.api";
import type { ArchiveEntry } from "../api/journal.api";
import type { DayKey } from "../config/dates";
import { buildMemories } from "./model";
import type { Memory } from "./model";

export type ArchiveState = "loading" | "ready" | "error";


export function useArchiveEntries() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [state, setState] = useState<ArchiveState>("loading");
  const [attempt, setAttempt] = useState(0);
  const days = useRef(new Map<DayKey, ArchiveEntry[]>());

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    (async () => {
      try {
        const all: ArchiveEntry[] = [];
        let cursor: DayKey | null = null;
        let pages = 0;
        do {
          const page = await fetchArchivePage(cursor); // SWAP 1: fetchArchiveIndex()
          all.push(...page.entries);
          cursor = page.nextCursor;
          pages += 1;
        } while (cursor && pages < 500 && !cancelled);

        if (cancelled) return;
        const cache = new Map<DayKey, ArchiveEntry[]>();
        for (const entry of all) {
          const list = cache.get(entry.date);
          if (list) list.push(entry);
          else cache.set(entry.date, [entry]);
        }
        days.current = cache;
        setMemories(buildMemories(all));
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Stable identity, so the panel's effect only re-runs when the date changes.
  const loadDay = useCallback(async (date: DayKey): Promise<ArchiveEntry[]> => {
    return days.current.get(date) ?? []; // SWAP 2: return fetchDayEntries(date)
  }, []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { memories, state, retry, loadDay };
}