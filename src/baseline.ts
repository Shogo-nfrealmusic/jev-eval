import { generateObject } from "ai";
import { z } from "zod";
import { CATEGORIES, QUESTIONS } from "./types.ts";
import { errorMessage, gatewayCost, type CallResult } from "./common.ts";

export const BASELINE_MODEL = "openai/gpt-4o-mini";

// Pass the same QUESTIONS given to Jev, serialized as JSON as-is. No LLM-only tweaks.
const schema = z.object({
  category: z.enum(CATEGORIES).describe(QUESTIONS.category.instructions),
  urgency: z
    .number()
    .min(0)
    .max(1)
    .describe(`${QUESTIONS.urgency.instructions} 0 = level 0, 1 = level 1 (fractional values allowed).`),
  needs_human: z.boolean().describe(QUESTIONS.needs_human.instructions),
});

function buildPrompt(text: string): string {
  return `State:\n${text}\n\nQuestions:\n${JSON.stringify(QUESTIONS, null, 2)}`;
}

export async function callBaseline(text: string, model = BASELINE_MODEL): Promise<CallResult> {
  const prompt = buildPrompt(text);
  const t0 = performance.now();
  try {
    const r = await generateObject({ model, schema, prompt, maxRetries: 0 });
    const latencyMs = performance.now() - t0;
    return {
      model: r.response.modelId ?? model,
      latencyMs,
      ok: true,
      prediction: {
        category: r.object.category,
        urgency: r.object.urgency,
        needsHumanProb: r.object.needs_human ? 1 : 0,
      },
      usage: { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens },
      costUsd: gatewayCost(r.providerMetadata),
      raw: { object: r.object, usage: r.usage, providerMetadata: r.providerMetadata, finishReason: r.finishReason, responseId: r.response.id },
    };
  } catch (e) {
    return { model, latencyMs: performance.now() - t0, ok: false, error: errorMessage(e) };
  }
}
