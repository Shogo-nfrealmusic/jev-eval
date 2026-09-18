// Jev と比較用LLMが Gateway 経由で呼べるかだけを確認する使い捨てスクリプト
import { experimental_evaluate as evaluate, generateObject } from "ai";
import { z } from "zod";

try { process.loadEnvFile(".env.local"); } catch {}
if (!process.env.AI_GATEWAY_API_KEY?.startsWith("vck_")) {
  console.error("AI_GATEWAY_API_KEY (vck_...) が .env.local にありません");
  process.exit(1);
}

const state = "Hi, our flight got cancelled due to the typhoon. Can we move tomorrow's shoot to Saturday?";

try {
  const t0 = performance.now();
  const r = await evaluate({
    model: "typesafe-ai/jev",
    state,
    maxRetries: 0,
    questions: {
      category: {
        type: "choice",
        instructions: "Which category does this inquiry belong to?",
        criteria: { reschedule: "Change the date/time", weather: "Weather-related consultation", cancel: null },
      },
      urgency: { type: "score", instructions: "How urgent is this?", criteria: ["not urgent", "urgent"] },
      needs_human: { type: "boolean", instructions: "Should a human review this?" },
    },
  });
  console.log("JEV OK", Math.round(performance.now() - t0), "ms");
  console.log(JSON.stringify({ answers: r.answers, usage: r.usage, modelId: r.response.modelId, providerMetadata: r.providerMetadata, warnings: r.warnings }, null, 2));
} catch (e: any) {
  console.error("JEV FAILED:", e?.name, e?.statusCode, e?.message, e?.responseBody ?? "");
}

for (const model of ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"]) {
  try {
    const r = await generateObject({ model, maxRetries: 0, prompt: state, schema: z.object({ category: z.enum(["reschedule", "weather", "cancel"]) }) });
    console.log("LLM OK", model, r.object, r.usage, r.providerMetadata?.gateway ?? "");
  } catch (e: any) {
    console.error("LLM FAILED", model, e?.statusCode, e?.message);
  }
}
