import { useEffect, useRef, useState } from "react";
import { QUOTE_LIMITS } from "../../api/quotes.api";
import type { QuoteFields } from "../../api/quotes.api";

interface Props {
  mode: "add" | "edit";
  initial?: QuoteFields;
  onSubmit: (fields: QuoteFields) => Promise<void>;
  onClose: () => void;
}

// How much of the screen the on-screen keyboard covers, so the sheet can sit above it.
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function Counter({ length, limit }: { length: number; limit: number }) {
  if (length < limit * 0.85) return null;
  return <span className={"text-[12px] tabular-nums " + (length >= limit ? "text-alert" : "text-tertiary")}>{limit - length} left</span>;
}

export default function QuoteEditor({ mode, initial, onSubmit, onClose }: Props) {
  const [text, setText] = useState(initial?.text ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const keyboard = useKeyboardInset();

  const dirty = text !== (initial?.text ?? "") || author !== (initial?.author ?? "") || note !== (initial?.note ?? "");
  const canSave = text.trim().length > 0 && !saving;

  useEffect(() => {
    textRef.current?.focus({ preventScroll: true });
    grow(textRef.current);
    grow(noteRef.current);
  }, []);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setFailed(false);
    try {
      await onSubmit({ text: text.replace(/\r\n/g, "\n").trim(), author: author.trim(), note: note.trim() });
    } catch {
      // Everything typed stays exactly where it is.
      setFailed(true);
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && !saving) {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  }

  const field =
    "w-full resize-none bg-transparent text-text outline-none placeholder:text-tertiary focus:outline-none";

  return (
    <div
      className="mr-fade-in absolute inset-0 z-30 flex items-end justify-center bg-black/30 pb-[max(var(--kb,0px),var(--bottom-nav-space,0px))] lg:items-center lg:p-6 lg:pb-6"
      style={{ ["--kb" as string]: `${keyboard}px` }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !dirty && !saving) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={mode === "add" ? "Add a quote" : "Edit quote"}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="mr-panel mr-pop-in flex max-h-full w-full flex-col overflow-hidden rounded-t-[22px] lg:max-w-[520px] lg:rounded-[18px]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2 pt-6">
          <textarea
            ref={textRef}
            value={text}
            maxLength={QUOTE_LIMITS.text}
            rows={3}
            placeholder="A line worth keeping"
            aria-label="Quote"
            onChange={(e) => {
              setText(e.target.value);
              grow(e.target);
            }}
            className={`${field} mr-quote min-h-[5.5rem] text-[1.375rem] leading-[1.5]`}
          />

          <input
            value={author}
            maxLength={QUOTE_LIMITS.author}
            placeholder="Author or source"
            aria-label="Author or source"
            autoComplete="off"
            onChange={(e) => setAuthor(e.target.value)}
            className={`${field} mt-4 h-9 border-b border-border text-[16px] transition-colors focus:border-secondary lg:text-[15px]`}
          />

          <textarea
            ref={noteRef}
            value={note}
            maxLength={QUOTE_LIMITS.note}
            rows={1}
            placeholder="Why you saved it (optional)"
            aria-label="Personal note"
            onChange={(e) => {
              setNote(e.target.value);
              grow(e.target);
            }}
            className={`${field} mt-3 py-1.5 text-[16px] leading-[1.55] text-secondary lg:text-[14px]`}
          />
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-3">
          <div className="min-w-0 flex-1">
            {failed ? (
              <p role="alert" className="text-[13px] leading-snug text-alert">
                Couldn&apos;t save. Your text is still here.
              </p>
            ) : (
              <Counter length={text.length} limit={QUOTE_LIMITS.text} />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-control px-3.5 text-[14px] text-secondary transition-colors hover:bg-hover hover:text-text lg:h-9"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="h-10 rounded-control bg-text px-5 text-[14px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:opacity-40 lg:h-9"
          >
            {saving ? "Saving…" : failed ? "Try again" : mode === "add" ? "Save quote" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}