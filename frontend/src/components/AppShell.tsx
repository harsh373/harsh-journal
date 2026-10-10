import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppShell() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

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

        {/* Desktop sidebar. pt-11 leaves the top strip for the logo. */}
        <aside className="hidden w-[280px] shrink-0 border-r border-border bg-sidebar pt-11 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer. */}
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
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
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

          <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <div key={pathname} className="page-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}