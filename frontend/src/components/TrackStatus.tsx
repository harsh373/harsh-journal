import type { TrackStatus } from "../api/tracks.api";

const OPTIONS: { value: TrackStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export function TrackStatusBadge({ status }: { status: TrackStatus }) {
  const label = OPTIONS.find((option) => option.value === status)?.label ?? status;
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-hover px-2.5 text-[12px] text-secondary">
      {label}
    </span>
  );
}

// A macOS-style segmented control, like the mood picker.
export function TrackStatusPicker({
  value,
  onChange,
}: {
  value: TrackStatus;
  onChange: (status: TrackStatus) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Status" className="inline-flex rounded-lg bg-selected p-0.5">
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
              "h-7 rounded-md px-3 text-[13px] transition-all duration-150 " +
              (active ? "bg-elevated text-text shadow-sm" : "text-secondary hover:text-text")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}