import { api } from "./api";

export type CircleName = "concern" | "influence";

export interface CircleItem {
  id: string;
  text: string;
  circle: CircleName;
  order: number;
}

export async function fetchCircleItems(): Promise<CircleItem[]> {
  const { data } = await api.get<{ items: CircleItem[] }>("/circle");
  return data.items;
}

export async function createCircleItem(text: string, circle: CircleName): Promise<CircleItem> {
  const { data } = await api.post<{ item: CircleItem }>("/circle", { text, circle });
  return data.item;
}

export async function updateCircleItem(
  id: string,
  patch: { text?: string; circle?: CircleName },
): Promise<CircleItem> {
  const { data } = await api.patch<{ item: CircleItem }>(`/circle/${id}`, patch);
  return data.item;
}

export async function deleteCircleItem(id: string): Promise<void> {
  await api.delete(`/circle/${id}`);
}