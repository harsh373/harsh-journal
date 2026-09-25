import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatAmount } from "../api/tracks.api";
import type { LogValues, TrackLog } from "../api/tracks.api";
import { formatDayMonth } from "../config/dates";
import TrackLogForm from "./TrackLogForm";

interface TrackLogRowProps {
  log: TrackLog;
  unit: string;
  onSave: (values: LogValues) => Promise<void>;
  onDelete: () => void;
}

const iconButton =
  "flex h-7 w-7 items-center justify-center rounded-md text-tertiary transition-colors duration-150 hover:bg-hover hover:text-text";

export default function TrackLogRow({ log, unit, onSave, onDelete }: TrackLogRowProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="px-6 py-5">
        <TrackLogForm
          unit={unit}
          initial={{ date: log.date, note: log.note, amount: log.amount }}
          submitLabel="Save"
          onSubmit={async (values) => {
            await onSave(values);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-6">
      <div className="text-[12px] text-secondary sm:w-24 sm:shrink-0 sm:pt-0.5 sm:text-[13px]">
        {formatDayMonth(log.date)}
      </div>

      <div className="min-w-0 flex-1 pr-8 sm:pr-0">
        {log.amount !== null && (
          <p className="text-[15px] font-medium tabular-nums">{formatAmount(log.amount, unit)}</p>
        )}
        {log.note ? (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text/90">{log.note}</p>
        ) : (
          log.amount === null && <p className="text-[15px] text-tertiary">Showed up.</p>
        )}
      </div>

      <div className="absolute right-4 top-4 flex items-center gap-0.5 opacity-60 transition-opacity sm:static sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button type="button" onClick={() => setEditing(true)} aria-label="Edit log" className={iconButton}>
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={onDelete} aria-label="Delete log" className={iconButton}>
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}