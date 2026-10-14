import { Check, Copy, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "../../api/quotes.api";

interface Props {
  quote: Quote;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onCopy: () => Promise<boolean>;
}

function formatSaved(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

// Long quotes step down in size so they stay comfortable to read.
function quoteSize(length: number): string {
  if (length > 420) return "text-[1.1875rem] leading-[1.7]";
  if (length > 160) return "text-[1.375rem] leading-[1.6]";
  return "text-[1.625rem] leading-[1.45]";
}

export default function QuotePanel({ quote, onClose, onEdit, onDelete, onCopy }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    setConfirming(false);
    setDeleteFailed(false);
    ref.current?.focus({ preventScroll: true });
  }, [quote.id]);

  async function copy() {
    if (await onCopy()) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  async function remove() {
    setBusy(true);
    setDeleteFailed(false);
    try {
      await onDelete();
    } catch {
      setDeleteFailed(true);
      setBusy(false);
    }
  }

  // Swipe the handle down to dismiss on phones.
  function onHandleDown(e: React.PointerEvent) {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onHandleMove(e: React.PointerEvent) {
    if (dragStart.current !== null) setDragY(Math.max(0, e.clientY - dragStart.current));
  }
  function onHandleUp() {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (dragY > 90) onClose();
    setDragY(0);
  }

  const saved = formatSaved(quote.createdAt);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label="Selected quote"
      style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      className="mr-panel mr-panel-in absolute inset-x-0 bottom-0 z-20 flex max-h-[62%] flex-col rounded-t-[22px] outline-none transition-transform duration-200 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-16 lg:max-h-none lg:w-[380px] lg:rounded-[18px]"
    >
      <div
        className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center lg:hidden"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
      >
        <span className="h-1 w-9 rounded-full bg-text/20" />
      </div>

      <div className="flex items-center justify-between gap-2 px-5 pt-1 lg:pt-4">
        <p className="type-meta min-w-0 truncate text-tertiary">{saved && `Saved ${saved}`}</p>

        {confirming ? (
          <div className="flex items-center gap-1" role="group" aria-label="Confirm delete">
            <span className="mr-1 text-[13px] text-secondary">Delete this quote?</span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="h-8 rounded-control px-2.5 text-[13px] text-secondary transition-colors hover:bg-hover hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="h-8 rounded-control bg-alert px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        ) : (
          <div className="-mr-2 flex items-center">
            <button type="button" onClick={() => void copy()} aria-label={copied ? "Copied" : "Copy quote"} title="Copy" className="mr-ctl">
              {copied ? <Check size={16} strokeWidth={1.9} /> : <Copy size={16} strokeWidth={1.75} />}
            </button>
            <button type="button" onClick={onEdit} aria-label="Edit quote" title="Edit" className="mr-ctl">
              <Pencil size={16} strokeWidth={1.75} />
            </button>
            <button type="button" onClick={() => setConfirming(true)} aria-label="Delete quote" title="Delete" className="mr-ctl">
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
            <button type="button" onClick={onClose} aria-label="Close" title="Close" className="mr-ctl">
              <X size={17} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[calc(var(--bottom-nav-space,0px)+20px)] pt-5 lg:pb-8">
        <blockquote className={`mr-quote ${quoteSize(quote.text.length)} text-text`}>{quote.text}</blockquote>

        {quote.author && <p className="mt-5 text-[15px] font-medium text-secondary">{quote.author}</p>}

        {quote.note && (
          <p className="mt-6 whitespace-pre-wrap border-t border-border pt-4 text-[14px] leading-[1.6] text-secondary [overflow-wrap:anywhere]">
            {quote.note}
          </p>
        )}

        {deleteFailed && (
          <p role="alert" className="mt-5 text-[13px] text-alert">
            Couldn&apos;t delete the quote. Check your connection and try again.
          </p>
        )}
      </div>
    </aside>
  );
}