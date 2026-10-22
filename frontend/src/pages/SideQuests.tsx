import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createQuest, fetchPosts, fetchQuests, updateQuest } from "../api/sideQuests.api";
import type { QuestPost, SideQuest } from "../api/sideQuests.api";
import { normalizePost } from "../components/QuestEntry";
import { QuestStatusBadge } from "../components/QuestStatus";
import { formatLongDate, getJournalToday } from "../config/dates";

type LoadState = "loading" | "ready" | "error";

function latestPost(posts: QuestPost[] | undefined): QuestPost | null {
  if (!posts || posts.length === 0) return null;
  return posts.reduce((best, post) => {
    const diff = post.date.localeCompare(best.date);
    if (diff !== 0) return diff > 0 ? post : best;
    return new Date(post.createdAt) > new Date(best.createdAt) ? post : best;
  });
}

function lastActivity(quest: SideQuest, latest: QuestPost | null): string {
  return latest?.date || (quest.updatedAt || quest.createdAt || "").slice(0, 10);
}

export default function SideQuests() {
  const navigate = useNavigate();
  const [quests, setQuests] = useState<SideQuest[]>([]);
  const [postsByQuest, setPostsByQuest] = useState<Record<string, QuestPost[]>>({});
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuests()
      .then(async (data) => {
        const results = await Promise.allSettled(data.map((quest) => fetchPosts(quest.id)));
        if (cancelled) return;
        const map: Record<string, QuestPost[]> = {};
        data.forEach((quest, index) => {
          const result = results[index];
          if (result && result.status === "fulfilled") map[quest.id] = result.value.map(normalizePost);
        });
        setQuests(data);
        setPostsByQuest(map);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (naming) inputRef.current?.focus();
  }, [naming]);

  const ordered = useMemo(
    () =>
      quests
        .map((quest) => {
          const latest = latestPost(postsByQuest[quest.id]);
          return { quest, latest, activity: lastActivity(quest, latest) };
        })
        .sort((a, b) => b.activity.localeCompare(a.activity)),
    [quests, postsByQuest],
  );

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const quest = await createQuest(getJournalToday());
      const title = name.trim();
      if (title) await updateQuest(quest.id, { title });
      navigate(`/side-quests/${quest.id}`);
    } catch {
      setCreateError("Couldn't start a new quest.");
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-6 sm:px-8 lg:px-12 lg:pt-12">
      <div className="quest-rise flex items-end justify-between gap-4">
        <div>
          <h1 className="type-display">Side Quests</h1>
          <p className="mt-2 font-serif text-[1.0625rem] text-secondary">Things you chose to pursue.</p>
        </div>
        {!naming && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85"
          >
            <Plus size={15} strokeWidth={2} />
            New quest
          </button>
        )}
      </div>

      {naming && (
        <form onSubmit={(event) => void handleCreate(event)} className="quest-rise mt-8 flex items-center gap-2">
          <input
            ref={inputRef}
            value={name}
            maxLength={120}
            placeholder="What are you setting out to do?"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setNaming(false);
                setName("");
              }
            }}
            className="h-11 min-w-0 flex-1 rounded-control border border-border bg-elevated px-3.5 text-[16px] text-text placeholder:text-tertiary focus:border-secondary focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="h-11 shrink-0 rounded-control bg-text px-5 text-[13px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {creating ? "Starting…" : "Start"}
          </button>
        </form>
      )}
      {createError && <p className="mt-3 text-[13px] text-alert">{createError}</p>}

      {loadState === "error" && <p className="mt-10 text-[15px] text-alert">Couldn&apos;t load your quests.</p>}

      {loadState === "ready" && quests.length === 0 && !naming && (
        <p className="mt-16 max-w-sm font-serif text-[1.125rem] leading-relaxed text-secondary">
          Nothing here yet. When you start something, it gets a page of its own.
        </p>
      )}

      {/* A columned flow: tiles keep their natural height, so image and text-only quests sit together. */}
      <div className="mt-10 columns-1 gap-x-6 sm:columns-2 lg:mt-12 lg:gap-x-8">
        {ordered.map(({ quest, latest, activity }, index) => {
          const excerpt = latest?.content.trim() || quest.subtitle || quest.challenge || "";
          const meta = activity ? `Updated ${formatLongDate(activity)}` : "";
          const delay = { "--d": `${Math.min(index, 6) * 50}ms` } as CSSProperties;
          return (
            <Link
              key={quest.id}
              to={`/side-quests/${quest.id}`}
              style={delay}
              className="group quest-rise mb-10 block break-inside-avoid rounded-card"
            >
              {quest.coverImage ? (
                <>
                  <div className="aspect-[4/3] overflow-hidden rounded-card bg-hover shadow-card">
                    <img
                      src={quest.coverImage.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
                    />
                  </div>
                  <div className="mt-4 px-0.5">
                    <h2 className="text-[1.1875rem] font-semibold leading-snug tracking-tight">{quest.title}</h2>
                    {excerpt && (
                      <p className="mt-1.5 line-clamp-2 font-serif text-[15px] leading-relaxed text-secondary">
                        {excerpt}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="type-meta text-tertiary">{meta}</p>
                      {quest.status && <QuestStatusBadge status={quest.status} />}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-card bg-elevated p-6 shadow-card transition-transform duration-300 ease-out group-hover:-translate-y-0.5 sm:p-7">
                  <h2 className="text-[1.375rem] font-semibold leading-snug tracking-tight">{quest.title}</h2>
                  {excerpt && (
                    <p className="mt-3 line-clamp-5 font-serif text-[1.0625rem] leading-[1.65] text-secondary">
                      {excerpt}
                    </p>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="type-meta text-tertiary">{meta}</p>
                    {quest.status && <QuestStatusBadge status={quest.status} />}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}