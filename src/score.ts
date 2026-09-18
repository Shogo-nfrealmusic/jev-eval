// results/raw/<runId>/ を集計して results/summary.json と results/per-case.json を出す。
//   npx tsx src/score.ts            最新の run を集計
//   npx tsx src/score.ts <runId>
//   npx tsx src/score.ts <runId> <name>   results/summary-<name>.json / per-case-<name>.json に出す（追加計測用）
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { CASES } from "./data.ts";
import { CATEGORIES, type Case, type Category } from "./types.ts";
import type { CallResult } from "./common.ts";

type Row = CallResult & { system: "jev" | "llm"; round: number; caseId: string };
const SYSTEMS = ["jev", "llm"] as const;

const outName = process.argv[3];
const suffix = outName ? `-${outName}` : "";
const runId = process.argv[2] ?? readdirSync("results/raw").filter((d) => !d.startsWith(".")).sort().at(-1)!;
const dir = `results/raw/${runId}`;
const meta = JSON.parse(readFileSync(`${dir}/meta.json`, "utf8"));
const RUN_CASES = meta.caseIds ? CASES.filter((c) => meta.caseIds.includes(c.id)) : CASES;
const caseById = new Map(RUN_CASES.map((c) => [c.id, c]));

const load = (s: string): Row[] =>
  readFileSync(`${dir}/${s}.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r: Row) => r.round > 0);

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
};
const median = (xs: number[]) => quantile(xs, 0.5);
const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

const isHigh = (u: number) => u >= 0.5;
const predHuman = (p: number) => p >= 0.5;
const catOk = (c: Case, pred: Category) => pred === c.expected.category;
const catLenient = (c: Case, pred: Category) => catOk(c, pred) || (c.alsoAcceptable ?? []).includes(pred);

function topProb(r: Row): number | undefined {
  const p = r.prediction?.categoryProbs;
  return p ? Math.max(...Object.values(p)) : undefined;
}

function summarize(rows: Row[]) {
  const ok = rows.filter((r) => r.ok);
  const errors = rows.length - ok.length;
  const c = (r: Row) => caseById.get(r.caseId)!;

  // category（厳密 / 準正解込み）、urgency、needs_human は全周をプールして算出。周ごとの値も残す。
  const acc = (pred: (r: Row) => boolean, subset = ok) => ({ correct: subset.filter(pred).length, n: subset.length, pct: pct(subset.filter(pred).length, subset.length) });
  const byRound = (pred: (r: Row) => boolean) =>
    [...new Set(ok.map((r) => r.round))].sort().map((round) => acc(pred, ok.filter((r) => r.round === round)).pct);

  const catPred = (r: Row) => catOk(c(r), r.prediction!.category);
  const lenPred = (r: Row) => catLenient(c(r), r.prediction!.category);
  const urgPred = (r: Row) => isHigh(r.prediction!.urgency) === (c(r).expected.urgency === "high");
  const humPred = (r: Row) => predHuman(r.prediction!.needsHumanProb) === c(r).expected.needsHuman;

  const perCategory = Object.fromEntries(
    CATEGORIES.map((cat) => [cat, acc(catPred, ok.filter((r) => c(r).expected.category === cat))]),
  );
  const easyHard = {
    easy: acc(catPred, ok.filter((r) => !c(r).hard)),
    hard: acc(catPred, ok.filter((r) => c(r).hard)),
  };

  const humanPositives = ok.filter((r) => c(r).expected.needsHuman);
  const missed = humanPositives.filter((r) => !predHuman(r.prediction!.needsHumanProb));

  // レイテンシ: BRIEF どおり、ケースごとに3周の中央値を取り、その60個から p50/p95
  const perCaseLatency = RUN_CASES.map((cs) => ok.filter((r) => r.caseId === cs.id).map((r) => r.latencyMs))
    .filter((xs) => xs.length > 0)
    .map(median);
  const allLatency = ok.map((r) => r.latencyMs);

  const costs = ok.map((r) => r.costUsd).filter((x): x is number => typeof x === "number");
  const inTok = ok.map((r) => r.usage?.inputTokens ?? 0);
  const outTok = ok.map((r) => r.usage?.outputTokens ?? 0);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    model: ok[0]?.model,
    calls: rows.length,
    errors,
    category: { strict: acc(catPred), strictByRound: byRound(catPred), lenient: acc(lenPred), lenientByRound: byRound(lenPred), perCategory, ...easyHard },
    urgency: {
      ...acc(urgPred),
      byRound: byRound(urgPred),
      // 参考: ちょうど 0.5 を返した回数と、閾値を「> 0.5」にした場合の一致率（主指標は BRIEF どおり >= 0.5）
      exactlyHalf: ok.filter((r) => r.prediction!.urgency === 0.5).length,
      strictlyAboveHalf: acc((r) => (r.prediction!.urgency > 0.5) === (c(r).expected.urgency === "high")),
    },
    needsHuman: {
      ...acc(humPred),
      byRound: byRound(humPred),
      missed: { count: missed.length, of: humanPositives.length, pct: pct(missed.length, humanPositives.length) },
    },
    latencyMs: {
      p50: Math.round(quantile(perCaseLatency, 0.5)),
      p95: Math.round(quantile(perCaseLatency, 0.95)),
      rawCallsP50: Math.round(quantile(allLatency, 0.5)),
      rawCallsP95: Math.round(quantile(allLatency, 0.95)),
    },
    cost: {
      source: costs.length === ok.length ? "measured (AI Gateway providerMetadata.gateway.cost)" : `measured on ${costs.length}/${ok.length} calls`,
      per1000Usd: costs.length ? mean(costs) * 1000 : null,
      totalUsd: costs.reduce((a, b) => a + b, 0),
      avgInputTokens: Math.round(mean(inTok)),
      avgOutputTokens: Math.round(mean(outTok)),
    },
  };
}

// 運用シミュレーション（Jev のみ。LLM は確率を返さないので不可）: category の最大確率で3段階に振り分け
function simulate(rows: Row[]) {
  const ok = rows.filter((r) => r.ok && topProb(r) !== undefined);
  const bucket = (p: number) => (p > 0.95 ? "auto" : p >= 0.7 ? "confirm" : "human");
  const out: Record<string, { n: number; share: number | null; correct: number; accuracy: number | null; needsHumanExpected: number; needsHumanMissed: number; needsHumanMissedCases: string[] }> = {};
  for (const b of ["auto", "confirm", "human"]) {
    const xs = ok.filter((r) => bucket(topProb(r)!) === b);
    const correct = xs.filter((r) => catOk(caseById.get(r.caseId)!, r.prediction!.category)).length;
    // category は正しくても、人の確認が必要な案件を Jev が needs_human=false と判定したもの（自動処理にすり抜ける）
    const nhExpected = xs.filter((r) => caseById.get(r.caseId)!.expected.needsHuman);
    const nhMissed = nhExpected.filter((r) => !predHuman(r.prediction!.needsHumanProb));
    out[b] = {
      n: xs.length, share: pct(xs.length, ok.length), correct, accuracy: pct(correct, xs.length),
      needsHumanExpected: nhExpected.length, needsHumanMissed: nhMissed.length,
      needsHumanMissedCases: [...new Set(nhMissed.map((r) => r.caseId))],
    };
  }
  // 設計の提案（検証値ではない）: 自動処理を「category 最大確率 > 0.95 かつ P(needs_human) < X」にした場合の感度分析。
  // X は結果を見たあとに選んだ値。
  const autoBase = ok.filter((r) => topProb(r)! > 0.95);
  const baseMissed = autoBase.filter((r) => caseById.get(r.caseId)!.expected.needsHuman && !predHuman(r.prediction!.needsHumanProb)).length;
  const needsHumanGate = [0.2, 0.25, 0.3, 0.4, 0.5].map((x) => {
    const auto = autoBase.filter((r) => r.prediction!.needsHumanProb < x);
    const correct = auto.filter((r) => catOk(caseById.get(r.caseId)!, r.prediction!.category)).length;
    const slipped = auto.filter((r) => caseById.get(r.caseId)!.expected.needsHuman);
    return {
      x,
      auto: auto.length,
      share: pct(auto.length, ok.length),
      categoryAccuracy: pct(correct, auto.length),
      // 自動処理に残った「人が必要なケース」（= すり抜け）
      slippedNeedsHuman: slipped.length,
      slippedCases: [...new Set(slipped.map((r) => r.caseId))],
      caughtOfBaseMissed: baseMissed - slipped.length,
      movedToHuman: autoBase.length - auto.length,
    };
  });
  return { thresholds: { auto: "> 0.95", confirm: "0.70 - 0.95", human: "< 0.70" }, basis: "max category probability", n: ok.length, buckets: out, needsHumanGate: { note: "post-hoc thresholds, not validated", baseAuto: autoBase.length, baseSlipped: baseMissed, rows: needsHumanGate } };
}

const rows = Object.fromEntries(SYSTEMS.map((s) => [s, load(s)])) as Record<(typeof SYSTEMS)[number], Row[]>;
const summary = {
  runId,
  startedAt: meta.startedAt,
  finishedAt: meta.finishedAt,
  rounds: meta.rounds,
  nCases: meta.nCases,
  subset: meta.subset ?? null,
  models: meta.models,
  aiSdk: meta.aiSdk,
  node: meta.node,
  jev: summarize(rows.jev),
  llm: summarize(rows.llm),
  simulation: simulate(rows.jev),
};
writeFileSync(`results/summary${suffix}.json`, JSON.stringify(summary, null, 2));

// ケースごとの全周の予測（RESULTS.md の誤答例とデモのリプレイに使う。原文は合成データ）
const perCase = RUN_CASES.map((c) => ({
  id: c.id, lang: c.lang, hard: c.hard, text: c.text, expected: c.expected, alsoAcceptable: c.alsoAcceptable,
  runs: Object.fromEntries(SYSTEMS.map((s) => [s, rows[s].filter((r) => r.caseId === c.id).sort((a, b) => a.round - b.round).map((r) => ({
    round: r.round, ok: r.ok, error: r.error, latencyMs: Math.round(r.latencyMs), costUsd: r.costUsd, ...r.prediction,
  }))])),
}));
writeFileSync(`results/per-case${suffix}.json`, JSON.stringify(perCase, null, 2));

const f = (s: ReturnType<typeof summarize>) =>
  `category ${s.category.strict.pct}% (lenient ${s.category.lenient.pct}%) | urgency ${s.urgency.pct}% | needs_human ${s.needsHuman.pct}% (missed ${s.needsHuman.missed.count}/${s.needsHuman.missed.of}) | p50 ${s.latencyMs.p50}ms p95 ${s.latencyMs.p95}ms | $${s.cost.per1000Usd?.toFixed(4)}/1k | errors ${s.errors}`;
console.log(`run ${runId}`);
console.log(`JEV  ${f(summary.jev)}`);
console.log(`LLM  ${f(summary.llm)}`);
console.log("simulation", JSON.stringify(summary.simulation.buckets));
