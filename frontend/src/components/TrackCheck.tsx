interface TrackCheckProps {
  checked: boolean;
  busy?: boolean;
  label: string;
  onToggle: () => void;
}

export default function TrackCheck({ checked, busy = false, label, onToggle }: TrackCheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      className={
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-90 disabled:opacity-60 " +
        (checked
          ? "bg-text text-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_10px_rgba(0,0,0,0.25)]"
          : "bg-transparent text-transparent ring-1 ring-inset ring-border hover:ring-secondary")
      }
    >
      <svg
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path className="track-check-path" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </button>
  );
}