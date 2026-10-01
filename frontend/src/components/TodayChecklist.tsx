import { Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addTodayItem, deleteTodayItem, fetchTodayPlan, updateTodayItem } from "../api/today.api";
import type { TodayItem } from "../api/today.api";
import { getJournalToday } from "../config/dates";

const TEXT_LIMIT = 500;
const EASE = "ease-[cubic-bezier(0.2,0.7,0.2,1)]";
type LoadState = "loading" | "ready" | "error";

// Rendered only on today's journal page, only before you've started writing.
// Self-contained: its own data, its own API calls, no connection to Weekly.
export default function TodayChecklist() {
  const date = getJournalToday();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<TodayItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTodayPlan(date)
      .then((plan) => {
        setItems(plan?.items ?? []);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, [date]);

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
      const plan = await addTodayItem(date, text);
      setItems(plan.items);
    } catch {
      setError("Couldn't add that. Try again.");
    }
  }

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

  function startEditing(item: TodayItem) {
    setEditingId(item.id);
    setEditingText(item.text);
  }

  async function submitEdit(item: TodayItem) {
    const text = editingText.trim();
    setEditingId(null);

    // Erasing an item's text completely now deletes it, instead of silently
    // reverting to the old text — that silent revert is exactly what looked
    // like "the task keeps coming back" when it was actually just discarded.
    if (!text) {
      await removeItem(item);
      return;
    }
    if (text === item.text) return;

    const previous = items;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)));
    try {
      await updateTodayItem(date, item.id, { text });
    } catch {
      setError("Couldn't save that edit. Try again.");
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

  // Quiet failure/loading: this is a small helper widget sitting above the
  // real journal content, not something that should block or flash the page.
  if (loadState === "loading" || loadState === "error") return null;

  return (
    <section className="mb-10">
      <h2 className="text-[13px] font-medium text-secondary">Today</h2>
      <p className="mt-1 text-[14px] text-tertiary">What do you need to do today?</p>

      {items.length > 0 || adding ? (
        <ul className="mt-3 overflow-hidden rounded-[18px] border border-border bg-surface shadow-card">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={
                "page-in group flex items-start gap-3 px-5 py-4 transition-colors duration-150 hover:bg-hover" +
                (index > 0 ? " border-t border-border" : "")
              }
            >
              <button
                type="button"
                onClick={() => void toggleComplete(item)}
                aria-label={item.completed ? "Mark as not done" : "Mark as done"}
                className={
                  `mt-[3px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${EASE} active:scale-90 ` +
                  (item.completed ? "border-text bg-text" : "border-border hover:border-text/40")
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
                  className="flex-1 bg-transparent text-[15px] text-text focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEditing(item)}
                  className={
                    `flex-1 whitespace-normal break-words text-left text-[15px] leading-relaxed transition-all duration-200 ${EASE} ` +
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
                className="mt-[1px] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-tertiary opacity-0 transition-opacity duration-150 hover:bg-hover hover:text-text group-hover:opacity-100"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </li>
          ))}

          {adding ? (
            <li
              className={"flex items-center gap-3 px-5 py-4" + (items.length > 0 ? " border-t border-border" : "")}
            >
              <span className="h-5 w-5 flex-shrink-0 rounded-full border border-dashed border-border" />
              <input
                ref={addInputRef}
                type="text"
                value={draftText}
                maxLength={TEXT_LIMIT}
                placeholder="Something to do today"
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
                className="flex-1 bg-transparent text-[15px] text-text placeholder:text-tertiary focus:outline-none"
              />
            </li>
          ) : (
            <li className={items.length > 0 ? "border-t border-border" : ""}>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-hover"
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-border text-secondary">
                  <Plus size={11} strokeWidth={2.5} />
                </span>
                <span className="text-[15px] text-secondary">Add something</span>
              </button>
            </li>
          )}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex w-full items-center gap-3 rounded-[18px] border border-dashed border-border px-5 py-4 text-left text-secondary transition-colors duration-150 hover:bg-hover hover:text-text"
        >
          <Plus size={15} strokeWidth={2} />
          What do you need to do today?
        </button>
      )}

      {error && <p className="mt-2 text-[13px] text-alert">{error}</p>}
    </section>
  );
}