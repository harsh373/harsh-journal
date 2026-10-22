import { api } from "./api";

export interface ThoughtSummary {
  id: string;
  title: string;
}

export interface Thought {
  id: string;
  title: string;
  body: string;
}

export async function fetchThoughts(): Promise<ThoughtSummary[]> {
  const { data } = await api.get<{ thoughts: ThoughtSummary[] }>("/thoughts");
  return data.thoughts;
}

export async function createThought(): Promise<Thought> {
  const { data } = await api.post<{ thought: Thought }>("/thoughts");
  return data.thought;
}

export async function fetchThought(id: string): Promise<Thought> {
  const { data } = await api.get<{ thought: Thought }>(`/thoughts/${id}`);
  return data.thought;
}

export async function saveThought(id: string, patch: { title?: string; body?: string }): Promise<void> {
  await api.patch(`/thoughts/${id}`, patch);
}

export async function reorderThoughts(ids: string[]): Promise<void> {
  await api.put("/thoughts/order", { ids });
}

export async function deleteThought(id: string): Promise<void> {
  await api.delete(`/thoughts/${id}`);
}