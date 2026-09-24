import type { QuestStatus } from "../api/sideQuests.api";

const OPTIONS: { value: QuestStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "Paused" },
  { value: "abandoned", label: "Abandoned" },
];

const DOT_STYLES: Record<QuestStatus, string> = {
  active: "bg-special",
  completed: "bg-good",
  paused: "bg-tough",
  abandoned: "border border-secondary",
};

export function QuestStatusBadge({ status }: { status: QuestStatus }) {
  const option = OPTIONS.find((item) => item.value === status);
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full bg-hover px-3 text-[13px] text-text">
      <span className={"block h-2 w-2 shrink-0 rounded-full " + DOT_STYLES[status]} />
      {option?.label}
    </span>
  );
}

export function QuestStatusPicker({
  value,
  onChange,
}: {
  value: QuestStatus;
  onChange: (status: QuestStatus) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Quest status" className="inline-flex flex-wrap rounded-lg bg-selected p-0.5">
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
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-all duration-150 " +
              (active ? "bg-elevated text-text shadow-sm" : "text-secondary hover:text-text")
            }
          >
            <span className={"block h-2 w-2 shrink-0 rounded-full " + DOT_STYLES[option.value]} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}