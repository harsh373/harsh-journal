import type { Mood } from "../api/journal.api";

const STYLES: Record<Mood, string> = {
  good: "bg-good",
  tough: "bg-tough",
  special: "bg-special",
  neutral: "border border-secondary", // neutral is an outlined ring
};

export default function MoodDot({ mood, className = "" }: { mood: Mood; className?: string }) {
  return <span aria-hidden="true" className={"block shrink-0 rounded-full " + STYLES[mood] + " " + className} />;
}