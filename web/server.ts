// Demo server (Node built-in http + SSE only).
//   npm run demo        replay: plays back measured results with the actual measured ms timing
//   npm run demo:live   live: calls the models on the spot (display only; never mixed into measured results)
import { createServer, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { DEMO_CASE_IDS } from "../src/demo-cases.ts";
import { CASES } from "../src/data.ts";

const LIVE = process.argv.includes("--live");
const PORT = Number(process.env.PORT ?? 5173);
// Round used for replay. Uses round 1 measurements as-is (no median or other processing)
const REPLAY_ROUND = 1;

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
// Main run: Jev vs gpt-4o-mini
const main = { summary: readJson("results/summary.json"), perCase: readJson("results/per-case.json") as any[] };
// Claude run: Jev vs claude-sonnet-4.5, same conditions and size (lane is shown only if present)
const claude = existsSync("results/summary-sonnet60.json")
  ? { summary: readJson("results/summary-sonnet60.json"), perCase: readJson("results/per-case-sonnet60.json") as any[] }
  : null;

type Run = typeof main;
type LaneDef = { key: string; name: string; model: string; run: Run; system: "jev" | "llm" };
const LANES: LaneDef[] = [
  { key: "jev", name: "JEV", model: main.summary.jev.model, run: main, system: "jev" },
  { key: "gpt", name: "GPT-4o-mini", model: main.summary.llm.model, run: main, system: "llm" },
  ...(claude ? [{ key: "claude", name: "Claude Sonnet 4.5", model: claude.summary.llm.model, run: claude, system: "llm" as const }] : []),
];

const demo = DEMO_CASE_IDS.map((id) => {
  const c = CASES.find((x) => x.id === id)!;
  return { id: c.id, lang: c.lang, hard: c.hard, text: c.text, expected: c.expected.category };
});

type Outcome = { ok: boolean; error?: string | undefined; latencyMs: number; category?: string | undefined; categoryProbs?: Record<string, number> | undefined; costUsd?: number | undefined };

async function replay(lane: LaneDef, id: string): Promise<Outcome> {
  const run = lane.run.perCase.find((c) => c.id === id)!.runs[lane.system].find((r: any) => r.round === REPLAY_ROUND);
  // On-screen wait time = measured latency
  await sleep(run.latencyMs);
  return run;
}

async function live(lane: LaneDef, text: string): Promise<Outcome> {
  const { callJev } = await import("../src/jev.ts");
  const { callBaseline } = await import("../src/baseline.ts");
  const r = lane.system === "jev" ? await callJev(text) : await callBaseline(text, lane.model);
  return { ok: r.ok, error: r.error, latencyMs: Math.round(r.latencyMs), category: r.prediction?.category, categoryProbs: r.prediction?.categoryProbs, costUsd: r.costUsd };
}

function stats(s: any, system: "jev" | "llm") {
  return { accuracy: s[system].category.strict.pct, p50: s[system].latencyMs.p50, per1000: s[system].cost.per1000Usd };
}

function finalStats() {
  const m = main.summary;
  return {
    source: `Measured: ${m.nCases} cases × ${m.rounds} rounds per model, ${m.startedAt.slice(0, 10)}`,
    rows: [
      { name: "Jev", jev: true, ...stats(m, "jev") },
      { name: "GPT-4o-mini", ...stats(m, "llm") },
      ...(claude ? [{ name: "Claude Sonnet 4.5", ...stats(claude.summary, "llm") }] : []),
    ],
    // Ratios compare against Jev from the same run (each comparison model was measured in its own run, interleaved with Jev)
    ratios: [
      { vs: "GPT-4o-mini", jev: stats(m, "jev"), other: stats(m, "llm") },
      ...(claude ? [{ vs: "Claude Sonnet 4.5", jev: stats(claude.summary, "jev"), other: stats(claude.summary, "llm") }] : []),
    ],
  };
}

async function stream(res: ServerResponse) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({
    type: "meta", live: LIVE, total: demo.length, nAll: main.summary.nCases, date: main.summary.startedAt.slice(0, 10), round: REPLAY_ROUND,
    lanes: LANES.map(({ key, name, model }) => ({ key, name, model })),
  });

  // Stream all lanes concurrently. Serial within each lane.
  await Promise.all(LANES.map(async (lane) => {
    for (const [i, c] of demo.entries()) {
      send({ type: "start", lane: lane.key, i, case: c });
      const out = LIVE ? await live(lane, c.text) : await replay(lane, c.id);
      send({ type: "result", lane: lane.key, i, expected: c.expected, correct: out.ok && out.category === c.expected, ...out });
    }
    send({ type: "laneDone", lane: lane.key });
  }));
  send({ type: "final", ...finalStats() });
  res.end();
}

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path === "/events") return void stream(res);
  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return void res.end(readFileSync("web/index.html"));
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log(`${LIVE ? "LIVE" : "REPLAY"} demo: http://localhost:${PORT}  (click or press Space to start)`));
