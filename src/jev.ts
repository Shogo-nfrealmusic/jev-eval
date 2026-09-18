import { experimental_evaluate as evaluate } from "ai";
import { QUESTIONS, type Category } from "./types.ts";
import { errorMessage, gatewayCost, type CallResult } from "./common.ts";

export const JEV_MODEL = "typesafe-ai/jev";

export async function callJev(text: string): Promise<CallResult> {
  const t0 = performance.now();
  try {
    // リトライは LLM 側と同じく 0 回（条件を揃える）
    const r = await evaluate({ model: JEV_MODEL, state: text, questions: QUESTIONS, maxRetries: 0 });
    const latencyMs = performance.now() - t0;
    const a = r.answers;
    return {
      model: r.response.modelId,
      latencyMs,
      ok: true,
      prediction: {
        category: a.category.choice as Category,
        categoryProbs: a.category.probabilities,
        urgency: a.urgency.score,
        urgencyProbs: a.urgency.probabilities,
        needsHumanProb: a.needs_human.probability,
      },
      usage: { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens },
      costUsd: gatewayCost(r.providerMetadata),
      raw: { answers: r.answers, usage: r.usage, providerMetadata: r.providerMetadata, warnings: r.warnings, rounding: r.rounding, responseId: r.response.id },
    };
  } catch (e) {
    return { model: JEV_MODEL, latencyMs: performance.now() - t0, ok: false, error: errorMessage(e) };
  }
}
