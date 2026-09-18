// Demo server (Node built-in http + SSE only).
//   npm run demo        replay: plays back measured results with the actual measured ms timing
//   npm run demo:live   live: calls Jev and the LLM on the spot (display only; never mixed into measured results)
import { createServer, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { DEMO_CASE_IDS } from "../src/demo-cases.ts";
import { CASES } from "../src/data.ts";

const LIVE = process.argv.includes("--live");
const PORT = Number(process.env.PORT ?? 5173);
// Round used for replay. Uses round 1 measurements as-is (no median or other processing)
const REPLAY_ROUND = 1;

const summary = JSON.parse(readFileSync("results/summary.json", "utf8"));
// Extra run with a different comparison model (shown alongside in the final panel if present)
const summarySonnet = existsSync("results/summary-sonnet.json") ? JSON.parse(readFileSync("results/summary-sonnet.json", "utf8")) : null;
const perCase: any[] = JSON.parse(readFileSync("results/per-case.json", "utf8"));
const demo = DEMO_CASE_IDS.map((id) => {
  const c = CASES.find((x) => x.id === id)!;
  return { id: c.id, lang: c.lang, hard: c.hard, text: c.text, expected: c.expected.category };
});

type Lane = "jev" | "llm";
type Outcome = { ok: boolean; error?: string | undefined; latencyMs: number; category?: string | undefined; categoryProbs?: Record<string, number> | undefined; costUsd?: number | undefined };

async function replay(lane: Lane, id: string): Promise<Outcome> {
  const run = perCase.find((c) => c.id === id)!.runs[lane].find((r: any) => r.round === REPLAY_ROUND);
  // On-screen wait time = measured latency
  await sleep(run.latencyMs);
  return run;
}

async function live(lane: Lane, text: string): Promise<Outcome> {
  const { callJev } = await import("../src/jev.ts");
  const { callBaseline } = await import("../src/baseline.ts");
  const r = lane === "jev" ? await callJev(text) : await callBaseline(text);
  return { ok: r.ok, error: r.error, latencyMs: Math.round(r.latencyMs), category: r.prediction?.category, categoryProbs: r.prediction?.categoryProbs, costUsd: r.costUsd };
}

function finalStats() {
  const j = summary.jev, l = summary.llm;
  return {
    source: `Measured: ${summary.nCases} cases × ${summary.rounds} rounds, run ${summary.startedAt.slice(0, 10)}`,
    accuracy: { jev: j.category.strict.pct, llm: l.category.strict.pct },
    p50: { jev: j.latencyMs.p50, llm: l.latencyMs.p50 },
    per1000: { jev: j.cost.per1000Usd, llm: l.cost.per1000Usd },
    // Extra runs compare against Jev from the same run (not mixed with the main run's Jev)
    alt: summarySonnet && {
      label: "Claude Sonnet 4.5",
      scope: `${summarySonnet.nCases} cases × ${summarySonnet.rounds} round`,
      p50: { jev: summarySonnet.jev.latencyMs.p50, llm: summarySonnet.llm.latencyMs.p50 },
      per1000: { jev: summarySonnet.jev.cost.per1000Usd, llm: summarySonnet.llm.cost.per1000Usd },
    },
  };
}

async function stream(res: ServerResponse) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: "meta", live: LIVE, total: demo.length, nAll: summary.nCases, date: summary.startedAt.slice(0, 10), round: REPLAY_ROUND, models: { jev: summary.jev.model, llm: summary.llm.model } });

  // Stream left and right lanes concurrently. Serial within each lane.
  await Promise.all((["jev", "llm"] as Lane[]).map(async (lane) => {
    for (const [i, c] of demo.entries()) {
      send({ type: "start", lane, i, case: c });
      const out = LIVE ? await live(lane, c.text) : await replay(lane, c.id);
      send({ type: "result", lane, i, expected: c.expected, correct: out.ok && out.category === c.expected, ...out });
    }
    send({ type: "laneDone", lane });
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
