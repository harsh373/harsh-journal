import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

// Pages that fill the whole window on phones and manage their own scrolling there.
// On laptop (lg and up) they sit inside the shell like any other page.
const FULL_BLEED_PATHS = ["/map-room","/circle"];

export default function AppShell() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const fullBleed = FULL_BLEED_PATHS.includes(pathname);

  // Close the mobile drawer and reset scroll whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="desktop-backdrop h-dvh w-full overflow-hidden lg:p-7 xl:p-9">
      {/* One window. Full-screen below 1024px, floating framed window above. */}
      <div className="relative mx-auto flex h-full w-full overflow-hidden bg-bg text-text lg:max-w-[1440px] lg:rounded-[22px] lg:border lg:border-window lg:shadow-window">
        {/* Logo in the window's top-left corner. Decorative only, not a control. */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute left-5 top-[9px] z-20 hidden h-6 w-6 select-none rounded-[6px] object-contain lg:block"
        />

        {/* Desktop sidebar. pt-11 leaves the top strip for the logo. Unchanged. */}
        <aside className="hidden w-[280px] shrink-0 border-r border-border bg-sidebar pt-11 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer: everything except the four destinations in the bottom bar. */}
        <div
          className={"fixed inset-0 z-40 lg:hidden " + (drawerOpen ? "" : "pointer-events-none")}
          inert={!drawerOpen}
        >
          <div
            onClick={() => setDrawerOpen(false)}
            className={
              "absolute inset-0 bg-black/35 transition-opacity duration-300 " +
              (drawerOpen ? "opacity-100" : "opacity-0")
            }
          />
          <aside
            aria-label="Navigation"
            className={
              "absolute left-0 top-0 h-full w-[300px] max-w-[85vw] rounded-r-[20px] border-r border-border bg-sidebar pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[8px_0_40px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] " +
              (drawerOpen ? "translate-x-0" : "-translate-x-full")
            }
          >
            <Sidebar variant="drawer" onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar. */}
          <header className="border-b border-border bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
            <div className="flex h-12 items-center gap-1 px-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-hover hover:text-text active:bg-selected"
              >
                <Menu size={20} strokeWidth={1.75} />
              </button>
              <span className="text-[15px] font-semibold tracking-tight">Harsh&apos;s Journal</span>
            </div>
          </header>

          {/* Normal pages scroll here and pad by the bottom bar's measured height.
              On phones, full-bleed pages (the Map Room) fill this area, never scroll the
              page, and run underneath the floating bar, so they get no bottom padding.
              From lg up there is no floating bar, so every page uses the normal shell. */}
          <main
            ref={mainRef}
            className={
              "min-h-0 flex-1 overscroll-contain " +
              (fullBleed
                ? "overflow-hidden lg:p-5 lg:pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
                : "overflow-y-auto pb-[calc(var(--bottom-nav-space,0px)+env(safe-area-inset-bottom))] lg:pb-[env(safe-area-inset-bottom)]")
            }
          >
            <div
              key={pathname}
              className={
                "page-in " +
                (fullBleed
                  ? "h-full lg:overflow-hidden lg:rounded-[16px] lg:border lg:border-border"
                  : "")
              }
            >
              <Outlet />
            </div>
          </main>
        </div>

        {/* Floating glass bar. Phones and small tablets only (hidden from lg up). */}
        <BottomNav scrollRef={mainRef} />
      </div>
    </div>
  );
}