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
    <div className="mx-auto w-full max-w-[1100px] px-6 pb-24 pt-8 lg:px-12 lg:pt-14">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-light tracking-tight">Side Quests</h1>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:opacity-50"
        >
          <Plus size={15} strokeWidth={2} />
          New quest
        </button>
      </div>

      {loadState === "error" && <p className="mt-8 text-[15px] text-alert">Couldn&apos;t load your quests.</p>}

      {loadState === "ready" && quests.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border py-16 text-center text-secondary">
          <Compass size={28} strokeWidth={1.5} />
          <p className="text-[15px]">No quests yet. Start one whenever you&apos;re ready.</p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {quests.map((quest) => (
          <Link
            key={quest.id}
            to={`/side-quests/${quest.id}`}
            className="group overflow-hidden rounded-[18px] border border-border bg-surface shadow-card transition-transform duration-150 hover:-translate-y-0.5"
          >
            <div className="aspect-[16/10] overflow-hidden bg-hover">
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
            <div className="p-4">
              <h2 className="truncate text-[16px] font-medium text-text">{quest.title}</h2>
              {quest.subtitle && <p className="mt-0.5 truncate text-[13px] text-secondary">{quest.subtitle}</p>}
              <div className="mt-3">
                <QuestStatusBadge status={quest.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}