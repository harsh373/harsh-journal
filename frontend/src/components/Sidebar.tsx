import {
  BookOpen,
  ChartColumn,
  Compass,
  Image as PhotosIcon,
  Lightbulb,
  Lock,
  Moon,
  Search,
  Settings,
  Sun,
  CalendarCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom";
import { getJournalToday } from "../config/dates";
import { useTheme } from "../config/theme";
import { useAuth } from "./AuthProvider";
import MiniCalendar from "./MiniCalendar";
import { useMoods } from "./MoodProvider";

const VERSION = "v0.1";

interface NavEntry {
  label: string;
  to: string;
  icon: LucideIcon;
}

const NAV: NavEntry[] = [
  { label: "Journal", to: "/", icon: BookOpen },
  { label: "Tracks", to: "/tracks", icon: CalendarCheck },
  { label: "Side Quests", to: "/side-quests", icon: Compass },
  { label: "Photos", to: "/photos", icon: PhotosIcon },
  { label: "Stats", to: "/stats", icon: ChartColumn },
  { label: "Search", to: "/search", icon: Search },
  { label: "Settings", to: "/settings", icon: Settings },
];

// The Journal item stays highlighted on the home page and on any single day.
function isActive(to: string, pathname: string): boolean {
  if (to === "/") return pathname === "/" || pathname.startsWith("/day/");
  return pathname === to || pathname.startsWith(to + "/");
}

const iconButton =
  "flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors duration-150 hover:bg-hover hover:text-text";

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dayMatch = useMatch("/day/:date");
  const { theme, toggleTheme } = useTheme();
  const { lock } = useAuth();
  const { moods, loadMonth } = useMoods();

  const today = getJournalToday();
  const selected = dayMatch?.params.date ?? today;

  function openDay(day: string) {
    navigate(day === today ? "/" : "/day/" + day);
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
      <div className="px-5 pb-4 pt-6">
        <h1 className="text-[15px] font-semibold tracking-tight">Harsh&apos;s Journal</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        <nav aria-label="Main" className="space-y-0.5 px-3">
          {NAV.map(({ label, to, icon: Icon }) => {
            const active = isActive(to, pathname);
            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150 " +
                  (active ? "bg-selected font-medium text-text" : "text-text/80 hover:bg-hover")
                }
              >
                <Icon size={16} strokeWidth={1.75} className={active ? "text-text" : "text-secondary"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-5 my-4 h-px bg-border" />

        <div className="px-4">
          <MiniCalendar
            selected={selected}
            today={today}
            moods={moods}
            onSelect={openDay}
            onViewChange={loadMonth}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <span className="text-[11px] text-tertiary">{VERSION}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void lock()}
            aria-label="Lock journal"
            title="Lock journal"
            className={iconButton}
          >
            <Lock size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className={iconButton}
          >
            {theme === "dark" ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          </button>
        </div>
      </div>
    </div>
  );
}