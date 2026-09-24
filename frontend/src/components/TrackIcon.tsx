import {
  BookOpen,
  Brain,
  Briefcase,
  Camera,
  Code,
  Coffee,
  Dumbbell,
  Heart,
  Languages,
  Leaf,
  Music,
  PenLine,
  Rocket,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TrackIconKey } from "../api/tracks.api";

export const TRACK_ICONS: Record<TrackIconKey, LucideIcon> = {
  code: Code,
  brain: Brain,
  leaf: Leaf,
  dumbbell: Dumbbell,
  book: BookOpen,
  music: Music,
  rocket: Rocket,
  pen: PenLine,
  target: Target,
  heart: Heart,
  briefcase: Briefcase,
  camera: Camera,
  languages: Languages,
  timer: Timer,
  sparkles: Sparkles,
  coffee: Coffee,
};

export const TRACK_ICON_KEYS = Object.keys(TRACK_ICONS) as TrackIconKey[];

export default function TrackIcon({
  name,
  size = 18,
  className = "",
}: {
  name: TrackIconKey;
  size?: number;
  className?: string;
}) {
  const Icon = TRACK_ICONS[name] ?? Target;
  return <Icon size={size} strokeWidth={1.75} className={className} />;
}