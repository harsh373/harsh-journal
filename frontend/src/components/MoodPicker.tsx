import type { Mood } from "../api/journal.api";
import MoodDot from "./MoodDot";

const OPTIONS: { value: Mood; short: string; long: string }[] = [
  { value: "good", short: "Good", long: "Good day" },
  { value: "neutral", short: "Neutral", long: "Neutral day" },
  { value: "tough", short: "Tough", long: "Tough day" },
  { value: "special", short: "Special", long: "Special day" },
];

// Read-only: a small pill showing how the day felt.
export function MoodBadge({ mood }: { mood: Mood }) {
  const option = OPTIONS.find((item) => item.value === mood);
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border bg-elevated px-3 text-[13px] font-medium text-text shadow-sm">
      <MoodDot mood={mood} className="h-2 w-2" />
      {option?.long}
    </span>
  );
}

// Editing: a macOS-style segmented control.
export function MoodPicker({ value, onChange }: { value: Mood; onChange: (mood: Mood) => void }) {
  return (
    <div role="radiogroup" aria-label="How was the day" className="inline-flex rounded-[10px] bg-selected p-0.5">
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={
              "flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-medium transition-all duration-150 " +
              (active ? "bg-elevated text-text shadow-sm" : "text-secondary hover:text-text")
            }
          >
            <MoodDot mood={option.value} className="h-2 w-2" />
            {option.short}
          </button>
        );
      })}
    </div>
  );
}