import mongoose from "mongoose";
import { analyzeEntry } from "../ai/analyzeEntry";
import { connectDatabase } from "../config/db";
import { JournalEntry } from "../models/JournalEntry";

const PAUSE_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await connectDatabase();
  const entries = await JournalEntry.find().sort({ date: 1 }).select("date").lean();
  console.log(`Found ${entries.length} entries`);

  let done = 0;
  for (const { date } of entries) {
    try {
      const result = await analyzeEntry(date);
      console.log(`${date}: ${result.status}${result.embedded ? "" : " (no embedding)"}`);
      if (result.status === "analyzed") await sleep(PAUSE_MS);
    } catch (error) {
      console.error(`${date}: failed -`, error instanceof Error ? error.message : "unknown error");
    }
    done += 1;
  }

  console.log(`Finished ${done} of ${entries.length}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});