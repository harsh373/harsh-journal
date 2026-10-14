import { api } from "./api";

export const QUOTE_LIMITS = { text: 2000, author: 120, note: 500 } as const;

export interface Quote {
  id: string;
  text: string;
  author: string;
  note: string;
  // Where the landmark sits in the world. Visual only; it carries no meaning.
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}

// The parts you write. The editor saves exactly these.
export interface QuoteFields {
  text: string;
  author: string;
  note: string;
}

export async function fetchQuotes(): Promise<Quote[]> {
  const { data } = await api.get<{ quotes: Quote[] }>("/quotes");
  return data.quotes;
}

// clientKey makes a retry safe: if the first request got through but the reply was lost,
// sending it again returns the same quote instead of creating a duplicate.
export async function createQuote(fields: QuoteFields & { x: number; y: number; clientKey: string }): Promise<Quote> {
  const { data } = await api.post<{ quote: Quote }>("/quotes", fields);
  return data.quote;
}

export async function updateQuote(id: string, fields: QuoteFields): Promise<Quote> {
  const { data } = await api.put<{ quote: Quote }>(`/quotes/${id}`, fields);
  return data.quote;
}

export async function deleteQuote(id: string): Promise<void> {
  await api.delete(`/quotes/${id}`);
}