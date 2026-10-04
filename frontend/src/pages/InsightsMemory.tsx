import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMemory } from "../api/insights.api";
import type { MemoryItem } from "../api/insights.api";
import { DateChips, Disclosure, QuoteList, formatShort } from "../components/insights/Evidence";

type LoadState = "loading" | "ready" | "error";

export default function InsightsMemory() {
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<MemoryItem[]>([]);

  function load() {
    setState("loading");
    fetchMemory()
      .then((memories) => {
        setItems(memories);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pb-24 pt-10 lg:px-12">
      <Link to="/insights" className="inline-flex items-center gap-1.5 text-[13px] text-secondary hover:text-text">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Insights
      </Link>
      <h1 className="mt-4 text-4xl font-light tracking-tight">Memory</h1>
      <p className="mt-2 text-[17px] text-secondary">Things you&apos;ve mentioned over time, with the entries they came from.</p>

      {state === "loading" && <div className="mt-10 h-40" aria-busy="true" />}

      {state === "error" && (
        <div className="mt-10 rounded-[18px] border border-border bg-surface p-6 shadow-card">
          <p className="text-[15px]">Memory couldn&apos;t be loaded.</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 h-8 rounded-lg border border-border px-4 text-[13px] transition-colors hover:bg-hover"
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && items.length === 0 && (
        <div className="mt-10 rounded-[18px] border border-border bg-surface p-8 shadow-card">
          <p className="text-[17px]">Nothing here yet.</p>
          <p className="mt-1 text-[15px] text-secondary">
            Memories appear as you finish journal days. Press Done after writing and they&apos;ll build up.
          </p>
        </div>
      )}

      {state === "ready" && items.length > 0 && (
        <ul className="mt-10 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-[18px] border border-border bg-surface px-6 py-5 shadow-card">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[19px] font-medium">{item.title}</h2>
                <span className="shrink-0 text-[12px] capitalize text-tertiary">{item.type}</span>
              </div>
              <p className="mt-1 text-[14px] text-secondary">
                Mentioned {item.mentionCount} {item.mentionCount === 1 ? "time" : "times"} · First{" "}
                {formatShort(item.firstMentionedAt)} · Last {formatShort(item.lastMentionedAt)}
              </p>
              <div className="mt-3">
                <DateChips dates={item.sourceDates} />
              </div>
              {item.evidence.length > 0 && (
                <div className="mt-4">
                  <Disclosure label="View mentions" openLabel="Hide mentions">
                    <QuoteList items={item.evidence} />
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