import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppShell() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
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
    <div className="relative h-dvh w-full overflow-hidden bg-desktop p-2 sm:p-4 lg:p-6">
      <div className="starfield" aria-hidden="true" />

      <div className="relative z-10 flex h-full overflow-hidden rounded-2xl border-[1.5px] border-window bg-bg text-text shadow-window">
        <aside className="hidden w-[320px] shrink-0 border-r border-border bg-surface/80 backdrop-blur-xl lg:block">
          <Sidebar />
        </aside>

        <div
          className={"fixed inset-0 z-40 lg:hidden " + (drawerOpen ? "" : "pointer-events-none")}
          inert={!drawerOpen}
        >
          <div
            onClick={() => setDrawerOpen(false)}
            className={
              "absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 " +
              (drawerOpen ? "opacity-100" : "opacity-0")
            }
          />
          <aside
            aria-label="Navigation"
            className={
              "absolute left-0 top-0 h-full w-[320px] max-w-[85vw] border-r border-border bg-surface shadow-card transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] " +
              (drawerOpen ? "translate-x-0" : "-translate-x-full")
            }
          >
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
            <div className="flex h-12 items-center gap-2 px-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-hover hover:text-text"
              >
                <Menu size={20} strokeWidth={1.75} />
              </button>
              <span className="text-[15px] font-semibold tracking-tight">Harsh&apos;s Journal</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div key={pathname} className="page-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}