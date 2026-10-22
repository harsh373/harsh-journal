import { Camera, Pencil, X } from "lucide-react";
import { useState } from "react";
import { deletePost, deletePostPhoto, updatePost, uploadPostPhoto } from "../api/sideQuests.api";
import type { QuestPost, QuestPostPhoto } from "../api/sideQuests.api";
import { compressImage } from "../utility/compressImage";
import AutoGrowTextarea from "./AutoGrowTextarea";

/* Older or partial records may lack fields. Every post passes through this before it reaches state. */
export function normalizePost(post: QuestPost): QuestPost {
  return {
    ...post,
    title: post.title ?? "",
    content: post.content ?? "",
    photos: post.photos ?? [],
    date: post.date || (post.createdAt ?? "").slice(0, 10),
  };
}

// Placeholder titles the app may have generated are not worth showing.
function isPlaceholderTitle(title: string): boolean {
  return !title.trim() || /^(untitled|new entry|entry)\b/i.test(title.trim());
}

export function entryDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/* Photos adapt to how many there are: one is shown large, several sit in a quiet grid. */
export function EntryPhotos({
  photos,
  onRemove,
}: {
  photos: QuestPostPhoto[];
  onRemove?: (photo: QuestPostPhoto) => void;
}) {
  if (photos.length === 0) return null;
  const single = photos.length === 1;
  return (
    <div className={single ? "mt-5" : "mt-5 grid grid-cols-2 gap-2"}>
      {photos.map((photo, index) => {
        const wide = !single && photos.length % 2 === 1 && index === 0;
        return (
          <figure key={photo.id} className={"group/photo relative " + (wide ? "col-span-2" : "")}>
            <img
              src={photo.url}
              alt={photo.caption ?? ""}
              loading="lazy"
              className={
                "w-full rounded-[12px] bg-hover object-cover " +
                (single ? "max-h-[36rem]" : wide ? "aspect-[16/10]" : "aspect-[4/3]")
              }
            />
            {photo.caption && <figcaption className="type-meta mt-2 px-0.5">{photo.caption}</figcaption>}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(photo)}
                aria-label="Remove photo"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75"
              >
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </figure>
        );
      })}
    </div>
  );
}

interface Props {
  questId: string;
  post: QuestPost;
  fresh?: boolean;
  showDate?: boolean;
  onChange: (post: QuestPost) => void;
  onDelete: (postId: string) => void;
}

export default function QuestEntry({ questId, post: rawPost, fresh, showDate = true, onChange, onDelete }: Props) {
  const post = normalizePost(rawPost);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [date, setDate] = useState(post.date);
  const [titleDraft, setTitleDraft] = useState(post.title);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(post.content);
    setDate(post.date);
    setTitleDraft(post.title);
    setError(null);
    setConfirmDelete(false);
    setEditing(true);
  }

  async function save() {
    if (!draft.trim() && post.photos.length === 0) {
      setError("Add some text or a photo, or delete this entry.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const patch: { title?: string; content?: string; date?: string } = {};
      if (titleDraft.trim() && titleDraft !== post.title) patch.title = titleDraft;
      if (draft !== post.content) patch.content = draft;
      if (date && date !== post.date) patch.date = date;
      if (Object.keys(patch).length > 0) {
        const updated = await updatePost(questId, post.id, patch);
        onChange({ ...post, ...updated, photos: updated.photos ?? post.photos });
      }
      setEditing(false);
    } catch {
      setError("Couldn't save this entry.");
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      let photos = [...post.photos];
      for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/")) continue;
        const photo = await uploadPostPhoto(questId, post.id, await compressImage(file));
        photos = [...photos, photo];
        onChange({ ...post, photos });
      }
    } catch {
      setError("Couldn't upload that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(photo: QuestPostPhoto) {
    setError(null);
    try {
      await deletePostPhoto(questId, post.id, photo.id);
      onChange({ ...post, photos: post.photos.filter((item) => item.id !== photo.id) });
    } catch {
      setError("Couldn't remove that photo.");
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deletePost(questId, post.id);
      onDelete(post.id);
    } catch {
      setError("Couldn't delete this entry.");
      setBusy(false);
    }
  }

  return (
    <article className={"group relative pb-14 " + (fresh ? "quest-rise" : "")}>
      {showDate && (
        <time dateTime={post.date} className="type-meta mb-3 block tabular-nums text-tertiary">
          {entryDayLabel(post.date)}
        </time>
      )}

      {editing ? (
        <div>
          <input
            value={titleDraft}
            maxLength={200}
            placeholder="Title (optional)"
            onChange={(event) => setTitleDraft(event.target.value)}
            className="mb-2 w-full bg-transparent font-serif text-[1.375rem] font-medium leading-snug tracking-tight text-text placeholder:text-tertiary focus:outline-none"
          />
          <AutoGrowTextarea
            value={draft}
            maxLength={20_000}
            placeholder="Write something…"
            onChange={(event) => setDraft(event.target.value)}
            className="type-journal w-full placeholder:text-tertiary focus:outline-none"
          />
          <EntryPhotos photos={post.photos} onRemove={(photo) => void removePhoto(photo)} />

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-control border border-border px-3 text-[13px] font-medium text-text transition-colors hover:bg-hover lg:h-8">
              <Camera size={14} strokeWidth={1.75} />
              Add photo
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addPhotos(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Date"
              className="h-9 rounded-control border border-border bg-transparent px-2 text-[16px] text-text focus:border-secondary focus:outline-none sm:text-[13px] lg:h-8"
            />
            <div className="ml-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={() => void remove()}
                    disabled={busy}
                    className="h-9 rounded-control px-3 text-[13px] font-medium text-alert transition-colors hover:bg-hover disabled:opacity-50 lg:h-8"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="h-9 rounded-control px-3 text-[13px] text-secondary transition-colors hover:bg-hover lg:h-8"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="h-9 rounded-control px-3 text-[13px] text-alert transition-colors hover:bg-hover lg:h-8"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={busy}
                    className="h-9 rounded-control px-3 text-[13px] text-secondary transition-colors hover:bg-hover lg:h-8"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy}
                    className="h-9 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50 lg:h-8"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}
        </div>
      ) : (
        <div className="relative">
          {!isPlaceholderTitle(post.title) && (
            <h3 className="mb-2 font-serif text-[1.375rem] font-medium leading-snug tracking-tight">{post.title}</h3>
          )}
          {post.content && <p className="type-journal whitespace-pre-wrap">{post.content}</p>}
          <EntryPhotos photos={post.photos} />
          <button
            type="button"
            onClick={startEdit}
            aria-label="Edit entry"
            className="absolute -right-2 -top-1 flex h-9 w-9 items-center justify-center rounded-full text-tertiary opacity-100 transition-opacity hover:bg-hover hover:text-text focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </article>
  );
}