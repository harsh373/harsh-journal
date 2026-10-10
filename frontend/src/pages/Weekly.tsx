import { Check, ListChecks, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addWeeklyItem,
  deleteWeeklyItem,
  fetchWeeklyPlan,
  updateWeeklyItem,
} from "../api/weekly.api";
import type { WeeklyItem } from "../api/weekly.api";
import { formatWeekRange, getJournalToday, getWeekStart } from "../config/dates";

const TEXT_LIMIT = 500;
const EASE = "ease-[cubic-bezier(0.2,0.7,0.2,1)]";
type LoadState = "loading" | "ready" | "error";

export default function Weekly() {
  // Always the current week. Deliberately no "previous week" navigation yet —
  // the spec's primary experience is "the current week is always obvious";
  // add navigation later only if you actually miss it.
  const weekStart = getWeekStart(getJournalToday());

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<WeeklyItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoadState("loading");
    fetchWeeklyPlan(weekStart)
      .then((plan) => {
        setItems(plan?.items ?? []);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  async function submitAdd() {
    const text = draftText.trim();
    setDraftText("");
    setAdding(false);
    if (!text) return;

    setError(null);
    try {
      const plan = await addWeeklyItem(weekStart, text);
      setItems(plan.items);
    } catch {
      setError("Couldn't add that. Try again.");
    }
  }

  // Optimistic: flips the UI immediately, rolls back only if the request fails.
  async function toggleComplete(item: WeeklyItem) {
    const previous = items;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, completed: !entry.completed } : entry)),
    );
    try {
      await updateWeeklyItem(weekStart, item.id, { completed: !item.completed });
    } catch {
      setError("Couldn't update that. Try again.");
      setItems(previous);
    }
  }

  function startEditing(item: WeeklyItem) {
    setEditingId(item.id);
    setEditingText(item.text);
  }

  async function submitEdit(item: WeeklyItem) {
    const text = editingText.trim();
    setEditingId(null);
    if (!text || text === item.text) return;

    const previous = items;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)));
    try {
      await updateWeeklyItem(weekStart, item.id, { text });
    } catch {
      setError("Couldn't save that edit. Try again.");
      setItems(previous);
    }
  }

  async function removeItem(item: WeeklyItem) {
    const previous = items;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      await deleteWeeklyItem(weekStart, item.id);
    } catch {
      setError("Couldn't remove that. Try again.");
      setItems(previous);
    }
  }

  return (
    <div className="page-in mx-auto w-full max-w-[680px] px-5 pb-24 pt-4 sm:px-8 lg:pt-10">
      <header className="pb-8">
        <p className="type-eyebrow">Weekly</p>
        <h1 className="type-display mt-2">{formatWeekRange(weekStart)}</h1>
        <p className="mt-3 font-serif text-[1.125rem] text-secondary">What do I want to accomplish before Sunday?</p>
      </header>

      {loadState === "loading" && <div className="h-40" aria-busy="true" />}

      {loadState === "error" && (
        <div className="border-t border-border py-8">
          <p className="font-serif text-[20px]">This week couldn&apos;t be loaded.</p>
          <button
            type="button"
            onClick={load}
            className="mt-5 h-9 rounded-control border border-border px-4 text-[13px] transition-colors hover:bg-hover"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && (
        <>
          {items.length === 0 && !adding && (
            <div className="flex flex-col items-center border-t border-border px-4 py-10 text-center">
              <ListChecks size={28} strokeWidth={1.5} className="text-tertiary" />
              <p className="mt-4 font-serif text-[1.375rem]">Nothing planned yet.</p>
              <p className="mt-1 text-[14px] text-secondary">What do you want to reach by Sunday?</p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className={
                  "mt-6 inline-flex h-10 items-center gap-1.5 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 " +
                  "hover:opacity-85 active:opacity-70"
                }
              >
                <Plus size={14} strokeWidth={2} />
                Add something
              </button>
            </div>
          )}

          {(items.length > 0 || adding) && (
            <ul className="border-t border-border">
              {items.map((item) => (
                <li key={item.id} className="page-in group flex items-start gap-3 border-b border-border py-3.5">
                  <button
                    type="button"
                    onClick={() => void toggleComplete(item)}
                    aria-label={item.completed ? "Mark as not done" : "Mark as done"}
                    className={
                      `mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${EASE} active:scale-90 ` +
                      (item.completed ? "border-text bg-text" : "border-tertiary hover:border-secondary")
                    }
                  >
                    <Check
                      size={12}
                      strokeWidth={3}
                      className={
                        `text-bg transition-all duration-200 ${EASE} ` +
                        (item.completed ? "scale-100 opacity-100" : "scale-50 opacity-0")
                      }
                    />
                  </button>

                  {editingId === item.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingText}
                      maxLength={TEXT_LIMIT}
                      onChange={(event) => setEditingText(event.target.value)}
                      onBlur={() => void submitEdit(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void submitEdit(item);
                        }
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-transparent text-[16px] leading-relaxed text-text focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(item)}
                      className={
                        `flex-1 whitespace-normal break-words text-left text-[16px] leading-relaxed transition-all duration-200 ${EASE} ` +
                        (item.completed ? "text-tertiary line-through" : "text-text")
                      }
                    >
                      {item.text}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void removeItem(item)}
                    aria-label="Remove item"
                    className="-mr-1 mt-px flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-tertiary opacity-100 transition-opacity duration-150 hover:bg-hover hover:text-text focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </li>
              ))}

              {adding ? (
                <li className="flex items-center gap-3 border-b border-border py-3.5">
                  <span className="h-[22px] w-[22px] flex-shrink-0 rounded-full border border-dashed border-tertiary" />
                  <input
                    ref={addInputRef}
                    type="text"
                    value={draftText}
                    maxLength={TEXT_LIMIT}
                    placeholder="Something to accomplish this week"
                    onChange={(event) => setDraftText(event.target.value)}
                    onBlur={() => void submitAdd()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitAdd();
                      }
                      if (event.key === "Escape") {
                        setAdding(false);
                        setDraftText("");
                      }
                    }}
                    className="flex-1 bg-transparent text-[16px] text-text placeholder:text-tertiary focus:outline-none"
                  />
                </li>
              ) : (
                <li>
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex w-full items-center gap-3 py-3.5 text-left text-secondary transition-colors duration-150 hover:text-text"
                  >
                    <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border border-dashed border-tertiary">
                      <Plus size={11} strokeWidth={2.5} />
                    </span>
                    <span className="text-[16px]">Add something</span>
                  </button>
                </li>
              )}
            </ul>
          )}

          {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}
        </>
      )}
    </div>
  );
}