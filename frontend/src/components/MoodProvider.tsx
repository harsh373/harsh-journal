import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { fetchMonthMoods } from "../api/journal.api";
import type { Mood } from "../api/journal.api";
import type { DayKey } from "../config/dates";

interface MoodContextValue {
  moods: Record<DayKey, Mood>;
  loadMonth: (year: number, month: number) => void;
  setDayMood: (day: DayKey, mood: Mood) => void;
}

const MoodContext = createContext<MoodContextValue | null>(null);

// Holds the mood of every day the calendar has shown. The editor updates it the moment a
// save lands, so the calendar dot appears without reloading anything.
export function MoodProvider({ children }: { children: ReactNode }) {
  const [moods, setMoods] = useState<Record<DayKey, Mood>>({});
  const requested = useRef(new Set<string>());

  const loadMonth = useCallback((year: number, month: number) => {
    const key = `${year}-${month}`;
    if (requested.current.has(key)) return;
    requested.current.add(key);

    fetchMonthMoods(year, month)
      .then((loaded) => setMoods((current) => ({ ...loaded, ...current })))
      .catch(() => requested.current.delete(key));
  }, []);

  const setDayMood = useCallback((day: DayKey, mood: Mood) => {
    setMoods((current) => (current[day] === mood ? current : { ...current, [day]: mood }));
  }, []);

  const value = useMemo(() => ({ moods, loadMonth, setDayMood }), [moods, loadMonth, setDayMood]);

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

export function useMoods(): MoodContextValue {
  const context = useContext(MoodContext);
  if (!context) throw new Error("useMoods must be used inside MoodProvider");
  return context;
}