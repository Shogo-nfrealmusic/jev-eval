// jev.ts / baseline.ts が返す共通の形
import type { Category } from "./types.ts";

export type Prediction = {
  category: Category;
  /** Jev のみ。LLM は確率を返さないので undefined */
  categoryProbs?: Record<string, number> | undefined;
  /** 0〜1。0.5 以上を high とみなす */
  urgency: number;
  urgencyProbs?: Record<string, number> | undefined;
  /** Jev は P(true)、LLM は true/false を 1/0 で入れる */
  needsHumanProb: number;
};

export type CallResult = {
  model: string;
  latencyMs: number;
  ok: boolean;
  error?: string;
  prediction?: Prediction;
  usage?: { inputTokens: number | undefined; outputTokens: number | undefined };
  /** Gateway が返す実費（USD）。取れなければ undefined */
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
