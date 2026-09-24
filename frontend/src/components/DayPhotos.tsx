import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { deletePhoto, uploadPhoto } from "../api/photos.api";
import type { JournalPhoto } from "../api/journal.api";
import type { DayKey } from "../config/dates";
import { compressImage } from "../utility/compressImage";

const MAX_PHOTOS = 8;

interface PendingUpload {
  key: string;
  previewUrl: string;
}

interface DayPhotosProps {
  day: DayKey;
  photos: JournalPhoto[];
  editing: boolean;
  onPhotosChange: (photos: JournalPhoto[]) => void;
}

export default function DayPhotos({ day, photos, editing, onPhotosChange }: DayPhotosProps) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAddMore = photos.length + pending.length < MAX_PHOTOS;

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    setError(null);
    const room = Math.max(MAX_PHOTOS - (photos.length + pending.length), 0);
    const toUpload = files.slice(0, room);

    for (const file of toUpload) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);
      setPending((current) => [...current, { key, previewUrl }]);

      try {
        const compressed = await compressImage(file);
        const photo = await uploadPhoto(day, compressed);
        onPhotosChange([...photos, photo]);
      } catch {
        setError("Couldn't upload one of the photos. Try again.");
      } finally {
        setPending((current) => {
          const item = current.find((entry) => entry.key === key);
          if (item) URL.revokeObjectURL(item.previewUrl);
          return current.filter((entry) => entry.key !== key);
        });
      }
    }
  }

  async function handleDelete(photo: JournalPhoto) {
    const previous = photos;
    onPhotosChange(photos.filter((item) => item.id !== photo.id));
    try {
      await deletePhoto(day, photo.id);
    } catch {
      setError("Couldn't remove that photo. Try again.");
      onPhotosChange(previous);
    }
  }

  if (!editing && photos.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo) => (
          <figure
            key={photo.id}
            className="group relative aspect-[4/3] overflow-hidden rounded-[18px] border border-border bg-surface shadow-card"
          >
            <img src={photo.url} alt={photo.caption ?? ""} className="h-full w-full object-cover" loading="lazy" />
            {editing && (
              <button
                type="button"
                onClick={() => void handleDelete(photo)}
                aria-label="Remove photo"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 hover:bg-black/60 group-hover:opacity-100"
              >
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </figure>
        ))}

        {pending.map((item) => (
          <div key={item.key} className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-border bg-surface">
            <img src={item.previewUrl} alt="" className="h-full w-full object-cover opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Loader2 size={20} className="animate-spin text-white" strokeWidth={2} />
            </div>
          </div>
        ))}

        {editing && canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void handleFiles(event.dataTransfer.files);
            }}
            className={
              "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed text-secondary transition-colors duration-150 " +
              (dragOver ? "border-text bg-hover text-text" : "border-border hover:bg-hover hover:text-text")
            }
          >
            <ImagePlus size={22} strokeWidth={1.5} />
            <span className="text-[13px]">Add photo</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {error && <p className="mt-2 text-[13px] text-alert">{error}</p>}
    </section>
  );
}