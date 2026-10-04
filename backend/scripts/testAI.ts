import { ai } from "../ai";

async function main() {
  const reply = await ai.completeJson({
    tier: "fast",
    system: 'Reply with the JSON object {"ok": true} and nothing else.',
    user: "ping",
    maxTokens: 500,
  });
  console.log("Chat model reply:", JSON.stringify(reply));

  const vectors = await ai.embed(["a short test sentence"]);
  const vector = vectors[0];
  if (!vector) throw new Error("No embedding came back");
  console.log("Embedding length:", vector.length);
}

main().catch((error) => {
  console.error("AI test failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});