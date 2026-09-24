import type { DayKey } from "../config/dates";
import { api } from "./api";

export type TrackStatus = "active" | "paused" | "archived";

export type TrackIconKey =
  | "code"
  | "brain"
  | "leaf"
  | "dumbbell"
  | "book"
  | "music"
  | "rocket"
  | "pen"
  | "target"
  | "heart"
  | "briefcase"
  | "camera"
  | "languages"
  | "timer"
  | "sparkles"
  | "coffee";

export interface Track {
  id: string;
  title: string;
  subtitle: string;
  icon: TrackIconKey;
  unit: string;
  status: TrackStatus;
  createdAt: string;
  updatedAt: string;
}

// What the Tracks list needs: the track plus how the current month went.
export interface TrackWithMonth extends Track {
  monthDays: DayKey[];
  monthTotal: number;
}

export interface TrackPatch {
  title?: string;
  subtitle?: string;
  icon?: TrackIconKey;
  unit?: string;
  status?: TrackStatus;
}

export interface TrackLog {
  id: string;
  trackId: string;
  date: DayKey;
  note: string;
  amount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LogValues {
  date: DayKey;
  note: string;
  amount: number | null;
}

// A log together with the track it belongs to (used on the journal day page).
export interface DayTrackLog extends TrackLog {
  track: { id: string; title: string; icon: TrackIconKey; unit: string };
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// 3 -> "3 problems", 2.5 -> "2.5 min". With no unit it is just the number.
export function formatAmount(amount: number, unit: string): string {
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  return unit ? `${value} ${unit}` : value;
}

export async function fetchTracks(month: string): Promise<TrackWithMonth[]> {
  const { data } = await api.get<{ tracks: TrackWithMonth[] }>("/tracks", { params: { month } });
  return data.tracks;
}

export async function createTrack(): Promise<Track> {
  const { data } = await api.post<{ track: Track }>("/tracks");
  return data.track;
}

export async function fetchTrack(id: string): Promise<Track> {
  const { data } = await api.get<{ track: Track }>(`/tracks/${id}`);
  return data.track;
}

export async function updateTrack(id: string, patch: TrackPatch): Promise<Track> {
  const { data } = await api.put<{ track: Track }>(`/tracks/${id}`, patch);
  return data.track;
}

export async function deleteTrack(id: string): Promise<void> {
  await api.delete(`/tracks/${id}`);
}

export async function fetchLogs(trackId: string, month: string): Promise<TrackLog[]> {
  const { data } = await api.get<{ logs: TrackLog[] }>(`/tracks/${trackId}/logs`, { params: { month } });
  return data.logs;
}

export async function createLog(trackId: string, values: LogValues): Promise<TrackLog> {
  const { data } = await api.post<{ log: TrackLog }>(`/tracks/${trackId}/logs`, values);
  return data.log;
}

export async function updateLog(trackId: string, logId: string, values: LogValues): Promise<TrackLog> {
  const { data } = await api.put<{ log: TrackLog }>(`/tracks/${trackId}/logs/${logId}`, values);
  return data.log;
}

export async function deleteLog(trackId: string, logId: string): Promise<void> {
  await api.delete(`/tracks/${trackId}/logs/${logId}`);
}

export async function fetchLogsForDay(date: DayKey): Promise<DayTrackLog[]> {
  const { data } = await api.get<{ logs: DayTrackLog[] }>("/tracks/logs", { params: { date } });
  return data.logs;
}