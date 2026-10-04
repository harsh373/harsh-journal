import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function formatShort(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const sameYear = y === new Date().getFullYear();
  return new Date(y, m - 1, d).toLocaleDateString(
    "en-US",
    sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
  );
}

export function DateChips({ dates }: { dates: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {dates.map((date) => (
        <Link
          key={date}
          to={`/day/${date}`}
          className="rounded-md border border-border px-2 py-0.5 text-[12px] text-secondary transition-colors duration-150 hover:bg-hover hover:text-text"
        >
          {formatShort(date)}
        </Link>
      ))}
    </div>
  );
}

export function QuoteList({ items }: { items: { date: string; quote: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.date}-${index}`} className="flex gap-3">
          <Link
            to={`/day/${item.date}`}
            className="w-16 shrink-0 pt-0.5 text-[12px] text-secondary underline-offset-2 hover:text-text hover:underline"
          >
            {formatShort(item.date)}
          </Link>
          <p className="text-[14px] leading-relaxed text-text/90">&ldquo;{item.quote}&rdquo;</p>
        </li>
      ))}
    </ul>
  );
}

export function Disclosure({ label, openLabel, children }: { label: string; openLabel?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[13px] font-medium text-secondary underline-offset-2 hover:text-text hover:underline"
      >
        {open ? (openLabel ?? "Hide") : label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}