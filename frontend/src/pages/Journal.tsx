import { Navigate, useParams } from "react-router-dom";
import JournalDay from "../components/JournalDay";
import { getJournalToday, parseDayKey } from "../config/dates";

// "/" is today. "/day/2026-09-10" is any other day. A date that doesn't exist goes home.
export default function Journal() {
  const { date } = useParams<{ date: string }>();
  const day = date ?? getJournalToday();

  if (!parseDayKey(day)) return <Navigate to="/" replace />;

  return <JournalDay key={day} day={day} />;
}