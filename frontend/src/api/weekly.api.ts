import { api } from "./api";

export interface WeeklyItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface WeeklyPlan {
  weekStart: string;
  weekEnd: string;
  items: WeeklyItem[];
  createdAt: string;
  updatedAt: string;
}

// null means nothing has been added to this week yet.
export async function fetchWeeklyPlan(weekStart: string): Promise<WeeklyPlan | null> {
  const { data } = await api.get<{ plan: WeeklyPlan | null }>(`/weekly/${weekStart}`);
  return data.plan;
}

export async function addWeeklyItem(weekStart: string, text: string): Promise<WeeklyPlan> {
  const { data } = await api.post<{ plan: WeeklyPlan }>(`/weekly/${weekStart}/items`, { text });
  return data.plan;
}

export async function updateWeeklyItem(
  weekStart: string,
  itemId: string,
  patch: { text?: string; completed?: boolean },
): Promise<WeeklyPlan> {
  const { data } = await api.put<{ plan: WeeklyPlan }>(`/weekly/${weekStart}/items/${itemId}`, patch);
  return data.plan;
}

export async function deleteWeeklyItem(weekStart: string, itemId: string): Promise<WeeklyPlan> {
  const { data } = await api.delete<{ plan: WeeklyPlan }>(`/weekly/${weekStart}/items/${itemId}`);
  return data.plan;
}