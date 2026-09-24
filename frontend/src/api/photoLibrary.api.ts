import type { DayKey } from "../config/dates";
import { api } from "./api";

export type PhotoSource = "journal" | "side-quest";

export interface LibraryPhoto {
  id: string;
  url: string;
  caption?: string;
  date: DayKey;
  source: PhotoSource;
  sourceHref: string;
  sourceLabel: string;
}

export async function fetchPhotoLibraryPage(
  cursor: DayKey | null,
  source?: PhotoSource,
): Promise<{ photos: LibraryPhoto[]; nextCursor: DayKey | null }> {
  const { data } = await api.get<{ photos: LibraryPhoto[]; nextCursor: DayKey | null }>("/photo-library", {
    params: {
      ...(cursor ? { cursor } : {}),
      ...(source ? { source } : {}),
    },
  });
  return data;
}