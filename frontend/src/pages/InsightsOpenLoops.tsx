import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOpenLoops, updateLoopStatus } from "../api/insights.api";
import type { LoopStatus, OpenLoopItem } from "../api/insights.api";
import { DateChips, Disclosure, QuoteList, formatShort } from "../components/insights/Evidence";

type LoadState = "loading" | "ready" | "error";

const TABS: { status: LoopStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "resolved", label: "Resolved" },
  { status: "dismissed", label: "Dismissed" },
];

const buttonClass =
  "h-8 rounded-lg border border-border px-3 text-[13px] text-text transition-colors duration-150 hover:bg-hover";

export default function InsightsOpenLoops() {
  const [tab, setTab] = useState<LoopStatus>("open");
  const [state, setState] = useState<LoadState>("loading");
  const [loops, setLoops] = useState<OpenLoopItem[]>([]);
  const [actionError, setActionError] = useState(false);

  function load(status: LoopStatus) {
    setState("loading");
    setActionError(false);
    fetchOpenLoops(status)
      .then((items) => {
        setLoops(items);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(() => load(tab), [tab]);

  async function move(id: string, status: LoopStatus) {
    setActionError(false);
    try {
      await updateLoopStatus(id, status);
      setLoops((current) => current.filter((loop) => loop.id !== id));
    } catch {
      setActionError(true);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pb-24 pt-10 lg:px-12">
      <Link to="/insights" className="inline-flex items-center gap-1.5 text-[13px] text-secondary hover:text-text">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Insights
      </Link>
      <h1 className="mt-4 text-4xl font-light tracking-tight">Open Loops</h1>
      <p className="mt-2 text-[17px] text-secondary">Things you&apos;ve said you still need to do. Nothing is ever deleted.</p>

      <div className="mt-8 flex gap-1 rounded-lg bg-hover p-1 sm:w-fit">
        {TABS.map(({ status, label }) => (
          <button
            key={status}
            type="button"
            onClick={() => setTab(status)}
            className={
              "h-8 flex-1 rounded-md px-4 text-[13px] transition-colors duration-150 sm:flex-none " +
              (tab === status ? "bg-surface font-medium text-text shadow-card" : "text-secondary hover:text-text")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {actionError && <p className="mt-4 text-[13px] text-alert">That change didn&apos;t save. Try again.</p>}

      {state === "loading" && <div className="mt-10 h-40" aria-busy="true" />}

      {state === "error" && (
        <div className="mt-10 rounded-[18px] border border-border bg-surface p-6 shadow-card">
          <p className="text-[15px]">Open loops couldn&apos;t be loaded.</p>
          <button type="button" onClick={() => load(tab)} className={"mt-4 " + buttonClass}>
            Try again
          </button>
        </div>
      )}

      {state === "ready" && loops.length === 0 && (
        <div className="mt-10 rounded-[18px] border border-border bg-surface p-8 shadow-card">
          <p className="text-[17px]">
            {tab === "open" ? "No open loops right now." : tab === "resolved" ? "Nothing resolved yet." : "Nothing dismissed."}
          </p>
          {tab === "open" && (
            <p className="mt-1 text-[15px] text-secondary">
              When you write that you still need to do something, it shows up here with the entries it came from.
            </p>
          )}
        </div>
      )}

      {state === "ready" && loops.length > 0 && (
        <ul className="mt-8 space-y-4">
          {loops.map((loop) => (
            <li key={loop.id} className="rounded-[18px] border border-border bg-surface px-6 py-5 shadow-card">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[19px] font-medium">{loop.title}</h2>
                {loop.kind === "ongoing_goal" && <span className="shrink-0 text-[12px] text-tertiary">Ongoing goal</span>}
              </div>
              <p className="mt-1 text-[14px] text-secondary">
                Mentioned {loop.mentionCount} {loop.mentionCount === 1 ? "time" : "times"} · First{" "}
                {formatShort(loop.firstMentionedAt)} · Last {formatShort(loop.lastMentionedAt)}
              </p>

              {loop.status === "resolved" && loop.resolvedBy === "journal" && loop.resolvedAt && loop.resolvedQuote && (
                <p className="mt-3 text-[14px] leading-relaxed text-text/90">
                  Marked done from your entry on {formatShort(loop.resolvedAt)}: &ldquo;{loop.resolvedQuote}&rdquo;
                </p>
              )}
              {loop.status === "resolved" && loop.resolvedBy === "user" && (
                <p className="mt-3 text-[14px] text-secondary">You marked this resolved.</p>
              )}

              <div className="mt-3">
                <DateChips dates={loop.sourceDates} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {loop.status === "open" ? (
                  <>
                    <button type="button" onClick={() => void move(loop.id, "resolved")} className={buttonClass}>
                      Mark resolved
                    </button>
                    <button type="button" onClick={() => void move(loop.id, "dismissed")} className={buttonClass}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => void move(loop.id, "open")} className={buttonClass}>
                    Reopen
                  </button>
                )}
              </div>

              {loop.evidence.length > 0 && (
                <div className="mt-4">
                  <Disclosure label="View evidence" openLabel="Hide evidence">
                    <QuoteList items={loop.evidence} />
                  </Disclosure>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}