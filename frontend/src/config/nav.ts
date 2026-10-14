import {
  BookOpen,
  CalendarCheck,
  Circle,
  Compass,
  Image as PhotosIcon,
  ListChecks,
  Orbit,
  Sparkles,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavEntry {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar, in this order. */
  primary?: boolean;
  /** Icon used in the bottom bar when it differs from the sidebar icon. */
  barIcon?: LucideIcon;
}

// Single source of truth for every destination. The desktop sidebar renders all of
// them (unchanged). On phones the bottom bar renders the primary four and the
// drawer renders the rest.
export const NAV: NavEntry[] = [
  { label: "Journal", to: "/", icon: BookOpen, primary: true },
  { label: "Now", to: "/now", icon: Circle, primary: true },
  { label: "Weekly", to: "/weekly", icon: ListChecks },
  { label: "Tracks", to: "/tracks", icon: CalendarCheck, primary: true },
  { label: "Side Quests", to: "/side-quests", icon: Compass },
  { label: "Photos", to: "/photos", icon: PhotosIcon },
  { label: "Insights", to: "/insights", icon: Sparkles },
  { label: "Observatory", to: "/observatory", icon: Star, primary: true, barIcon: Orbit },
];

export const PRIMARY_NAV: NavEntry[] = NAV.filter((n) => n.primary);
export const SECONDARY_NAV: NavEntry[] = NAV.filter((n) => !n.primary);

// The Journal item stays highlighted on the home page and on any single day.
export function isActive(to: string, pathname: string): boolean {
  if (to === "/") return pathname === "/" || pathname.startsWith("/day/");
  return pathname === to || pathname.startsWith(to + "/");
}