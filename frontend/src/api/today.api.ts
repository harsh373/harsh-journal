import { api } from "./api";

export interface TodayItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TodayPlan {
  date: string;
  items: TodayItem[];
  createdAt: string;
  updatedAt: string;
}

// null means nothing has been added to today yet.
export async function fetchTodayPlan(date: string): Promise<TodayPlan | null> {
  const { data } = await api.get<{ plan: TodayPlan | null }>(`/today/${date}`);
  return data.plan;
}

export async function addTodayItem(date: string, text: string): Promise<TodayPlan> {
  const { data } = await api.post<{ plan: TodayPlan }>(`/today/${date}/items`, { text });
  return data.plan;
}

export async function updateTodayItem(
  date: string,
  itemId: string,
  patch: { text?: string; completed?: boolean },
): Promise<TodayPlan> {
  const { data } = await api.put<{ plan: TodayPlan }>(`/today/${date}/items/${itemId}`, patch);
  return data.plan;
}

export async function deleteTodayItem(date: string, itemId: string): Promise<TodayPlan> {
  const { data } = await api.delete<{ plan: TodayPlan }>(`/today/${date}/items/${itemId}`);
  return data.plan;
}