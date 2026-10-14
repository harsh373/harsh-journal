import {
  BookOpen,
  CalendarCheck,
  Compass,
  Image as PhotosIcon,
  ListChecks,
  Map as MapIcon,
  Orbit,
  Sparkles,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavEntry {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
  /** Position in the mobile bottom bar (lowest first). The sidebar ignores it. */
  barOrder?: number;
  
  barIcon?: LucideIcon;
}


export const NAV: NavEntry[] = [
  { label: "Journal", to: "/", icon: BookOpen, primary: true, barOrder: 1 },
  { label: "ElseWhere", to: "/map-room", icon: MapIcon, primary: true, barOrder: 4 },
  { label: "Weekly", to: "/weekly", icon: ListChecks },
  { label: "Tracks", to: "/tracks", icon: CalendarCheck, primary: true, barOrder: 2 },
  { label: "Side Quests", to: "/side-quests", icon: Compass },
  { label: "Photos", to: "/photos", icon: PhotosIcon },
  { label: "Insights", to: "/insights", icon: Sparkles },
  { label: "Observatory", to: "/observatory", icon: Star, primary: true, barOrder: 3, barIcon: Orbit },
];

export const PRIMARY_NAV: NavEntry[] = NAV.filter((n) => n.primary).sort(
  (a, b) => (a.barOrder ?? 99) - (b.barOrder ?? 99),
);
export const SECONDARY_NAV: NavEntry[] = NAV.filter((n) => !n.primary);

// The Journal item stays highlighted on the home page and on any single day.
export function isActive(to: string, pathname: string): boolean {
  if (to === "/") return pathname === "/" || pathname.startsWith("/day/");
  return pathname === to || pathname.startsWith(to + "/");
}