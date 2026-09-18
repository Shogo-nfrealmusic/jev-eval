// Runs Jev and the LLM serially under identical conditions and saves raw responses to results/raw/<runId>/.
//   npx tsx src/run.ts                 all 60 cases × 3 rounds
//   npx tsx src/run.ts --limit 3 --rounds 1   quick sanity check
//   npx tsx src/run.ts --subset large20 --rounds 1 --llm anthropic/claude-sonnet-4.5   extra run against a different comparison model
import { mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CASES } from "./data.ts";
import { SUBSETS } from "./subsets.ts";
import { callJev, JEV_MODEL } from "./jev.ts";
import { callBaseline, BASELINE_MODEL } from "./baseline.ts";
import type { CallResult } from "./common.ts";

try { process.loadEnvFile(".env.local"); } catch {}
if (!process.env.AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is missing from .env.local");

const { values } = parseArgs({
  options: {
    rounds: { type: "string", default: "3" },
    limit: { type: "string" },
    subset: { type: "string" },
    llm: { type: "string", default: BASELINE_MODEL },
  },
});
const rounds = Number(values.rounds);
const llmModel = values.llm;
let cases = CASES;
if (values.subset) {
  const ids = SUBSETS[values.subset];
  if (!ids) throw new Error(`unknown subset: ${values.subset}`);
  cases = ids.map((id) => CASES.find((c) => c.id === id)!);
}
if (values.limit) cases = cases.slice(0, Number(values.limit));

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const dir = `results/raw/${runId}`;
mkdirSync(dir, { recursive: true });

const systems = {
  jev: (text: string) => callJev(text),
  llm: (text: string) => callBaseline(text, llmModel),
} as const;
type System = keyof typeof systems;

writeFileSync(`${dir}/meta.json`, JSON.stringify({
  runId, startedAt: new Date().toISOString(), rounds, nCases: cases.length, subset: values.subset ?? null, caseIds: cases.map((c) => c.id),
  models: { jev: JEV_MODEL, llm: llmModel }, aiSdk: (await import("ai/package.json", { with: { type: "json" } })).default.version,
  node: process.version,
}, null, 2));

function record(system: System, round: number, caseId: string, r: CallResult) {
  appendFileSync(`${dir}/${system}.jsonl`, JSON.stringify({ system, round, caseId, ...r }) + "\n");
}

// Warm-up: call each system once and discard (saved, but not scored)
for (const s of Object.keys(systems) as System[]) {
  const first = cases[0]!;
  const r = await systems[s](first.text);
  record(s, 0, `warmup:${first.id}`, r);
  console.log(`warmup ${s}: ${r.ok ? "ok" : r.error} ${Math.round(r.latencyMs)}ms`);
}

// Main run: serial. Same input order for both. Alternate which system goes first per case to cancel ordering bias.
for (let round = 1; round <= rounds; round++) {
  for (const [i, c] of cases.entries()) {
    const order: System[] = (i + round) % 2 === 0 ? ["jev", "llm"] : ["llm", "jev"];
    const line: string[] = [];
    for (const s of order) {
      const r = await systems[s](c.text);
      record(s, round, c.id, r);
      line.push(`${s}=${r.ok ? `${r.prediction!.category}` : "ERR"}(${Math.round(r.latencyMs)}ms)`);
    }
    console.log(`r${round} ${c.id} expected=${c.expected.category} ${line.join(" ")}`);
  }
}

writeFileSync(`${dir}/meta.json`, JSON.stringify({
  ...JSON.parse((await import("node:fs")).readFileSync(`${dir}/meta.json`, "utf8")),
  finishedAt: new Date().toISOString(),
}, null, 2));
console.log(`saved: ${dir}`);
