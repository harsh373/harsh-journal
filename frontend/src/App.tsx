import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { MoodProvider } from "./components/MoodProvider";
import Archive from "./pages/Archive";
import Gate from "./pages/Gate";
import Journal from "./pages/Journal";
import Photos from "./pages/Photos";
import Placeholder from "./pages/Placeholder";
import SideQuestDetail from "./pages/SideQuestDetail";
import SideQuests from "./pages/SideQuests";
import TrackDetail from "./pages/TrackDetail";
import Tracks from "./pages/Tracks";

function AppRoutes() {
  const { status } = useAuth();

  if (status === "loading") return null;
  if (status === "locked") return <Gate />;

  return (
    <MoodProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Journal />} />
            <Route path="day/:date" element={<Journal />} />
            <Route path="archive" element={<Archive />} />
            <Route path="scenarios" element={<Placeholder title="Scenarios" />} />
            <Route path="side-quests" element={<SideQuests />} />
            <Route path="tracks" element={<Tracks />} />
            <Route path="tracks/:id" element={<TrackDetail />} />
            <Route path="side-quests/:id" element={<SideQuestDetail />} />
            <Route path="photos" element={<Photos />} />
            <Route path="stats" element={<Placeholder title="Stats" />} />
            <Route path="search" element={<Placeholder title="Search" />} />
            <Route path="settings" element={<Placeholder title="Settings" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MoodProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}