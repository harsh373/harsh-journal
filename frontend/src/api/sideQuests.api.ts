import { api } from "./api";

export type QuestStatus = "active" | "completed" | "paused" | "abandoned";

export interface QuestCoverImage {
  url: string;
  publicId: string;
}

export interface SideQuest {
  id: string;
  title: string;
  subtitle: string;
  challenge: string;
  approach: string;
  coverImage: QuestCoverImage | null;
  status: QuestStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestPatch {
  title?: string;
  subtitle?: string;
  challenge?: string;
  approach?: string;
  status?: QuestStatus;
  startDate?: string;
  endDate?: string;
}

export interface QuestPostPhoto {
  id: string;
  url: string;
  publicId: string;
  caption?: string;
}

export interface QuestPost {
  id: string;
  sideQuestId: string;
  date: string;
  title: string;
  content: string;
  photos: QuestPostPhoto[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchQuests(): Promise<SideQuest[]> {
  const { data } = await api.get<{ quests: SideQuest[] }>("/side-quests");
  return data.quests;
}

export async function fetchQuest(id: string): Promise<SideQuest> {
  const { data } = await api.get<{ quest: SideQuest }>(`/side-quests/${id}`);
  return data.quest;
}

export async function createQuest(startDate: string): Promise<SideQuest> {
  const { data } = await api.post<{ quest: SideQuest }>("/side-quests", { startDate });
  return data.quest;
}

export async function updateQuest(id: string, patch: QuestPatch): Promise<SideQuest> {
  const { data } = await api.put<{ quest: SideQuest }>(`/side-quests/${id}`, patch);
  return data.quest;
}

export async function deleteQuest(id: string): Promise<void> {
  await api.delete(`/side-quests/${id}`);
}

export async function uploadQuestCover(id: string, file: File): Promise<SideQuest> {
  const formData = new FormData();
  formData.append("photo", file);
  const { data } = await api.post<{ quest: SideQuest }>(`/side-quests/${id}/cover`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.quest;
}

export async function deleteQuestCover(id: string): Promise<SideQuest> {
  const { data } = await api.delete<{ quest: SideQuest }>(`/side-quests/${id}/cover`);
  return data.quest;
}

export async function fetchPosts(questId: string): Promise<QuestPost[]> {
  const { data } = await api.get<{ posts: QuestPost[] }>(`/side-quests/${questId}/posts`);
  return data.posts;
}

export async function createPost(questId: string, date: string): Promise<QuestPost> {
  const { data } = await api.post<{ post: QuestPost }>(`/side-quests/${questId}/posts`, { date });
  return data.post;
}

export async function updatePost(
  questId: string,
  postId: string,
  patch: { title?: string; content?: string; date?: string },
): Promise<QuestPost> {
  const { data } = await api.put<{ post: QuestPost }>(`/side-quests/${questId}/posts/${postId}`, patch);
  return data.post;
}

export async function deletePost(questId: string, postId: string): Promise<void> {
  await api.delete(`/side-quests/${questId}/posts/${postId}`);
}

export async function uploadPostPhoto(questId: string, postId: string, file: File): Promise<QuestPostPhoto> {
  const formData = new FormData();
  formData.append("photo", file);
  const { data } = await api.post<{ photo: QuestPostPhoto }>(
    `/side-quests/${questId}/posts/${postId}/photos`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.photo;
}

export async function deletePostPhoto(questId: string, postId: string, photoId: string): Promise<void> {
  await api.delete(`/side-quests/${questId}/posts/${postId}/photos/${photoId}`);
}