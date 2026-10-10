import type { TrackStatus } from "../api/tracks.api";

const OPTIONS: { value: TrackStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export function TrackStatusBadge({ status }: { status: TrackStatus }) {
  const label = OPTIONS.find((option) => option.value === status)?.label ?? status;
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-hover px-2.5 text-[12px] font-medium text-secondary">
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
    <div role="radiogroup" aria-label="Status" className="inline-flex rounded-control bg-selected p-0.5">
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
              "h-8 rounded-[7px] px-3 text-[13px] font-medium transition-colors duration-150 lg:h-7 " +
              (active ? "bg-bg text-text shadow-sm ring-1 ring-border" : "text-secondary hover:text-text")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}