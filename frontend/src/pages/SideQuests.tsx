import { Compass, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createQuest, fetchQuests } from "../api/sideQuests.api";
import type { SideQuest } from "../api/sideQuests.api";
import { QuestStatusBadge } from "../components/QuestStatus";
import { getJournalToday } from "../config/dates";

type LoadState = "loading" | "ready" | "error";

export default function SideQuests() {
  const navigate = useNavigate();
  const [quests, setQuests] = useState<SideQuest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchQuests()
      .then((data) => {
        setQuests(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const quest = await createQuest(getJournalToday());
      navigate(`/side-quests/${quest.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-6 sm:px-8 lg:px-12 lg:pt-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="type-display">Side Quests</h1>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:opacity-50"
        >
          <Plus size={15} strokeWidth={2} />
          New quest
        </button>
      </div>

      {loadState === "error" && <p className="mt-8 text-[15px] text-alert">Couldn&apos;t load your quests.</p>}

      {loadState === "ready" && quests.length === 0 && (
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-border py-14 text-center text-secondary">
          <Compass size={28} strokeWidth={1.5} />
          <p className="text-[15px]">No quests yet. Start one whenever you&apos;re ready.</p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {quests.map((quest) => (
          <Link key={quest.id} to={`/side-quests/${quest.id}`} className="group block">
            <div className="aspect-[16/10] overflow-hidden rounded-card border border-border bg-hover">
              {quest.coverImage ? (
                <img
                  src={quest.coverImage.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-tertiary">
                  <Compass size={28} strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="mt-3 px-0.5">
              <h2 className="truncate text-[16px] font-medium text-text">{quest.title}</h2>
              {quest.subtitle && <p className="mt-0.5 truncate text-[13px] text-secondary">{quest.subtitle}</p>}
              <div className="mt-2">
                <QuestStatusBadge status={quest.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}