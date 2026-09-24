import type { JournalPhoto } from "./journal.api";
import type { DayKey } from "../config/dates";
import { api } from "./api";

export async function uploadPhoto(
  date: DayKey,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<JournalPhoto> {
  const formData = new FormData();
  formData.append("photo", file);

  const { data } = await api.post<{ photo: JournalPhoto }>(`/journal/${date}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data.photo;
}

export async function deletePhoto(date: DayKey, photoId: string): Promise<void> {
  await api.delete(`/journal/${date}/photos/${photoId}`);
}