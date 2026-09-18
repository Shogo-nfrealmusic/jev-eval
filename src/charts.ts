// results/summary.json と results/per-case.json からブログ用 SVG を3枚作る（results/charts/）。
// 背景は透明。系列色は light/dark 両方の面で検証済み（dataviz の validate_palette.js で両モード PASS）。
// 文字は中間グレー1色で、白背景でも黒背景でも読める。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CATEGORIES } from "./types.ts";

const summary = JSON.parse(readFileSync("results/summary.json", "utf8"));
const perCase: any[] = JSON.parse(readFileSync("results/per-case.json", "utf8"));
mkdirSync("results/charts", { recursive: true });

const C = { jev: "#3380de", llm: "#e2602c", ink: "#7a7a76", grid: "rgba(128,128,128,0.28)" };
const NAME = { jev: "Jev", llm: "GPT-4o-mini" } as const;
const FONT = `font-family="Inter, Helvetica Neue, Arial, sans-serif" font-variant-numeric="tabular-nums"`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x: number, y: number, s: string, a = "") => `<text x="${x}" y="${y}" fill="${C.ink}" ${a}>${esc(s)}</text>`;
// 4px 角丸は右端（データ側）だけ。左端（ベースライン）は直角。
const hbar = (x: number, y: number, w: number, h: number, fill: string) => {
  if (w <= 0) return "";
  const r = Math.min(4, w, h / 2);
  return `<path d="M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z" fill="${fill}"/>`;
};
const legend = (x: number, y: number) =>
  (["jev", "llm"] as const).map((k, i) => `<rect x="${x + i * 130}" y="${y - 9}" width="10" height="10" rx="2" fill="${C[k]}"/>${text(x + i * 130 + 16, y, NAME[k], `font-size="13"`)}`).join("");
const svg = (w: number, h: number, title: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT} role="img" aria-label="${esc(title)}">\n<title>${esc(title)}</title>\n${body}\n</svg>\n`;

// ---- 1. カテゴリ別の正解率 ----
{
  const W = 720, left = 110, right = 60, top = 70, rowH = 40, barH = 14, gap = 2;
  const H = top + CATEGORIES.length * rowH + 40;
  const plotW = W - left - right;
  const x = (p: number) => left + (p / 100) * plotW;
  let b = text(0, 20, "Category accuracy by expected category (exact match, all rounds)", `font-size="15" font-weight="600"`);
  b += legend(0, 46);
  for (const t of [0, 25, 50, 75, 100]) b += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H - 34}" stroke="${C.grid}"/>` + text(x(t), H - 18, `${t}%`, `font-size="11" text-anchor="middle"`);
  CATEGORIES.forEach((cat, i) => {
    const y = top + i * rowH;
    b += text(left - 10, y + barH + 2, cat, `font-size="12" text-anchor="end"`);
    (["jev", "llm"] as const).forEach((k, j) => {
      const v = summary[k].category.perCategory[cat];
      const yy = y + j * (barH + gap);
      b += hbar(left, yy, x(v.pct ?? 0) - left, barH, C[k]);
      b += text(x(v.pct ?? 0) + 6, yy + barH - 3, `${v.pct}%`, `font-size="11"`);
    });
  });
  writeFileSync("results/charts/1-category-accuracy.svg", svg(W, H, "Category accuracy by category: Jev vs GPT-4o-mini", b));
}

// ---- 2. レイテンシの分布（ケースごとの3周中央値。summary の p50/p95 と同じ母集団） ----
{
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = (s.length - 1) / 2; return (s[Math.floor(m)]! + s[Math.ceil(m)]!) / 2; };
  const pts = { jev: [] as number[], llm: [] as number[] };
  for (const c of perCase) for (const k of ["jev", "llm"] as const) {
    const xs = c.runs[k].filter((r: any) => r.ok).map((r: any) => r.latencyMs);
    if (xs.length) pts[k].push(med(xs));
  }
  const W = 720, left = 110, right = 30, top = 70, laneH = 90;
  const H = top + 2 * laneH + 50;
  const maxV = Math.max(...pts.jev, ...pts.llm);
  const step = maxV > 4000 ? 1000 : 500;
  const axisMax = Math.ceil(maxV / step) * step;
  const x = (v: number) => left + (v / axisMax) * (W - left - right);
  let b = text(0, 20, "Latency per message (median of 3 rounds per case, n=60)", `font-size="15" font-weight="600"`);
  b += text(0, 42, "Each dot is one message. Ticks mark p50 and p95.", `font-size="12"`);
  for (let t = 0; t <= axisMax; t += step) b += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${top + 2 * laneH}" stroke="${C.grid}"/>` + text(x(t), top + 2 * laneH + 18, `${t.toLocaleString("en-US")} ms`, `font-size="11" text-anchor="middle"`);
  (["jev", "llm"] as const).forEach((k, i) => {
    const cy = top + i * laneH + laneH / 2;
    b += text(left - 10, cy + 4, NAME[k], `font-size="13" text-anchor="end"`);
    // 決定的なジッタ（ケース順）で重なりを避ける
    pts[k].forEach((v, j) => {
      const jy = cy - 16 + ((j * 37) % 33);
      b += `<circle cx="${x(v).toFixed(1)}" cy="${jy}" r="4" fill="${C[k]}" fill-opacity="0.75"/>`;
    });
    const { p50, p95 } = summary[k].latencyMs;
    for (const [label, v] of [["p50", p50], ["p95", p95]] as const) {
      b += `<line x1="${x(v)}" x2="${x(v)}" y1="${cy - 26}" y2="${cy + 22}" stroke="${C.ink}" stroke-width="2"/>`;
      b += text(x(v), cy - 30, `${label} ${v.toLocaleString("en-US")} ms`, `font-size="11" text-anchor="${label === "p50" ? "end" : "start"}"`);
    }
  });
  writeFileSync("results/charts/2-latency.svg", svg(W, H, "Latency distribution: Jev vs GPT-4o-mini", b));
}

// ---- 3. 1,000件あたりのコスト ----
{
  const W = 720, left = 110, right = 120, top = 60, barH = 28, rowH = 48;
  const H = top + 2 * rowH + 30;
  const v = { jev: summary.jev.cost.per1000Usd as number, llm: summary.llm.cost.per1000Usd as number };
  const maxV = Math.max(v.jev, v.llm);
  const x = (d: number) => left + (d / maxV) * (W - left - right);
  let b = text(0, 20, "Cost per 1,000 messages (AI Gateway billed cost, measured)", `font-size="15" font-weight="600"`);
  (["jev", "llm"] as const).forEach((k, i) => {
    const y = top + i * rowH;
    b += text(left - 10, y + barH / 2 + 5, NAME[k], `font-size="13" text-anchor="end"`);
    b += hbar(left, y, Math.max(x(v[k]) - left, 1), barH, C[k]);
    b += text(x(v[k]) + 8, y + barH / 2 + 5, `$${v[k].toFixed(4)}`, `font-size="13"`);
  });
  b += `<line x1="${left}" x2="${left}" y1="${top - 6}" y2="${top + 2 * rowH - 14}" stroke="${C.ink}"/>`;
  writeFileSync("results/charts/3-cost-per-1000.svg", svg(W, H, "Cost per 1,000 messages: Jev vs GPT-4o-mini", b));
}

console.log("wrote results/charts/1-category-accuracy.svg, 2-latency.svg, 3-cost-per-1000.svg");
