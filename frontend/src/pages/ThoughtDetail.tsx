import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { deleteThought, fetchThought, saveThought } from "../api/thoughts.api";

type LoadState = "loading" | "ready" | "missing" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

interface Draft {
  title: string;
  body: string;
}

const TITLE_LIMIT = 200;
const BODY_LIMIT = 100_000;
const AUTOSAVE_MS = 800;

function diffOf(current: Draft, saved: Draft): { title?: string; body?: string } | null {
  const patch: { title?: string; body?: string } = {};
  if (current.title !== saved.title) patch.title = current.title;
  if (current.body !== saved.body) patch.body = current.body;
  return patch.title === undefined && patch.body === undefined ? null : patch;
}

// Grows a textarea to fit its text, so the page itself scrolls like a document.
function useAutosize(ref: { current: HTMLTextAreaElement | null }, value: string, active: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value, active]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      const el = ref.current;
      if (!el) return;
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ref, active]);
}

const quietButton =
  "inline-flex h-9 items-center rounded-full px-3.5 text-[13px] text-secondary transition-colors duration-150 hover:bg-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-reduce:transition-none";
const primaryButton =
  "inline-flex h-9 items-center rounded-full bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 active:opacity-70 disabled:opacity-40 motion-reduce:transition-none";

export default function ThoughtDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fresh = (location.state as { fresh?: boolean } | null)?.fresh === true;

  const [load, setLoad] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const currentRef = useRef<Draft>({ title: "", body: "" });
  const savedRef = useRef<Draft>({ title: "", body: "" });
  const timerRef = useRef<number | undefined>(undefined);
  const inflightRef = useRef<Promise<boolean> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const ready = load === "ready";
  useAutosize(titleRef, title, ready);
  useAutosize(bodyRef, body, ready);

  // --- loading ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoad("loading");
    fetchThought(id)
      .then((thought) => {
        if (cancelled) return;
        const draft = { title: thought.title, body: thought.body };
        currentRef.current = draft;
        savedRef.current = draft;
        setTitle(draft.title);
        setBody(draft.body);
        setEditing(fresh || (!draft.title && !draft.body));
        setLoad("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = (error as { response?: { status?: number } }).response?.status;
        setLoad(status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, fresh, reloadKey]);

  // Put the cursor where writing should continue whenever editing begins.
  useEffect(() => {
    if (!ready || !editing) return;
    const target = currentRef.current.title ? bodyRef.current : titleRef.current;
    if (!target) return;
    target.focus();
    const end = target.value.length;
    target.setSelectionRange(end, end);
  }, [ready, editing]);

  // --- saving ------------------------------------------------------------------------------
  // One save runs at a time. Anyone who asks while it runs gets the same promise, and the loop
  // keeps going until nothing differs from what the server has, so the last keystroke is never skipped.
  const saveNow = useCallback((): Promise<boolean> => {
    if (inflightRef.current) return inflightRef.current;
    const run = (async () => {
      try {
        for (;;) {
          const snapshot = { ...currentRef.current };
          const patch = diffOf(snapshot, savedRef.current);
          if (!patch) break;
          setSaveState("saving");
          await saveThought(id, patch);
          savedRef.current = snapshot;
        }
        setSaveState("saved");
        return true;
      } catch {
        setSaveState("error");
        return false;
      }
    })();
    inflightRef.current = run;
    void run.finally(() => {
      if (inflightRef.current === run) inflightRef.current = null;
    });
    return run;
  }, [id]);

  const schedule = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void saveNow(), AUTOSAVE_MS);
  }, [saveNow]);

  // Flush when the tab is hidden or the page is left, and warn if something is still unsaved.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (diffOf(currentRef.current, savedRef.current)) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearTimeout(timerRef.current);
      void saveNow(); // leaving by any route (sidebar, back button) still saves
    };
  }, [saveNow]);

  function onTitleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value.replace(/\n/g, " ");
    setTitle(value);
    currentRef.current = { ...currentRef.current, title: value };
    setProblem(null);
    schedule();
  }

  function onBodyChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setBody(value);
    currentRef.current = { ...currentRef.current, body: value };
    setProblem(null);
    schedule();
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      bodyRef.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      window.clearTimeout(timerRef.current);
      void saveNow();
    }
  }

  // --- actions -------------------------------------------------------------------------------
  async function finishEditing() {
    if (busy) return;
    window.clearTimeout(timerRef.current);
    const ok = await saveNow();
    if (!ok) {
      setProblem("Couldn't save. Your writing is still here.");
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur();
    setEditing(false);
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    window.clearTimeout(timerRef.current);
    const ok = await saveNow();
    if (!ok) {
      setProblem("Couldn't save. Your writing is still here.");
      setBusy(false);
      return;
    }
    const { title: t, body: b } = currentRef.current;
    if (!t.trim() && !b.trim()) {
      try {
        await deleteThought(id); // an empty thought isn't worth keeping
      } catch {
        // Quiet: the list hides empty thoughts anyway.
      }
    }
    navigate("/thoughts");
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    window.clearTimeout(timerRef.current);
    try {
      await deleteThought(id);
      savedRef.current = currentRef.current; // nothing left to save
      navigate("/thoughts", { replace: true });
    } catch {
      setProblem("Couldn't delete that. Try again.");
      setBusy(false);
    }
  }

  const status =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : "";

  return (
    <div
      className="page-in mx-auto w-full max-w-[40rem] px-6 pb-40 pt-5 sm:px-8 lg:pt-10"
      onKeyDown={onKeyDown}
    >
      <div className="flex h-10 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void leave()}
          disabled={busy}
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] text-secondary transition-colors duration-150 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Thoughts
        </button>

        {ready && (
          <div key={confirmDelete ? "confirm" : editing ? "editing" : "reading"} className="page-in flex items-center gap-1">
            {confirmDelete ? (
              <>
                <span className="mr-1 text-[13px] text-secondary">Delete this thought?</span>
                <button type="button" className={quietButton} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className={`${quietButton} !text-alert`}
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                {editing && status && (
                  <span role="status" className={"mr-2 text-[12px] " + (saveState === "error" ? "text-alert" : "text-tertiary")}>
                    {status}
                    {saveState === "error" && (
                      <>
                        {" · "}
                        <button type="button" className="underline underline-offset-2" onClick={() => void saveNow()}>
                          Retry
                        </button>
                      </>
                    )}
                  </span>
                )}
                {editing ? (
                  <button type="button" className={primaryButton} onClick={() => void finishEditing()}>
                    Done
                  </button>
                ) : (
                  <button type="button" className={quietButton} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete thought"
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-tertiary transition-colors duration-150 hover:bg-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {problem && (
        <p role="alert" className="mt-4 text-[13px] text-alert">
          {problem}
        </p>
      )}

      {load === "loading" && (
        <div aria-busy="true" className="mt-14 space-y-4 sm:mt-20">
          <div className="h-10 w-2/3 animate-pulse rounded-md bg-hover motion-reduce:animate-none" />
          <div className="h-5 w-full animate-pulse rounded-md bg-hover motion-reduce:animate-none" />
          <div className="h-5 w-5/6 animate-pulse rounded-md bg-hover motion-reduce:animate-none" />
        </div>
      )}

      {load === "missing" && (
        <div className="mt-20">
          <p className="font-serif text-[1.5rem]">This thought no longer exists.</p>
          <button type="button" className={`${quietButton} mt-4 -ml-3.5`} onClick={() => navigate("/thoughts", { replace: true })}>
            Back to My Thoughts
          </button>
        </div>
      )}

      {load === "error" && (
        <div className="mt-20">
          <p className="font-serif text-[1.5rem]">This couldn&apos;t be loaded.</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-5 h-9 rounded-control border border-border px-4 text-[13px] transition-colors hover:bg-hover"
          >
            Try again
          </button>
        </div>
      )}

      {/* Reading and writing share the same typography, so switching between them never moves a word. */}
      {ready && (
        <article className="mt-14 sm:mt-20">
          <textarea
            ref={titleRef}
            value={title}
            onChange={onTitleChange}
            onKeyDown={onTitleKeyDown}
            readOnly={!editing}
            rows={1}
            maxLength={TITLE_LIMIT}
            placeholder="Title"
            aria-label="Title"
            className="block w-full resize-none overflow-hidden bg-transparent text-[clamp(1.9rem,4.6vw,2.65rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-text outline-none placeholder:text-tertiary/60"
          />
          <textarea
            ref={bodyRef}
            value={body}
            onChange={onBodyChange}
            readOnly={!editing}
            rows={1}
            maxLength={BODY_LIMIT}
            placeholder={editing ? "Write what you think…" : ""}
            aria-label="Thought"
            className="mt-8 block w-full resize-none overflow-hidden bg-transparent font-serif text-[1.1875rem] leading-[1.8] text-text/90 outline-none placeholder:text-tertiary/60 sm:mt-10 sm:text-[1.25rem]"
          />
        </article>
      )}
    </div>
  );
}