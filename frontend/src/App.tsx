import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { MoodProvider } from "./components/MoodProvider";
import { useNoAutofill } from "./config/useNoAutofill";
import Archive from "./pages/Archive";
import Gate from "./pages/Gate";
import Insights from "./pages/Insights";
import InsightsMemory from "./pages/InsightsMemory";
import InsightsOpenLoops from "./pages/InsightsOpenLoops";
import Journal from "./pages/Journal";
import Photos from "./pages/Photos";
import Placeholder from "./pages/Placeholder";
import SideQuestDetail from "./pages/SideQuestDetail";
import SideQuests from "./pages/SideQuests";
import TrackDetail from "./pages/TrackDetail";
import Tracks from "./pages/Tracks";
import Weekly from "./pages/Weekly";
import WakePage from "./pages/WakePage";
import Now from "./pages/Now";
import NowArchive from "./pages/NowArchive";

// Same floating window the rest of the app lives in, so the lock screen matches.
function GateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="desktop-backdrop h-dvh w-full overflow-hidden lg:p-7 xl:p-9">
      <div className="relative mx-auto flex h-full w-full overflow-hidden bg-bg text-text lg:max-w-[1440px] lg:rounded-[22px] lg:border lg:border-window lg:shadow-window">
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { status } = useAuth();

  if (status === "loading") return null;
  if (status === "locked")
    return (
      <GateFrame>
        <Gate />
      </GateFrame>
    );

  return (
    <MoodProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Journal />} />
          <Route path="day/:date" element={<Journal />} />
          <Route path="archive" element={<Archive />} />
          <Route path="weekly" element={<Weekly />} />
          <Route path="now" element={<Now />} />
          <Route path="now/archive" element={<NowArchive />} />
          <Route path="scenarios" element={<Placeholder title="Scenarios" />} />
          <Route path="side-quests" element={<SideQuests />} />
          <Route path="tracks" element={<Tracks />} />
          <Route path="tracks/:id" element={<TrackDetail />} />
          <Route path="side-quests/:id" element={<SideQuestDetail />} />
          <Route path="photos" element={<Photos />} />
          <Route path="stats" element={<Placeholder title="Stats" />} />
          <Route path="search" element={<Placeholder title="Search" />} />
          <Route path="insights" element={<Insights />} />
          <Route path="insights/memory" element={<InsightsMemory />} />
          <Route path="insights/open-loops" element={<InsightsOpenLoops />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MoodProvider>
  );
}

export default function App() {
  useNoAutofill();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/wake" element={<WakePage />} />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}