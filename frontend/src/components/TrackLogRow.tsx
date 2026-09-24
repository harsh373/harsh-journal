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
    <div className="group flex items-start gap-4 px-6 py-4">
      <div className="w-24 shrink-0 pt-0.5 text-[13px] text-secondary">{formatDayMonth(log.date)}</div>
      <div className="min-w-0 flex-1">
        {log.amount !== null && (
          <p className="text-[15px] font-medium tabular-nums">{formatAmount(log.amount, unit)}</p>
        )}
        {log.note ? (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text/90">{log.note}</p>
        ) : (
          log.amount === null && <p className="text-[15px] text-tertiary">Showed up.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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