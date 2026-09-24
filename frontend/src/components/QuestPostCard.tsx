import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { deletePost, deletePostPhoto, updatePost, uploadPostPhoto } from "../api/sideQuests.api";
import type { QuestPost, QuestPostPhoto } from "../api/sideQuests.api";
import { formatLongDate } from "../config/dates";
import { compressImage } from "../utility/compressImage";
import AutoGrowTextarea from "./AutoGrowTextarea";

const SAVE_DELAY_MS = 800;
const MAX_PHOTOS = 6;

interface QuestPostCardProps {
  questId: string;
  post: QuestPost;
  startInEditMode?: boolean;
  onChange: (post: QuestPost) => void;
  onDelete: (postId: string) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function QuestPostCard({ questId, post, startInEditMode, onChange, onDelete }: QuestPostCardProps) {
  const [editing, setEditing] = useState(Boolean(startInEditMode));
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef(post.title);
  const contentRef = useRef(post.content);
  const savedRef = useRef({ title: post.title, content: post.content });
  const timerRef = useRef<number | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    queueRef.current = queueRef.current.then(async () => {
      const patch: { title?: string; content?: string } = {};
      if (titleRef.current !== savedRef.current.title && titleRef.current.trim() !== "") {
        patch.title = titleRef.current;
      }
      if (contentRef.current !== savedRef.current.content) patch.content = contentRef.current;
      if (Object.keys(patch).length === 0) return;

      setSaveState("saving");
      try {
        const saved = await updatePost(questId, post.id, patch);
        savedRef.current = { title: saved.title, content: saved.content };
        onChange(saved);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    });
    return queueRef.current;
  }, [questId, post.id, onChange]);

  function scheduleSave() {
    setSaveState("idle");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  async function handleDone() {
    await flush();
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    try {
      await deletePost(questId, post.id);
      onDelete(post.id);
    } catch {
      setError("Couldn't delete this entry.");
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    const room = Math.max(MAX_PHOTOS - post.photos.length, 0);
    const toUpload = files.slice(0, room);
    if (toUpload.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of toUpload) {
        const compressed = await compressImage(file);
        const photo = await uploadPostPhoto(questId, post.id, compressed);
        onChange({ ...post, photos: [...post.photos, photo] });
      }
    } catch {
      setError("Couldn't upload one of the photos.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(photo: QuestPostPhoto) {
    const previous = post.photos;
    onChange({ ...post, photos: post.photos.filter((item) => item.id !== photo.id) });
    try {
      await deletePostPhoto(questId, post.id, photo.id);
    } catch {
      setError("Couldn't remove that photo.");
      onChange({ ...post, photos: previous });
    }
  }

  return (
    <article className="rounded-[18px] border border-border bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-secondary">{formatLongDate(post.date)}</p>
          {editing ? (
            <input
              value={title}
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value);
                titleRef.current = event.target.value;
                scheduleSave();
              }}
              placeholder="Entry title"
              className="mt-1 w-full bg-transparent text-[20px] font-medium text-text placeholder:text-tertiary focus:outline-none"
            />
          ) : (
            <h3 className="mt-1 text-[20px] font-medium text-text">{post.title}</h3>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {editing && saveState === "saving" && <span className="text-[12px] text-tertiary">Saving…</span>}
          {editing && saveState === "saved" && <span className="text-[12px] text-tertiary">Saved</span>}
          <button
            type="button"
            onClick={() => (editing ? void handleDone() : setEditing(true))}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-secondary transition-colors hover:bg-hover hover:text-text"
          >
            {editing ? (
              "Done"
            ) : (
              <>
                <Pencil size={12} strokeWidth={1.75} /> Edit
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            aria-label="Delete entry"
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-hover hover:text-alert"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        {editing ? (
          <AutoGrowTextarea
            value={content}
            maxLength={20_000}
            placeholder="What happened?"
            onChange={(event) => {
              setContent(event.target.value);
              contentRef.current = event.target.value;
              scheduleSave();
            }}
            className="text-[16px] leading-relaxed placeholder:text-tertiary"
          />
        ) : (
          post.content && <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-text">{post.content}</p>
        )}
      </div>

      {(post.photos.length > 0 || editing) && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {post.photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-[12px] border border-border bg-bg"
            >
              <img src={photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              {editing && (
                <button
                  type="button"
                  onClick={() => void handleDeletePhoto(photo)}
                  aria-label="Remove photo"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {editing && post.photos.length < MAX_PHOTOS && (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border text-tertiary transition-colors hover:bg-hover hover:text-text">
              <span className="text-[12px]">{uploading ? "Uploading…" : "Add photo"}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) void handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-[12px] text-alert">{error}</p>}
    </article>
  );
}