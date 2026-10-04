import { env } from "../config/env";
import { AINotConfiguredError } from "./provider";
import type { AIProvider, JsonRequest } from "./provider";

const CHAT_TIMEOUT_MS = 40_000;
const EMBED_TIMEOUT_MS = 45_000;

function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vector.map((x) => x / norm);
}

// Some embedding endpoints return one vector per text, others one vector per token.
// Either way we end with a single unit-length vector per text.
function toVector(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("Unexpected embedding shape");
  if (typeof raw[0] === "number") return normalize(raw as number[]);

  const rows = raw as number[][];
  const first = rows[0];
  if (!first || first.length === 0) throw new Error("Unexpected embedding shape");

  const sum = new Array<number>(first.length).fill(0);
  for (const row of rows) {
    row.forEach((value, i) => {
      sum[i] = (sum[i] ?? 0) + value;
    });
  }
  return normalize(sum.map((x) => x / rows.length));
}

export class HostedProvider implements AIProvider {
  async completeJson(request: JsonRequest): Promise<unknown> {
    if (!env.aiApiKey) throw new AINotConfiguredError("AI_API_KEY is not set");

    const body: Record<string, unknown> = {
      model: request.tier === "fast" ? env.aiFastModel : env.aiSmartModel,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_completion_tokens: request.maxTokens ?? 3000,
    };
    if (env.aiReasoningEffort) body.reasoning_effort = env.aiReasoningEffort;

    const response = await fetch(`${env.aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.aiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });

    // Only the status is reported: the response may echo journal text.
    if (!response.ok) throw new Error(`AI request failed (${response.status})`);

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI returned an empty reply");
    return parseJsonLoose(content);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!env.embeddingApiKey) throw new AINotConfiguredError("EMBEDDING_API_KEY is not set");

    const response = await fetch(env.embeddingUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.embeddingApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`Embedding request failed (${response.status})`);

    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length !== texts.length) throw new Error("Unexpected embedding response");
    return data.map(toVector);
  }
}