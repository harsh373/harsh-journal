import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Link, useLocation } from "react-router-dom";
import { isActive, PRIMARY_NAV } from "../config/nav";

const BOTTOM_GAP = 12; // space between the bar and the safe area
const CONTENT_GAP = 12; // breathing room between page content and the bar
const COUNT = PRIMARY_NAV.length; // number of items in the bar

const NON_TEXT_INPUTS = ["checkbox", "radio", "button", "submit", "reset", "range", "file", "color", "image"];

function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") return !NON_TEXT_INPUTS.includes((el as HTMLInputElement).type);
  return (el as HTMLElement).isContentEditable === true;
}

// True while the on-screen keyboard is likely open, so the bar can step aside.
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let focused = false;
    let viewportShrunk = false;
    const sync = () => setOpen(focused || viewportShrunk);

    const onFocusIn = (e: FocusEvent) => {
      focused = isTextEntry(e.target as Element);
      sync();
    };
    const onFocusOut = () => {
      // Wait a tick: focus may be moving to another field.
      window.setTimeout(() => {
        focused = isTextEntry(document.activeElement);
        sync();
      }, 0);
    };
    const vv = window.visualViewport;
    const onViewport = () => {
      if (!vv) return;
      viewportShrunk = window.innerHeight - vv.height > 150;
      sync();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onViewport);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onViewport);
    };
  }, []);

  return open;
}

// Like Safari on iPhone: slides away while scrolling down, returns on any scroll up,
// at the top of the page, and on every route change.
function useScrollHidden(scrollRef: RefObject<HTMLElement | null>, pathname: string): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [pathname]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let last = el.scrollTop;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = Math.max(el.scrollTop, 0);
        const delta = y - last;
        if (y < 24) {
          setHidden(false);
          last = y;
        } else if (delta > 10) {
          setHidden(true);
          last = y;
        } else if (delta < -10) {
          setHidden(false);
          last = y;
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollRef]);

  return hidden;
}

interface BottomNavProps {
  /** The element that scrolls the page content (AppShell's <main>). */
  scrollRef: RefObject<HTMLElement | null>;
}

export default function BottomNav({ scrollRef }: BottomNavProps) {
  const { pathname } = useLocation();
  const keyboardOpen = useKeyboardOpen();
  const scrollHidden = useScrollHidden(scrollRef, pathname);
  const away = keyboardOpen || scrollHidden;
  const barRef = useRef<HTMLElement>(null);

  const activeIndex = PRIMARY_NAV.findIndex((n) => isActive(n.to, pathname));

  // Publish the space the bar occupies so <main> can pad itself by the real amount.
  // It is 0 while the bar is hidden so the writing view keeps all its room.
  useEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    if (!bar || keyboardOpen) {
      root.style.setProperty("--bottom-nav-space", "0px");
      return;
    }
    const update = () => {
      const h = bar.getBoundingClientRect().height;
      root.style.setProperty("--bottom-nav-space", `${Math.ceil(h) + BOTTOM_GAP + CONTENT_GAP}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--bottom-nav-space");
    };
  }, [keyboardOpen]);

  return (
    <div
      className={
        "pointer-events-none fixed inset-x-0 z-30 flex justify-center px-5 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden " +
        (away ? "translate-y-[calc(100%+40px)] opacity-0" : "translate-y-0 opacity-100")
      }
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${BOTTOM_GAP}px)` }}
      inert={away}
    >
      <nav
        ref={barRef}
        aria-label="Primary"
        className="glass-nav pointer-events-auto relative grid w-full max-w-[420px] rounded-[26px] p-1.5"
        style={{ gridTemplateColumns: `repeat(${COUNT}, minmax(0, 1fr))` }}
      >
        {/* One capsule that slides to the active item. Hidden on pages outside the bar. */}
        <span
          aria-hidden="true"
          className="glass-nav-active pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-[20px]"
          style={{
            width: `calc((100% - 12px) / ${COUNT})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            opacity: activeIndex === -1 ? 0 : 1,
          }}
        />

        {PRIMARY_NAV.map(({ label, to, icon, barIcon }) => {
          const Icon = barIcon ?? icon;
          const active = isActive(to, pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={
                "group relative z-10 flex h-[54px] flex-col items-center justify-center gap-[3px] rounded-[20px] transition-colors duration-200 " +
                (active ? "text-text" : "text-secondary hover:text-text")
              }
            >
              <span className="flex flex-col items-center gap-[3px] transition-transform duration-150 group-active:scale-[0.92]">
                <Icon size={22} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none tracking-[0.01em]">{label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}