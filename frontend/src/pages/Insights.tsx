import { isAxiosError } from "axios";
import { ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { askJournal } from "../api/insights.api";
import type { AskResult, Strength } from "../api/insights.api";
import { DateChips, Disclosure, formatShort } from "../components/insights/Evidence";

const EXAMPLES = [
  "What has been taking most of my attention lately?",
  "What ideas have I repeatedly mentioned?",
  "What am I avoiding?",
  "What have I said I want to change?",
  "What patterns do you notice in my recent entries?",
];

type Status = "idle" | "searching" | "patterns" | "done" | "error";

const STRENGTH_LABEL: Record<Strength, string> = {
  limited: "Limited evidence",
  moderate: "Moderate evidence",
  strong: "Strong evidence",
};

function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 503) return "AI isn't set up on this server yet.";
    if (error.response?.status === 429) return "Too many questions in a row. Wait a minute and try again.";
  }
  return "Couldn't search your journal just now. Try again.";
}

export default function Insights() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  async function ask(raw: string) {
    const text = raw.trim();
    if (text.length < 3 || busyRef.current) return;

    busyRef.current = true;
    setQuestion(text);
    setAsked(text);
    setResult(null);
    setError("");
    setStatus("searching");
    const timer = window.setTimeout(() => setStatus((current) => (current === "searching" ? "patterns" : current)), 1500);

    try {
      setResult(await askJournal(text));
      setStatus("done");
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus("error");
    } finally {
      window.clearTimeout(timer);
      busyRef.current = false;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const loading = status === "searching" || status === "patterns";

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pb-24 pt-10 lg:px-12">
      <p className="text-[13px] font-medium tracking-wide text-secondary">INSIGHTS</p>
      <h1 className="mt-2 text-4xl font-light tracking-tight">Ask your journal</h1>
      <p className="mt-2 text-[17px] text-secondary">Questions about your own life, answered only from what you wrote.</p>

      <form onSubmit={onSubmit} className="mt-8">
        <input
          type="text"
          value={question}
          maxLength={400}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question..."
          autoComplete="off"
          className="h-12 w-full rounded-[14px] border border-border bg-surface px-4 text-[16px] text-text shadow-card placeholder:text-tertiary focus:outline-none"
        />
      </form>

      {status === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => void ask(example)}
              className="rounded-lg border border-border px-3 py-1.5 text-left text-[13px] text-secondary transition-colors duration-150 hover:bg-hover hover:text-text"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="mt-8 text-[15px] text-secondary" aria-live="polite">
          {status === "searching" ? "Searching your journal..." : "Looking for patterns..."}
        </p>
      )}

      {status === "error" && (
        <div className="mt-8 rounded-[18px] border border-border bg-surface p-6 shadow-card">
          <p className="text-[15px]">{error}</p>
          <button
            type="button"
            onClick={() => void ask(asked)}
            className="mt-4 h-8 rounded-lg border border-border px-4 text-[13px] transition-colors hover:bg-hover"
          >
            Try again
          </button>
        </div>
      )}

      {status === "done" && result && (
        <section className="mt-8 rounded-[18px] border border-border bg-surface px-6 py-6 shadow-card">
          <p className="text-[13px] text-secondary">{asked}</p>

          {result.searchedCount > 0 && result.from && result.to && (
            <p className="mt-3 text-[13px] text-tertiary">
              Looked at {result.searchedCount} {result.searchedCount === 1 ? "entry" : "entries"} from{" "}
              {formatShort(result.from)} to {formatShort(result.to)}.
            </p>
          )}

          <p className="mt-3 text-[19px] leading-relaxed">{result.answer}</p>

          {result.observations.length > 0 && (
            <div className="mt-6">
              <p className="text-[12px] font-medium tracking-wide text-secondary">
                {result.enoughEvidence ? "OBSERVED IN YOUR ENTRIES" : "WHAT LITTLE I FOUND"}
              </p>
              <ul className="mt-3 space-y-5">
                {result.observations.map((observation, index) => (
                  <li key={index}>
                    <p className="text-[16px] leading-relaxed">{observation.text}</p>
                    <p className="mt-1 text-[12px] text-tertiary">
                      {STRENGTH_LABEL[observation.strength]} · {observation.sourceDates.length}{" "}
                      {observation.sourceDates.length === 1 ? "entry" : "entries"}
                    </p>
                    <div className="mt-2">
                      <DateChips dates={observation.sourceDates} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.sources.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <Disclosure
                label={`View ${result.sources.length} supporting ${result.sources.length === 1 ? "entry" : "entries"}`}
              >
                <ul className="space-y-3">
                  {result.sources.map((source) => (
                    <li key={source.date}>
                      <Link
                        to={`/day/${source.date}`}
                        className="block rounded-lg border border-border px-4 py-3 transition-colors duration-150 hover:bg-hover"
                      >
                        <span className="text-[12px] font-medium text-secondary">{formatShort(source.date)}</span>
                        <span className="mt-1 block text-[14px] leading-relaxed text-text/90">{source.snippet}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}
        </section>
      )}

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        <HubLink to="/insights/memory" title="Memory" text="Things you've mentioned over time" />
        <HubLink to="/insights/open-loops" title="Open Loops" text="Things you've said you still need to do" />
      </div>
    </div>
  );
}

function HubLink({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-[18px] border border-border bg-surface px-6 py-5 shadow-card transition-colors duration-150 hover:bg-hover"
    >
      <div>
        <p className="text-[17px] font-medium">{title}</p>
        <p className="mt-1 text-[14px] text-secondary">{text}</p>
      </div>
      <ArrowRight size={16} strokeWidth={1.75} className="text-secondary" />
    </Link>
  );
}