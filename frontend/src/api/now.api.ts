import { api } from "./api";

export interface TimeTravelEntry {
  id: string;
  date: string;
  futureThought: string;
  presentState?: string;
  createdAt: string;
}

export async function createTimeTravelEntry(date: string, futureThought: string): Promise<TimeTravelEntry> {
  const { data } = await api.post<{ entry: TimeTravelEntry }>("/now/entries", { date, futureThought });
  return data.entry;
}

export async function attachPresentState(entryId: string, presentState: string): Promise<TimeTravelEntry> {
  const { data } = await api.patch<{ entry: TimeTravelEntry }>(`/now/entries/${entryId}`, { presentState });
  return data.entry;
}

export async function fetchTodayEscapeCount(date: string): Promise<number> {
  const { data } = await api.get<{ date: string; count: number }>("/now/today", { params: { date } });
  return data.count;
}

export interface RecentDay {
  date: string;
  count: number;
}

export async function fetchRecentEscapes(): Promise<RecentDay[]> {
  const { data } = await api.get<{ days: RecentDay[] }>("/now/recent");
  return data.days;
}