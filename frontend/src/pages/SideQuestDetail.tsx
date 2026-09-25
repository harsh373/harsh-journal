import { ArrowLeft, Camera, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  createPost,
  deleteQuest,
  deleteQuestCover,
  fetchPosts,
  fetchQuest,
  updateQuest,
  uploadQuestCover,
} from "../api/sideQuests.api";
import type { QuestPatch, QuestPost, QuestStatus, SideQuest } from "../api/sideQuests.api";
import AutoGrowTextarea from "../components/AutoGrowTextarea";
import QuestPostCard from "../components/QuestPostCard";
import { QuestStatusBadge, QuestStatusPicker } from "../components/QuestStatus";
import { formatLongDate, getJournalToday } from "../config/dates";
import { compressImage } from "../utility/compressImage";

const SAVE_DELAY_MS = 800;
const PATCH_FIELDS: (keyof QuestPatch)[] = [
  "title",
  "subtitle",
  "challenge",
  "approach",
  "status",
  "startDate",
  "endDate",
];

type LoadState = "loading" | "ready" | "error" | "not-found";

// Newest first: sort by entry date, falling back to createdAt when dates tie.
function sortPostsNewestFirst(posts: QuestPost[]): QuestPost[] {
  return [...posts].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function SideQuestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [quest, setQuest] = useState<SideQuest | null>(null);
  const [posts, setPosts] = useState<QuestPost[]>([]);
  const [freshPostId, setFreshPostId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [addingPost, setAddingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questRef = useRef<SideQuest | null>(null);
  const savedRef = useRef<QuestPatch>({});
  const timerRef = useRef<number | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!id) return;
    setLoadState("loading");
    Promise.all([fetchQuest(id), fetchPosts(id)])
      .then(([loadedQuest, loadedPosts]) => {
        questRef.current = loadedQuest;
        savedRef.current = {
          title: loadedQuest.title,
          subtitle: loadedQuest.subtitle,
          challenge: loadedQuest.challenge,
          approach: loadedQuest.approach,
          status: loadedQuest.status,
          startDate: loadedQuest.startDate,
          endDate: loadedQuest.endDate,
        };
        setQuest(loadedQuest);
        setPosts(sortPostsNewestFirst(loadedPosts));
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setLoadState(status === 404 ? "not-found" : "error");
      });
  }, [id]);

  const flush = useCallback(() => {
    if (!id) return Promise.resolve();
    window.clearTimeout(timerRef.current);

    queueRef.current = queueRef.current.then(async () => {
      const current = questRef.current;
      if (!current) return;

      const patch: QuestPatch = {};
      for (const field of PATCH_FIELDS) {
        if (current[field] !== savedRef.current[field]) {
          if (field === "title" && String(current.title).trim() === "") continue;
          (patch as Record<string, unknown>)[field] = current[field];
        }
      }
      if (Object.keys(patch).length === 0) return;

      try {
        const saved = await updateQuest(id, patch);
        questRef.current = saved;
        savedRef.current = {
          title: saved.title,
          subtitle: saved.subtitle,
          challenge: saved.challenge,
          approach: saved.approach,
          status: saved.status,
          startDate: saved.startDate,
          endDate: saved.endDate,
        };
        setQuest(saved);
      } catch {
        setError("Couldn't save your changes.");
      }
    });
    return queueRef.current;
  }, [id]);

  function update(patch: Partial<SideQuest>) {
    if (!quest) return;
    const next = { ...quest, ...patch };
    questRef.current = next;
    setQuest(next);

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  async function handleDone() {
    await flush();
    setEditing(false);
  }

   async function handleCoverChange(fileList: FileList | null) {
    if (!fileList || !id) return;
    const file = fileList.item(0);
    if (!file || !file.type.startsWith("image/")) return;

    setCoverUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const saved = await uploadQuestCover(id, compressed);
      questRef.current = saved;
      setQuest(saved);
    } catch {
      setError("Couldn't upload the cover image.");
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleRemoveCover() {
    if (!id) return;
    try {
      const saved = await deleteQuestCover(id);
      questRef.current = saved;
      setQuest(saved);
    } catch {
      setError("Couldn't remove the cover image.");
    }
  }

  async function handleAddPost() {
    if (!id || addingPost) return;
    setAddingPost(true);
    try {
      const post = await createPost(id, getJournalToday());
      setPosts((current) => sortPostsNewestFirst([post, ...current]));
      setFreshPostId(post.id);
    } catch {
      setError("Couldn't start a new entry.");
    } finally {
      setAddingPost(false);
    }
  }

  async function handleDeleteQuest() {
    if (!id) return;
    if (!confirm("Delete this entire quest, including all its entries and photos? This can't be undone.")) return;
    try {
      await deleteQuest(id);
      navigate("/side-quests");
    } catch {
      setError("Couldn't delete this quest.");
    }
  }

  if (loadState === "not-found") return <Navigate to="/side-quests" replace />;

  if (loadState === "loading" || !quest) {
    return <div className="mx-auto w-full max-w-[820px] px-6 py-14 lg:px-12" aria-busy="true" />;
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto w-full max-w-[820px] px-6 py-14 lg:px-12">
        <p className="text-[15px] text-alert">Couldn&apos;t load this quest.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pb-24 lg:px-12">
      <div className="sticky top-0 z-10 -mx-6 flex h-14 items-center justify-between gap-3 bg-bg/80 px-6 backdrop-blur-xl lg:-mx-12 lg:px-12">
        <Link
          to="/side-quests"
          className="flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-text"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          Side Quests
        </Link>
        <div className="flex items-center gap-2">
          {editing && (
            <button
              type="button"
              onClick={() => void handleDeleteQuest()}
              className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] text-alert transition-colors hover:bg-hover"
            >
              <Trash2 size={13} strokeWidth={1.75} />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => (editing ? void handleDone() : setEditing(true))}
            className={
              editing
                ? "h-8 rounded-lg bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85"
                : "flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] text-text transition-colors duration-150 hover:bg-hover"
            }
          >
            {editing ? (
              "Done"
            ) : (
              <>
                <Pencil size={13} strokeWidth={1.75} /> Edit
              </>
            )}
          </button>
        </div>
      </div>

      <div className="group relative mt-4 aspect-[16/9] overflow-hidden rounded-[18px] border border-border bg-hover">
        {quest.coverImage ? (
          <img src={quest.coverImage.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-tertiary">
            {editing ? "Add a cover image" : ""}
          </div>
        )}

        {editing && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-opacity duration-150 group-hover:bg-black/30 group-hover:opacity-100">
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-3 text-[13px] font-medium text-black">
              <Camera size={14} strokeWidth={2} />
              {coverUploading ? "Uploading…" : "Change"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleCoverChange(event.target.files)}
              />
            </label>
            {quest.coverImage && (
              <button
                type="button"
                onClick={() => void handleRemoveCover()}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-black"
                aria-label="Remove cover"
              >
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      <header className="pb-8 pt-6">
        {editing ? (
          <input
            value={quest.title}
            maxLength={120}
            onChange={(event) => update({ title: event.target.value })}
            className="w-full bg-transparent text-4xl font-light tracking-tight text-text focus:outline-none lg:text-5xl"
          />
        ) : (
          <h1 className="text-4xl font-light tracking-tight lg:text-5xl">{quest.title}</h1>
        )}

        {editing ? (
          <input
            value={quest.subtitle}
            maxLength={160}
            placeholder="A short subtitle"
            onChange={(event) => update({ subtitle: event.target.value })}
            className="mt-2 w-full bg-transparent text-[17px] text-secondary placeholder:text-tertiary focus:outline-none"
          />
        ) : (
          quest.subtitle && <p className="mt-2 text-[17px] text-secondary">{quest.subtitle}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          {editing ? (
            <QuestStatusPicker value={quest.status} onChange={(status: QuestStatus) => update({ status })} />
          ) : (
            <QuestStatusBadge status={quest.status} />
          )}

          {editing ? (
            <div className="flex items-center gap-2 text-[13px] text-secondary">
              <input
                type="date"
                value={quest.startDate}
                onChange={(event) => update({ startDate: event.target.value })}
                className="rounded-md border border-border bg-transparent px-2 py-1 text-[13px] focus:outline-none"
              />
              <span>–</span>
              <input
                type="date"
                value={quest.endDate}
                onChange={(event) => update({ endDate: event.target.value })}
                className="rounded-md border border-border bg-transparent px-2 py-1 text-[13px] focus:outline-none"
              />
            </div>
          ) : (
            quest.startDate && (
              <span className="text-[13px] text-secondary">
                Started {formatLongDate(quest.startDate)}
                {quest.endDate && ` · Ended ${formatLongDate(quest.endDate)}`}
              </span>
            )
          )}
        </div>
      </header>

      {(editing || quest.challenge || quest.approach) && (
        <section className="mb-10 overflow-hidden rounded-[18px] border border-border bg-surface shadow-card">
          <div className="px-6 py-5">
            <h2 className="text-[13px] font-medium text-secondary">The challenge</h2>
            {editing ? (
              <AutoGrowTextarea
                value={quest.challenge}
                maxLength={5000}
                placeholder="What are you trying to do?"
                onChange={(event) => update({ challenge: event.target.value })}
                className="mt-2 text-[16px] leading-relaxed placeholder:text-tertiary"
              />
            ) : (
              quest.challenge && (
                <p className="mt-2 whitespace-pre-wrap text-[16px] leading-relaxed">{quest.challenge}</p>
              )
            )}
          </div>
          <div className="border-t border-border px-6 py-5">
            <h2 className="text-[13px] font-medium text-secondary">How it&apos;s going</h2>
            {editing ? (
              <AutoGrowTextarea
                value={quest.approach}
                maxLength={5000}
                placeholder="Your approach, and how it's going so far."
                onChange={(event) => update({ approach: event.target.value })}
                className="mt-2 text-[16px] leading-relaxed placeholder:text-tertiary"
              />
            ) : (
              quest.approach && (
                <p className="mt-2 whitespace-pre-wrap text-[16px] leading-relaxed">{quest.approach}</p>
              )
            )}
          </div>
        </section>
      )}

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-secondary">The story</h2>
        <button
          type="button"
          onClick={() => void handleAddPost()}
          disabled={addingPost}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] text-text transition-colors hover:bg-hover disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2} />
          Add entry
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-border px-6 py-10 text-center text-secondary">
          <p className="text-[15px]">No entries yet. Add the first one.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <QuestPostCard
              key={post.id}
              questId={quest.id}
              post={post}
              startInEditMode={post.id === freshPostId}
              onChange={(updated) =>
                setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
              }
              onDelete={(postId) => setPosts((current) => current.filter((item) => item.id !== postId))}
            />
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-[13px] text-alert">{error}</p>}
    </div>
  );
}