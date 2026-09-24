import type { DayKey } from "../config/dates";
import { api } from "./api";

export interface SettingsFields {
  countdownDate: DayKey | "";
  countdownLabel: string;
}

export async function fetchSettings(): Promise<SettingsFields> {
  const { data } = await api.get<{ settings: SettingsFields }>("/settings");
  return data.settings;
}

export async function saveSettings(patch: Partial<SettingsFields>): Promise<SettingsFields> {
  const { data } = await api.put<{ settings: SettingsFields }>("/settings", patch);
  return data.settings;
}