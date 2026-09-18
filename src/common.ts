// Common shape returned by jev.ts / baseline.ts
import type { Category } from "./types.ts";

export type Prediction = {
  category: Category;
  /** Jev only. undefined for the LLM, which returns no probabilities */
  categoryProbs?: Record<string, number> | undefined;
  /** 0 to 1. 0.5 or above counts as high */
  urgency: number;
  urgencyProbs?: Record<string, number> | undefined;
  /** Jev: P(true). LLM: true/false stored as 1/0 */
  needsHumanProb: number;
};

export type CallResult = {
  model: string;
  latencyMs: number;
  ok: boolean;
  error?: string;
  prediction?: Prediction;
  usage?: { inputTokens: number | undefined; outputTokens: number | undefined };
  /** Actual cost (USD) reported by the Gateway. undefined if unavailable */
  costUsd?: number | undefined;
  raw?: unknown;
};

export function gatewayCost(providerMetadata: any): number | undefined {
  const c = providerMetadata?.gateway?.cost;
  return c === undefined ? undefined : Number(c);
}

export function errorMessage(e: any): string {
  return [e?.name, e?.statusCode, e?.message].filter(Boolean).join(" ");
}
