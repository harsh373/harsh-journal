import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addTodayItem, deleteTodayItem, fetchTodayPlan, updateTodayItem } from "../api/today.api";
import type { TodayItem } from "../api/today.api";
import { getJournalToday } from "../config/dates";

const TEXT_LIMIT = 500;
const EASE = "ease-[cubic-bezier(0.2,0.7,0.2,1)]";
// Before this hour the circles always show. After it, only if you have tasks.
const CUTOFF_HOUR = 11;
type LoadState = "loading" | "ready" | "error";

type Props = {
  onTallyChange?: (done: number, total: number) => void;
};

// Slot order = priority order. Images live in public/avatars/.
const SLOTS = [
  { name: "Loki", src: "/avatars/loki.jpg", ring: "linear-gradient(45deg, #1B8A4B, #D4AF37)" },
  { name: "Iron Man", src: "/avatars/ironman.jpg", ring: "linear-gradient(45deg, #C62828, #F5B301)" },
  { name: "Rocket", src: "/avatars/rocket.jpg", ring: "linear-gradient(45deg, #E65100, #FFB74D)" },
] as const;

type Slot = (typeof SLOTS)[number];

function Avatar({ slot, state }: { slot: Slot; state: "empty" | "todo" | "done" }) {
  const [broken, setBroken] = useState(false);

  return (
    <div
      className="rounded-full p-[3px] transition-all duration-300"
      style={state === "todo" ? { background: slot.ring } : undefined}
    >
      <div
        className={
          "rounded-full bg-bg p-[3px] " +
          (state === "empty" ? "border border-dashed border-tertiary" : "") +
          (state === "done" ? " ring-1 ring-border" : "")
        }
      >
        <div className="relative h-[72px] w-[72px] overflow-hidden rounded-full bg-surface sm:h-[84px] sm:w-[84px]">
          {broken ? (
            <span className="flex h-full w-full items-center justify-center font-serif text-[1.75rem] text-secondary">
              {slot.name.charAt(0)}
            </span>
          ) : (
            <img
              src={slot.src}
              alt=""
              draggable={false}
              onError={() => setBroken(true)}
              className={
                `h-full w-full object-cover transition-all duration-300 ${EASE} ` +
                (state === "done" ? "opacity-40 grayscale" : state === "empty" ? "opacity-30 grayscale" : "")
              }
            />
          )}
          {state === "empty" && (
            <span className="absolute inset-0 flex items-center justify-center text-text">
              <Plus size={22} strokeWidth={1.75} />
            </span>
          )}
          {state === "done" && (
            <span className="absolute inset-0 flex items-center justify-center text-text">
              <Check size={26} strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TodayChecklist({ onTallyChange }: Props) {
  const date = getJournalToday();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<TodayItem[]>([]);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hour, setHour] = useState(() => new Date().getHours());

  const inputRef = useRef<HTMLInputElement>(null);
  const doneCount = items.filter((item) => item.completed).length;

  useEffect(() => {
    fetchTodayPlan(date)
      .then((plan) => {
        setItems((plan?.items ?? []).slice(0, SLOTS.length));
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, [date]);

  useEffect(() => {
    if (loadState === "ready") onTallyChange?.(doneCount, items.length);
  }, [loadState, doneCount, items.length, onTallyChange]);

  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (editingSlot !== null) inputRef.current?.focus();
  }, [editingSlot]);

  async function toggleComplete(item: TodayItem) {
    const previous = items;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, completed: !entry.completed } : entry)),
    );
    try {
      await updateTodayItem(date, item.id, { completed: !item.completed });
    } catch {
      setError("Couldn't update that. Try again.");
      setItems(previous);
    }
  }

  async function removeItem(item: TodayItem) {
    const previous = items;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      await deleteTodayItem(date, item.id);
    } catch {
      setError("Couldn't remove that. Try again.");
      setItems(previous);
    }
  }

  function openSlot(index: number) {
    setError(null);
    setEditingSlot(index);
    setDraftText(items[index]?.text ?? "");
  }

  function cancelEdit() {
    setEditingSlot(null);
    setDraftText("");
  }

  async function submitSlot() {
    if (editingSlot === null) return;
    const index = editingSlot;
    const text = draftText.trim();
    const existing = items[index];
    cancelEdit();

    if (!existing) {
      if (!text) return;
      try {
        const plan = await addTodayItem(date, text);
        setItems(plan.items.slice(0, SLOTS.length));
      } catch {
        setError("Couldn't add that. Try again.");
      }
      return;
    }

    if (!text) {
      await removeItem(existing);
      return;
    }
    if (text === existing.text) return;

    const previous = items;
    setItems((current) => current.map((entry) => (entry.id === existing.id ? { ...entry, text } : entry)));
    try {
      await updateTodayItem(date, existing.id, { text });
    } catch {
      setError("Couldn't save that edit. Try again.");
      setItems(previous);
    }
  }

  if (loadState === "loading" || loadState === "error") return null;

  const isMorning = hour < CUTOFF_HOUR;
  if (!isMorning && items.length === 0 && editingSlot === null) return null;

  const nextEmpty = items.length; // slots fill in order
  const isEditing = editingSlot !== null;

  return (
    <section className="mb-10">
      <div className="grid grid-cols-3 gap-2">
        {SLOTS.map((slot, index) => {
          const item = items[index];
          const state = !item ? "empty" : item.completed ? "done" : "todo";
          const locked = !item && index !== nextEmpty;

          return (
            <div key={slot.name} className="flex flex-col items-center">
              <button
                type="button"
                disabled={locked}
                onClick={() => (item ? void toggleComplete(item) : openSlot(index))}
                aria-label={
                  item
                    ? item.completed
                      ? `Mark "${item.text}" as not done`
                      : `Mark "${item.text}" as done`
                    : "Add a task"
                }
                className={
                  `rounded-full transition-transform duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ` +
                  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text`
                }
              >
                <Avatar slot={slot} state={state} />
              </button>

              {item && (
                <button
                  type="button"
                  onClick={() => openSlot(index)}
                  aria-label={`Edit "${item.text}"`}
                  className={
                    `mt-2 line-clamp-2 w-full break-words text-center text-[12px] leading-4 transition-colors duration-300 ` +
                    (item.completed ? "text-tertiary line-through" : "text-secondary hover:text-text")
                  }
                >
                  {item.text}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isEditing && (
        <div className="mt-5 border-b border-border pb-2 focus-within:border-secondary">
          <input
            ref={inputRef}
            type="text"
            value={draftText}
            maxLength={TEXT_LIMIT}
            placeholder="Write the task"
            onChange={(event) => setDraftText(event.target.value)}
            onBlur={() => void submitSlot()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitSlot();
              }
              if (event.key === "Escape") cancelEdit();
            }}
            className="w-full bg-transparent font-serif text-[1.25rem] leading-snug text-text placeholder:text-tertiary focus:outline-none"
          />
        </div>
      )}

      {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}
    </section>
  );
}