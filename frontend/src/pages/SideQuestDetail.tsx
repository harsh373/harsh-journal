import { ArrowLeft, Camera, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  deleteQuest,
  deleteQuestCover,
  fetchPosts,
  fetchQuest,
  updateQuest,
  uploadQuestCover,
} from "../api/sideQuests.api";
import type { QuestPatch, QuestPost, QuestStatus, SideQuest } from "../api/sideQuests.api";
import AutoGrowTextarea from "../components/AutoGrowTextarea";
import QuestComposer from "../components/QuestComposer";
import QuestEntry, { normalizePost } from "../components/QuestEntry";
import { QuestStatusBadge, QuestStatusPicker } from "../components/QuestStatus";
import { formatLongDate } from "../config/dates";
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

// Oldest first: the story reads top to bottom, and the composer waits at the end.
function sortPostsOldestFirst(posts: QuestPost[]): QuestPost[] {
  return [...posts].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function snapshot(quest: SideQuest): QuestPatch {
  return {
    title: quest.title,
    subtitle: quest.subtitle,
    challenge: quest.challenge,
    approach: quest.approach,
    status: quest.status,
    startDate: quest.startDate,
    endDate: quest.endDate,
  };
}

function withDefaults(quest: SideQuest): SideQuest {
  return {
    ...quest,
    title: quest.title ?? "",
    subtitle: quest.subtitle ?? "",
    challenge: quest.challenge ?? "",
    approach: quest.approach ?? "",
    startDate: quest.startDate ?? "",
    endDate: quest.endDate ?? "",
  };
}

const rise = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export default function SideQuestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [quest, setQuest] = useState<SideQuest | null>(null);
  const [posts, setPosts] = useState<QuestPost[]>([]);
  const [freshPostId, setFreshPostId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [titleHidden, setTitleHidden] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questRef = useRef<SideQuest | null>(null);
  const savedRef = useRef<QuestPatch>({});
  const timerRef = useRef<number | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const titleRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoadState("loading");
    Promise.all([fetchQuest(id), fetchPosts(id)])
      .then(([fetchedQuest, loadedPosts]) => {
        const loadedQuest = withDefaults(fetchedQuest);
        questRef.current = loadedQuest;
        savedRef.current = snapshot(loadedQuest);
        setQuest(loadedQuest);
        setPosts(sortPostsOldestFirst(loadedPosts.map(normalizePost)));
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setLoadState(status === 404 ? "not-found" : "error");
      });
  }, [id]);

  // Fade the title into the top bar once the page title scrolls away.
  useEffect(() => {
    const node = titleRef.current;
    if (!node || loadState !== "ready") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first) setTitleHidden(!first.isIntersecting);
      },
      { rootMargin: "-48px 0px 0px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadState]);

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
        const saved = withDefaults(await updateQuest(id, patch));
        questRef.current = saved;
        savedRef.current = snapshot(saved);
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
      const saved = withDefaults(await uploadQuestCover(id, await compressImage(file)));
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
      const saved = withDefaults(await deleteQuestCover(id));
      questRef.current = saved;
      setQuest(saved);
    } catch {
      setError("Couldn't remove the cover image.");
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

  function jumpToComposer() {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }), 350);
  }

  const timeline = useMemo(
    () => posts.map((post, index) => ({ post, showDate: index === 0 || posts[index - 1]?.date !== post.date })),
    [posts],
  );

  if (loadState === "not-found") return <Navigate to="/side-quests" replace />;

  if (loadState === "error") {
    return (
      <div className="mx-auto w-full max-w-[820px] px-5 py-14 sm:px-8 lg:px-12">
        <p className="text-[15px] text-alert">Couldn&apos;t load this quest.</p>
      </div>
    );
  }

  if (loadState === "loading" || !quest) {
    return <div className="mx-auto w-full max-w-[820px] px-5 py-14 sm:px-8 lg:px-12" aria-busy="true" />;
  }

  const hasDetails = Boolean(quest.challenge || quest.approach);
  const detailsShown = detailsOpen || editing;

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-24 sm:px-8 lg:px-12">
      <div className="sticky top-0 z-10 -mx-5 flex h-12 items-center justify-between gap-3 bg-bg/85 px-5 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to="/side-quests"
            className="flex h-9 shrink-0 items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-text"
          >
            <ArrowLeft size={15} strokeWidth={1.75} />
            Side Quests
          </Link>
          <span
            aria-hidden={!titleHidden}
            className={
              "truncate text-[13px] font-semibold transition-opacity duration-200 " +
              (titleHidden ? "opacity-100" : "opacity-0")
            }
          >
            {quest.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editing && (
            <button
              type="button"
              onClick={() => void handleDeleteQuest()}
              className="flex h-9 items-center gap-1.5 rounded-control px-3 text-[13px] text-alert transition-colors hover:bg-hover lg:h-8"
            >
              <Trash2 size={13} strokeWidth={1.75} />
              Delete quest
            </button>
          )}
          {!editing && (
            <button
              type="button"
              onClick={jumpToComposer}
              className="flex h-9 items-center gap-1.5 rounded-control px-3 text-[13px] font-medium text-text transition-colors hover:bg-hover lg:h-8"
            >
              <Plus size={14} strokeWidth={2} />
              Add
            </button>
          )}
          <button
            type="button"
            onClick={() => (editing ? void handleDone() : setEditing(true))}
            className={
              editing
                ? "h-9 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 lg:h-8"
                : "flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-[13px] font-medium text-text transition-colors duration-150 hover:bg-hover lg:h-8"
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

      {/* The cover is optional. Without one, the title simply starts the page. */}
      {(quest.coverImage || editing) && (
        <div
          style={rise(0)}
          className="group quest-rise relative mt-2 aspect-[16/9] overflow-hidden rounded-card bg-hover shadow-card sm:aspect-[2/1]"
        >
          {quest.coverImage ? (
            <img src={quest.coverImage.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[14px] text-tertiary">
              No cover image
            </div>
          )}
          {editing && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-100 transition-opacity duration-150 group-hover:bg-black/30 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
              <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-3 text-[13px] font-medium text-black">
                <Camera size={14} strokeWidth={2} />
                {coverUploading ? "Uploading…" : quest.coverImage ? "Change" : "Add cover"}
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
      )}

      <header ref={titleRef} style={rise(80)} className="quest-rise pb-8 pt-8 sm:pt-10">
        {editing ? (
          <input
            value={quest.title}
            maxLength={120}
            onChange={(event) => update({ title: event.target.value })}
            aria-label="Title"
            className="type-display w-full bg-transparent text-text focus:outline-none"
          />
        ) : (
          <h1 className="type-display">{quest.title}</h1>
        )}

        {editing ? (
          <input
            value={quest.subtitle}
            maxLength={160}
            placeholder="A short subtitle"
            onChange={(event) => update({ subtitle: event.target.value })}
            className="mt-2 w-full bg-transparent font-serif text-[1.125rem] text-secondary placeholder:text-tertiary focus:outline-none"
          />
        ) : (
          quest.subtitle && <p className="mt-2 font-serif text-[1.125rem] text-secondary">{quest.subtitle}</p>
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
                className="h-9 rounded-control border border-border bg-transparent px-2 text-[16px] text-text focus:border-secondary focus:outline-none sm:text-[13px]"
              />
              <span>–</span>
              <input
                type="date"
                value={quest.endDate}
                onChange={(event) => update({ endDate: event.target.value })}
                className="h-9 rounded-control border border-border bg-transparent px-2 text-[16px] text-text focus:border-secondary focus:outline-none sm:text-[13px]"
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

      {/* The challenge and approach are tucked behind one quiet toggle. */}
      {(hasDetails || editing) && (
        <section style={rise(140)} className="quest-rise mb-10">
          {!editing && (
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              className="flex h-9 items-center gap-1 text-[13px] text-secondary transition-colors hover:text-text"
            >
              <ChevronRight
                size={14}
                strokeWidth={2}
                className={"transition-transform duration-200 " + (detailsOpen ? "rotate-90" : "")}
              />
              Details
            </button>
          )}
          {detailsShown && (
            <div className="mt-3 space-y-8">
              <div>
                <h2 className="type-meta mb-2 font-medium">The challenge</h2>
                {editing ? (
                  <AutoGrowTextarea
                    value={quest.challenge}
                    maxLength={5000}
                    placeholder="What are you trying to do?"
                    onChange={(event) => update({ challenge: event.target.value })}
                    className="type-journal w-full placeholder:text-tertiary focus:outline-none"
                  />
                ) : (
                  <p className="type-journal whitespace-pre-wrap">{quest.challenge}</p>
                )}
              </div>
              <div>
                <h2 className="type-meta mb-2 font-medium">How it&apos;s going</h2>
                {editing ? (
                  <AutoGrowTextarea
                    value={quest.approach}
                    maxLength={5000}
                    placeholder="Your approach, and how it's going so far."
                    onChange={(event) => update({ approach: event.target.value })}
                    className="type-journal w-full placeholder:text-tertiary focus:outline-none"
                  />
                ) : (
                  <p className="type-journal whitespace-pre-wrap">{quest.approach}</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* One page: everything flows in a single column, with no per-entry chrome. */}
      <section aria-label="Story" style={rise(200)} className="quest-rise max-w-[40rem]">
        {timeline.map(({ post, showDate }) => (
          <QuestEntry
            key={post.id}
            questId={quest.id}
            post={post}
            showDate={showDate}
            fresh={post.id === freshPostId}
            onChange={(updated) =>
              setPosts((current) =>
                sortPostsOldestFirst(current.map((item) => (item.id === updated.id ? normalizePost(updated) : item))),
              )
            }
            onDelete={(postId) => setPosts((current) => current.filter((item) => item.id !== postId))}
          />
        ))}

        <div ref={composerRef}>
          <QuestComposer
            questId={quest.id}
            empty={posts.length === 0}
            onCreated={(post) => {
              setPosts((current) => sortPostsOldestFirst([...current, normalizePost(post)]));
              setFreshPostId(post.id);
            }}
          />
        </div>
      </section>

      {error && <p className="mt-4 text-[13px] text-alert">{error}</p>}
    </div>
  );
}