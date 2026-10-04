export type ModelTier = "fast" | "smart";

export interface JsonRequest {
  tier: ModelTier;
  system: string;
  user: string;
  maxTokens?: number;
}

export interface AIProvider {
  // Ask a chat model for a JSON answer and return it parsed.
  completeJson(request: JsonRequest): Promise<unknown>;
  // Turn texts into unit-length vectors for similarity search.
  embed(texts: string[]): Promise<number[][]>;
}

export class AINotConfiguredError extends Error {}