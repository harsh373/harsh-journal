import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchSettings, saveSettings } from "../api/settings.api";
import type { SettingsFields } from "../api/settings.api";
import { parseDayKey } from "../config/dates";

const LIMIT_LABEL = 120;

function daysUntil(target: string): number | null {
  const parts = parseDayKey(target);
  if (!parts) return null;
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

type LoadState = "loading" | "ready" | "error";

export default function Countdown() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [settings, setSettings] = useState<SettingsFields>({ countdownDate: "", countdownLabel: "" });
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<SettingsFields>({ countdownDate: "", countdownLabel: "" });

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        savedRef.current = data;
        setSettings(data);
        setDraftDate(data.countdownDate);
        setDraftLabel(data.countdownLabel);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const next = await saveSettings({ countdownDate: draftDate, countdownLabel: draftLabel.trim() });
      savedRef.current = next;
      setSettings(next);
      setEditing(false);
    } catch {
      // Stay in edit mode on failure so the date/label typed aren't lost.
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraftDate(savedRef.current.countdownDate);
    setDraftLabel(savedRef.current.countdownLabel);
    setEditing(false);
  }

  if (loadState === "loading" || loadState === "error") return null;

  if (editing) {
    return (
      <div className="rounded-[14px] border border-border bg-surface px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={draftDate}
            onChange={(event) => setDraftDate(event.target.value)}
            className="h-8 rounded-lg border border-border bg-bg px-2 text-[13px] text-text focus:outline-none"
          />
          <input
            type="text"
            value={draftLabel}
            maxLength={LIMIT_LABEL}
            placeholder="What's the day? (optional)"
            onChange={(event) => setDraftLabel(event.target.value)}
            className="h-8 min-w-[140px] flex-1 rounded-lg border border-border bg-bg px-2 text-[13px] text-text placeholder:text-tertiary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-8 rounded-lg bg-text px-3 text-[13px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="h-8 rounded-lg px-3 text-[13px] text-secondary transition-colors hover:bg-hover hover:text-text"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const remaining = settings.countdownDate ? daysUntil(settings.countdownDate) : null;

  if (!settings.countdownDate || remaining === null) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-text"
      >
        <Pencil size={13} strokeWidth={1.75} />
        Set a countdown
      </button>
    );
  }

  const dayWord = Math.abs(remaining) === 1 ? "day" : "days";
  const phrase =
    remaining > 0 ? `${remaining} ${dayWord} left` : remaining === 0 ? "Today" : `${Math.abs(remaining)} ${dayWord} ago`;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 rounded-[14px] border border-border bg-surface px-4 py-2.5 text-left shadow-card transition-colors hover:bg-hover"
    >
      <div>
        <p className="text-[19px] font-light leading-none tracking-tight">{phrase}</p>
        {settings.countdownLabel && <p className="mt-1 text-[12px] text-secondary">{settings.countdownLabel}</p>}
      </div>
      <Pencil
        size={12}
        strokeWidth={1.75}
        className="text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}