import { LocateFixed, Minus, Plus, Shuffle } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createQuote, deleteQuote, fetchQuotes, updateQuote } from "../api/quotes.api";
import type { Quote, QuoteFields } from "../api/quotes.api";
import QuoteEditor from "../components/map/QuoteEditor";
import QuotePanel from "../components/map/QuotePanel";
import WorldArt from "../components/map/WorldArt";
import { pickLandmarkSite } from "../components/map/placement";
import { useMapView } from "../components/map/useMapView";
import type { Inset, MapController, View } from "../components/map/useMapView";

const NO_INSET: Inset = { left: 0, right: 0, top: 0, bottom: 0 };

function makeKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function shorten(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

type Editor = { mode: "add" } | { mode: "edit"; quote: Quote } | null;

export default function MapRoom() {
  const stageRef = useRef<HTMLDivElement>(null);
  const returnViewRef = useRef<View | null>(null);
  const userMovedRef = useRef(false);
  const clientKeyRef = useRef(makeKey());
  const toastTimer = useRef<number | undefined>(undefined);
  const arrivedTimer = useRef<number | undefined>(undefined);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [arrivedId, setArrivedId] = useState<string | null>(null);

  const desktop = useMediaQuery("(min-width: 1024px)");
  const quotesRef = useRef(quotes);
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    quotesRef.current = quotes;
    selectedRef.current = selectedId;
  }, [quotes, selectedId]);

  const markUserMoved = useCallback(() => {
    userMovedRef.current = true;
  }, []);
  const ctl = useMapView(stageRef, markUserMoved);

  /* ---------- Loading ---------- */
  const load = useCallback(() => {
    setLoadState("loading");
    fetchQuotes()
      .then((list) => {
        setQuotes(list);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(arrivedTimer.current);
    },
    [],
  );

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }

  /* ---------- Opening and closing quotes ---------- */
  // The part of the map left uncovered by the reading panel, so a landmark can be centred in it.
  const insetFor = useCallback(
    (open: boolean): Inset => {
      if (!open) return NO_INSET;
      if (desktop) return { left: 0, right: 410, top: 56, bottom: 0 };
      const h = stageRef.current?.clientHeight ?? 700;
      return { left: 0, right: 0, top: 56, bottom: Math.min(h * 0.6, 480) };
    },
    [desktop],
  );

  const openQuote = useCallback(
    (id: string, options?: { zoomIn?: boolean }) => {
      const q = quotesRef.current.find((item) => item.id === id);
      if (!q) return;
      // Remember where the map was, so closing the quote puts the reader back there.
      if (!returnViewRef.current) {
        returnViewRef.current = ctl.getView();
        userMovedRef.current = false;
      }
      ctl.setInset(insetFor(true));
      if (options?.zoomIn) {
        ctl.flyToWorld(q.x, q.y, Math.max(ctl.getView().k, ctl.getMinK() * 2.2));
      } else if (!ctl.isComfortablyVisible(q.x, q.y)) {
        ctl.flyToWorld(q.x, q.y);
      }
      setSelectedId(id);
    },
    [ctl, insetFor],
  );

  const closeQuote = useCallback(() => {
    const id = selectedRef.current;
    ctl.setInset(NO_INSET);
    if (returnViewRef.current && !userMovedRef.current) ctl.flyToView(returnViewRef.current);
    returnViewRef.current = null;
    setSelectedId(null);
    if (id) {
      requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-quote-id="${id}"]`)?.focus({ preventScroll: true }));
    }
  }, [ctl]);

  useEffect(() => {
    if (!selectedId || editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuote();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, editor, closeQuote]);

  // If the window changes between phone and desktop layouts while reading, re-measure.
  useEffect(() => {
    if (selectedRef.current) ctl.setInset(insetFor(true));
  }, [ctl, insetFor]);

  function rediscover() {
    const pool = quotes.filter((q) => q.id !== selectedId);
    const list = pool.length ? pool : quotes;
    // Indexing an array can give undefined, so check the pick before using it.
    const pick = list[Math.floor(Math.random() * list.length)];
    if (!pick) return;
    openQuote(pick.id, { zoomIn: true });
  }

  /* ---------- Saving ---------- */
  function openAdd() {
    clientKeyRef.current = makeKey();
    setEditor({ mode: "add" });
  }

  async function handleSubmit(fields: QuoteFields) {
    if (!editor) return;

    if (editor.mode === "edit") {
      const saved = await updateQuote(editor.quote.id, fields);
      setQuotes((prev) => prev.map((q) => (q.id === saved.id ? saved : q)));
      setEditor(null);
      showToast("Changes saved");
      return;
    }

    // The landmark's spot is chosen once, now, and stored with the quote. It never moves again.
    const key = clientKeyRef.current;
    const site = pickLandmarkSite(
      quotesRef.current.map((q) => ({ x: q.x, y: q.y })),
      key,
    );
    const saved = await createQuote({ ...fields, ...site, clientKey: key });
    setQuotes((prev) => (prev.some((q) => q.id === saved.id) ? prev : [...prev, saved]));
    setEditor(null);
    showToast("Added to the map");

    userMovedRef.current = true;
    ctl.setInset(insetFor(!!selectedRef.current));
    ctl.flyToWorld(saved.x, saved.y, Math.max(ctl.getView().k, ctl.getMinK() * 1.8));
    setArrivedId(saved.id);
    window.clearTimeout(arrivedTimer.current);
    arrivedTimer.current = window.setTimeout(() => setArrivedId(null), 3200);
  }

  async function handleDelete(id: string) {
    await deleteQuote(id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    closeQuote();
    showToast("Quote deleted");
  }

  async function copyQuote(q: Quote): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(q.author ? `“${q.text}”\n— ${q.author}` : `“${q.text}”`);
      return true;
    } catch {
      showToast("Couldn’t copy. Select the text instead.");
      return false;
    }
  }

  /* ---------- Keyboard on the map itself ---------- */
  function onStageKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const step = 90;
    switch (e.key) {
      case "ArrowLeft": ctl.nudge(step, 0); break;
      case "ArrowRight": ctl.nudge(-step, 0); break;
      case "ArrowUp": ctl.nudge(0, step); break;
      case "ArrowDown": ctl.nudge(0, -step); break;
      case "+":
      case "=": ctl.zoomBy(1.4); break;
      case "-": ctl.zoomBy(1 / 1.4); break;
      case "0": ctl.reset(); break;
      default: return;
    }
    e.preventDefault();
  }

  const selected = selectedId ? quotes.find((q) => q.id === selectedId) ?? null : null;
  const empty = loadState === "ready" && quotes.length === 0;
  const modalOpen = editor !== null;

  return (
    <div className="map-room relative h-full min-h-0 w-full overflow-hidden">
      {/* The world. Artwork, light and grain are static layers; only landmarks are interactive. */}
      <div
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-label="Map of a fictional world. Drag to move, scroll or pinch to zoom. Arrow keys pan, plus and minus zoom."
        {...ctl.handlers}
        onKeyDown={onStageKeyDown}
        inert={modalOpen}
        className="mr-stage absolute inset-0 cursor-grab touch-none overflow-clip outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:cursor-grabbing"
      >
        <WorldArt controller={ctl} />
        <div className="mr-vignette pointer-events-none absolute inset-0" />
        <div className="mr-grain pointer-events-none absolute inset-0" />
        <Landmarks quotes={quotes} selectedId={selectedId} arrivedId={arrivedId} controller={ctl} onOpen={openQuote} />
      </div>

      {/* Toolbar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 lg:p-4" inert={modalOpen}>
        <div className="glass-nav pointer-events-auto flex h-11 items-center gap-2 rounded-[12px] px-3.5 lg:h-9">
          <h1 className="text-[14px] font-semibold tracking-tight">The Map Room</h1>
          {quotes.length > 0 && <span className="text-[13px] tabular-nums text-tertiary">{quotes.length}</span>}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="glass-nav rounded-[12px] p-1 lg:p-0.5">
            <button
              type="button"
              onClick={rediscover}
              disabled={quotes.length === 0}
              aria-label="Rediscover a random quote"
              title={quotes.length === 0 ? "Add a quote first" : "Rediscover a quote"}
              className="mr-ctl"
            >
              <Shuffle size={16} strokeWidth={1.75} />
            </button>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex h-11 items-center gap-1.5 rounded-[12px] bg-text px-3.5 text-[14px] font-medium text-bg shadow-[0_0_0_0.5px_var(--nav-edge),0_8px_20px_-8px_rgba(0,0,0,0.5)] transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.97] lg:h-9 lg:text-[13px]"
          >
            <Plus size={16} strokeWidth={2} />
            Add quote
          </button>
        </div>
      </div>

      {/* Zoom */}
      <div
        className={
          "glass-nav absolute bottom-[calc(var(--bottom-nav-space,0px)+12px)] right-3 z-10 flex flex-col rounded-[12px] p-1 lg:bottom-4 lg:left-4 lg:right-auto lg:p-0.5 " +
          (selected ? "max-lg:hidden" : "")
        }
        inert={modalOpen}
      >
        <button type="button" onClick={() => ctl.zoomBy(1.5)} aria-label="Zoom in" title="Zoom in" className="mr-ctl">
          <Plus size={17} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => ctl.zoomBy(1 / 1.5)} aria-label="Zoom out" title="Zoom out" className="mr-ctl">
          <Minus size={17} strokeWidth={1.75} />
        </button>
        <span className="mx-2 my-0.5 h-px bg-border" aria-hidden="true" />
        <button type="button" onClick={() => ctl.reset()} aria-label="Show the whole map" title="Whole map" className="mr-ctl">
          <LocateFixed size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Empty state: one quiet invitation, nothing fake on the map. */}
      {empty && !modalOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--bottom-nav-space,0px)+68px)] z-10 flex justify-center px-4 lg:bottom-10">
          <div className="glass-nav pointer-events-auto mr-fade-in flex items-center gap-4 rounded-[16px] py-2.5 pl-5 pr-2.5">
            <p className="font-serif text-[16px] italic text-secondary">Your world is waiting.</p>
            <button
              type="button"
              onClick={openAdd}
              className="h-9 rounded-control bg-text px-3.5 text-[13px] font-medium text-bg transition-opacity hover:opacity-85"
            >
              Add your first quote
            </button>
          </div>
        </div>
      )}

      {/* Status messages */}
      {loadState === "error" && (
        <div className="absolute inset-x-0 top-[68px] z-30 flex justify-center px-4" role="alert">
          <div className="glass-nav flex items-center gap-3 rounded-[12px] py-2 pl-4 pr-2 text-[13px]">
            <span className="text-secondary">Couldn&apos;t load your quotes.</span>
            <button type="button" onClick={load} className="h-8 rounded-control px-3 font-medium text-text transition-colors hover:bg-hover">
              Try again
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[68px] z-40 flex justify-center px-4" role="status" aria-live="polite">
          <div className="glass-nav mr-pop-in rounded-full px-4 py-2 text-[13px] font-medium">{toast}</div>
        </div>
      )}

      {selected && (
        <div inert={modalOpen}>
          <QuotePanel
            key={selected.id}
            quote={selected}
            onClose={closeQuote}
            onEdit={() => setEditor({ mode: "edit", quote: selected })}
            onDelete={() => handleDelete(selected.id)}
            onCopy={() => copyQuote(selected)}
          />
        </div>
      )}

      {editor && (
        <QuoteEditor
          key={editor.mode === "edit" ? editor.quote.id : "new"}
          mode={editor.mode}
          initial={editor.mode === "edit" ? { text: editor.quote.text, author: editor.quote.author, note: editor.quote.note } : undefined}
          onSubmit={handleSubmit}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

/* ---------- Landmarks ----------
   Real buttons, positioned by the map controller without re-rendering React. They keep a
   constant on-screen size, so they stay easy to hit at every zoom level. */
function Landmarks({
  quotes,
  selectedId,
  arrivedId,
  controller,
  onOpen,
}: {
  quotes: Quote[];
  selectedId: string | null;
  arrivedId: string | null;
  controller: MapController;
  onOpen: (id: string, options?: { zoomIn?: boolean }) => void;
}) {
  const items = useRef(new Map<string, { el: HTMLButtonElement; x: number; y: number }>());
  const viewRef = useRef<View | null>(null);

  useEffect(
    () =>
      controller.subscribe((v) => {
        viewRef.current = v;
        items.current.forEach(({ el, x, y }) => {
          el.style.transform = `translate3d(${x * v.k + v.x}px,${y * v.k + v.y}px,0)`;
        });
      }),
    [controller],
  );

  // New landmarks mount at the origin; put them in place before the browser paints.
  useLayoutEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    items.current.forEach(({ el, x, y }) => {
      el.style.transform = `translate3d(${x * v.k + v.x}px,${y * v.k + v.y}px,0)`;
    });
  });

  return (
    <div className="pointer-events-none absolute inset-0">
      {quotes.map((q) => (
        <button
          key={q.id}
          ref={(el) => {
            if (el) items.current.set(q.id, { el, x: q.x, y: q.y });
            else items.current.delete(q.id);
          }}
          type="button"
          data-quote-id={q.id}
          data-arrived={arrivedId === q.id}
          aria-pressed={selectedId === q.id}
          aria-label={`Quote: ${shorten(q.text, 80)}${q.author ? `, ${q.author}` : ""}`}
          onClick={() => onOpen(q.id)}
          onFocus={() => {
            // Tabbing to an off-screen landmark brings it into view.
            if (!controller.isComfortablyVisible(q.x, q.y)) controller.flyToWorld(q.x, q.y);
          }}
          className="mr-mark"
        >
          <span className="mr-mark-pulse" />
          <span className="mr-mark-ring" />
          <span className="mr-mark-dot" />
          <span className="mr-mark-tip">{shorten(q.text, 60)}</span>
        </button>
      ))}
    </div>
  );
}