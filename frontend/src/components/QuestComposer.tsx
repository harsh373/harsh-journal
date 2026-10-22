import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPost, updatePost, uploadPostPhoto } from "../api/sideQuests.api";
import type { QuestPost, QuestPostPhoto } from "../api/sideQuests.api";
import { getJournalToday } from "../config/dates";
import { compressImage } from "../utility/compressImage";
import AutoGrowTextarea from "./AutoGrowTextarea";

interface Pending {
  file: File;
  url: string;
}

interface Props {
  questId: string;
  empty: boolean;
  onCreated: (post: QuestPost) => void;
}

/* The writing surface at the end of the story. Text and photos, one button. */
export default function QuestComposer({ questId, empty, onCreated }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Pending[]>([]);
  pendingRef.current = pending;

  useEffect(() => () => pendingRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const canSave = !saving && (text.trim().length > 0 || pending.length > 0);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPending((current) => [...current, ...next]);
  }

  function removePending(url: string) {
    URL.revokeObjectURL(url);
    setPending((current) => current.filter((item) => item.url !== url));
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    let created: QuestPost | null = null;
    const uploaded: QuestPostPhoto[] = [];
    let failed = false;
    try {
      created = await createPost(questId, getJournalToday());
      if (text.trim()) created = await updatePost(questId, created.id, { content: text.trim() });
      for (const item of pending) {
        try {
          uploaded.push(await uploadPostPhoto(questId, created.id, await compressImage(item.file)));
        } catch {
          failed = true;
        }
      }
    } catch {
      failed = true;
    }

    if (created) {
      onCreated({ ...created, photos: [...(created.photos ?? []), ...uploaded] });
      pending.forEach((item) => URL.revokeObjectURL(item.url));
      setPending([]);
      setText("");
      setError(failed ? "Added, but some photos didn't upload. Edit the entry to try again." : null);
    } else {
      setError("Couldn't save this entry. Your text is still here.");
    }
    setSaving(false);
  }

  return (
    <div
      className="rounded-card bg-elevated p-4 shadow-card sm:p-5"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submit();
      }}
    >
      <AutoGrowTextarea
        value={text}
        maxLength={20_000}
        placeholder={empty ? "Where does this begin?" : "Add to the story…"}
        onChange={(event) => setText(event.target.value)}
        className="type-journal w-full placeholder:text-tertiary focus:outline-none"
      />

      {pending.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pending.map((item) => (
            <div key={item.url} className="relative h-20 w-20 overflow-hidden rounded-[10px] bg-hover">
              <img src={item.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePending(item.url)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-[13px] text-secondary transition-colors hover:bg-hover hover:text-text lg:h-8">
          <Camera size={15} strokeWidth={1.75} />
          Photo
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSave}
          className="h-9 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:opacity-30 lg:h-8"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}
    </div>
  );
}