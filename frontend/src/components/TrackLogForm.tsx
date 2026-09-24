import { useState } from "react";
import type { FormEvent } from "react";
import type { LogValues } from "../api/tracks.api";
import { parseDayKey } from "../config/dates";
import AutoGrowTextarea from "./AutoGrowTextarea";

interface TrackLogFormProps {
  unit: string;
  initial: LogValues;
  submitLabel: string;
  onSubmit: (values: LogValues) => Promise<void>;
  onCancel?: () => void;
  // After adding a log, clear the note and amount so the next one starts fresh.
  clearAfterSubmit?: boolean;
}

const fieldStyle =
  "h-9 rounded-lg border border-border bg-transparent px-3 text-[16px] text-text placeholder:text-tertiary focus:border-tertiary focus:outline-none sm:text-[13px]";

// Used both for adding a log and for editing one.
export default function TrackLogForm({
  unit,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  clearAfterSubmit = false,
}: TrackLogFormProps) {
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);
  const [amount, setAmount] = useState(initial.amount === null ? "" : String(initial.amount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (!parseDayKey(date)) {
      setError("Pick a date.");
      return;
    }
    const parsedAmount = amount.trim() === "" ? null : Number(amount);
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setError("Amount must be a number.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onSubmit({ date, note, amount: parsedAmount });
      if (clearAfterSubmit) {
        setNote("");
        setAmount("");
      }
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Date"
          className={fieldStyle}
        />
        {unit && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              aria-label={`Amount in ${unit}`}
              className={fieldStyle + " w-24"}
            />
            <span className="text-[13px] text-secondary">{unit}</span>
          </div>
        )}
      </div>

      <AutoGrowTextarea
        value={note}
        maxLength={5000}
        placeholder="A short note (optional)"
        onChange={(event) => setNote(event.target.value)}
        className="text-[16px] leading-relaxed placeholder:text-tertiary sm:text-[15px]"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="h-8 rounded-lg bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:opacity-50"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-lg px-3 text-[13px] text-secondary transition-colors hover:bg-hover hover:text-text"
          >
            Cancel
          </button>
        )}
        {error && <span className="text-[13px] text-alert">{error}</span>}
      </div>
    </form>
  );
}