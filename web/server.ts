// デモ用サーバー（Node 標準の http + SSE のみ）。
//   npm run demo        リプレイ: 計測済みの結果を、実測 ms どおりの時間で再生する
//   npm run demo:live   ライブ: その場で Jev と LLM を呼ぶ（表示用。計測結果には混ぜない）
import { createServer, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { DEMO_CASE_IDS } from "../src/demo-cases.ts";
import { CASES } from "../src/data.ts";

const LIVE = process.argv.includes("--live");
const PORT = Number(process.env.PORT ?? 5173);
// リプレイで使う周。1周目の実測値をそのまま使う（中央値などの加工はしない）
const REPLAY_ROUND = 1;

const summary = JSON.parse(readFileSync("results/summary.json", "utf8"));
// 比較相手を替えた追加計測（あれば最終パネルに併記する）
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
  // 画面上の待ち時間 = 実測レイテンシ
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
    // 追加計測は同じ run 内の Jev と比較する（本計測の Jev とは混ぜない）
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

  // 左右のレーンを同時に流す。各レーン内は直列。
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
