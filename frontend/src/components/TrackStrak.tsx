interface TrackStreakProps {
  count: number;
  doneToday: boolean;
  className?: string;
}

export default function TrackStreak({ count, doneToday, className = "" }: TrackStreakProps) {
  const caption =
    count === 0
      ? "Starts with today"
      : doneToday
        ? "Including today"
        : "Today not logged yet";

  return (
    <div
      className={
        "flex items-baseline gap-3 lg:flex-col lg:items-start lg:gap-0 lg:border-l lg:border-border lg:pl-6 " +
        className
      }
    >
      <p className="type-eyebrow lg:mb-3">Streak</p>
      <p className="flex items-baseline gap-2 lg:block">
        <span className="text-[40px] font-semibold leading-none tracking-tight tabular-nums lg:text-[64px]">
          {count}
        </span>
        <span className="text-[15px] text-secondary lg:mt-1 lg:block">{count === 1 ? "day" : "days"}</span>
      </p>
      <p className="ml-auto text-[12px] text-tertiary lg:ml-0 lg:mt-3">{caption}</p>
    </div>
  );
}