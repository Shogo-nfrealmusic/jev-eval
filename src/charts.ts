// Builds 3 SVGs for the blog from results/summary*.json and results/per-case*.json (results/charts/).
// Transparent background. Series colors verified on both light and dark surfaces (dataviz validate_palette.js PASS in both modes, 3 series).
// Text is a single mid-gray, readable on both white and black backgrounds.
// Jev and GPT-4o-mini come from the main run; Claude Sonnet 4.5 from its own run (same conditions, 60 cases × 3 rounds) if present.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CATEGORIES } from "./types.ts";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const main = { summary: readJson("results/summary.json"), perCase: readJson("results/per-case.json") as any[] };
const claude = existsSync("results/summary-sonnet60.json")
  ? { summary: readJson("results/summary-sonnet60.json"), perCase: readJson("results/per-case-sonnet60.json") as any[] }
  : null;
mkdirSync("results/charts", { recursive: true });

type Series = { name: string; color: string; s: any; runs: (id: string) => any[] };
const SERIES: Series[] = [
  { name: "Jev", color: "#3380de", s: main.summary.jev, runs: (id) => main.perCase.find((c) => c.id === id)!.runs.jev },
  { name: "GPT-4o-mini", color: "#e2602c", s: main.summary.llm, runs: (id) => main.perCase.find((c) => c.id === id)!.runs.llm },
  ...(claude ? [{ name: "Claude Sonnet 4.5", color: "#1aa674", s: claude.summary.llm, runs: (id: string) => claude.perCase.find((c) => c.id === id)!.runs.llm }] : []),
];
const TITLE_VS = SERIES.map((s) => s.name).join(" vs ");
const C = { ink: "#7a7a76", grid: "rgba(128,128,128,0.28)" };
const FONT = `font-family="Inter, Helvetica Neue, Arial, sans-serif" font-variant-numeric="tabular-nums"`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x: number, y: number, s: string, a = "") => `<text x="${x}" y="${y}" fill="${C.ink}" ${a}>${esc(s)}</text>`;
// 4px rounded corners on the right end (data side) only. Left end (baseline) is square.
const hbar = (x: number, y: number, w: number, h: number, fill: string) => {
  if (w <= 0) return "";
  const r = Math.min(4, w, h / 2);
  return `<path d="M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z" fill="${fill}"/>`;
};
const legend = (x: number, y: number) =>
  SERIES.map((s, i) => `<rect x="${x + i * 150}" y="${y - 9}" width="10" height="10" rx="2" fill="${s.color}"/>${text(x + i * 150 + 16, y, s.name, `font-size="13"`)}`).join("");
const svg = (w: number, h: number, title: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT} role="img" aria-label="${esc(title)}">\n<title>${esc(title)}</title>\n${body}\n</svg>\n`;
const SOURCE = "60 cases × 3 rounds per model. Jev and GPT-4o-mini: main run; Claude: its own run under the same conditions.";

// ---- 1. Accuracy by category ----
{
  const barH = 12, gap = 2;
  const W = 720, left = 110, right = 60, top = 70, rowH = SERIES.length * (barH + gap) + 12;
  const H = top + CATEGORIES.length * rowH + 58;
  const plotW = W - left - right;
  const x = (p: number) => left + (p / 100) * plotW;
  let b = text(0, 20, "Category accuracy by expected category (exact match, all rounds)", `font-size="15" font-weight="600"`);
  b += legend(0, 46);
  const axisY = top + CATEGORIES.length * rowH;
  for (const t of [0, 25, 50, 75, 100]) b += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${axisY}" stroke="${C.grid}"/>` + text(x(t), axisY + 16, `${t}%`, `font-size="11" text-anchor="middle"`);
  CATEGORIES.forEach((cat, i) => {
    const y = top + i * rowH;
    b += text(left - 10, y + (SERIES.length * (barH + gap)) / 2 + 4, cat, `font-size="12" text-anchor="end"`);
    SERIES.forEach((s, j) => {
      const v = s.s.category.perCategory[cat];
      const yy = y + j * (barH + gap);
      b += hbar(left, yy, x(v.pct ?? 0) - left, barH, s.color);
      b += text(x(v.pct ?? 0) + 6, yy + barH - 2, `${v.pct}%`, `font-size="10.5"`);
    });
  });
  b += text(0, H - 6, SOURCE, `font-size="11"`);
  writeFileSync("results/charts/1-category-accuracy.svg", svg(W, H, `Category accuracy by category: ${TITLE_VS}`, b));
}

// ---- 2. Latency distribution (per-case median of 3 rounds; same population as summary p50/p95) ----
{
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = (s.length - 1) / 2; return (s[Math.floor(m)]! + s[Math.ceil(m)]!) / 2; };
  const pts = SERIES.map((s) => main.perCase.map((c) => s.runs(c.id).filter((r: any) => r.ok).map((r: any) => r.latencyMs)).filter((xs) => xs.length).map(med));
  const W = 720, left = 130, right = 30, top = 70, laneH = 90;
  const H = top + SERIES.length * laneH + 60;
  const maxV = Math.max(...pts.flat());
  const step = maxV > 4000 ? 1000 : 500;
  const axisMax = Math.ceil(maxV / step) * step;
  const x = (v: number) => left + (v / axisMax) * (W - left - right);
  const axisY = top + SERIES.length * laneH;
  let b = text(0, 20, "Latency per message (median of 3 rounds per case, n=60)", `font-size="15" font-weight="600"`);
  b += text(0, 42, "Each dot is one message. Ticks mark p50 and p95.", `font-size="12"`);
  for (let t = 0; t <= axisMax; t += step) b += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${axisY}" stroke="${C.grid}"/>` + text(x(t), axisY + 18, `${t.toLocaleString("en-US")} ms`, `font-size="11" text-anchor="middle"`);
  SERIES.forEach((s, i) => {
    const cy = top + i * laneH + laneH / 2;
    b += text(left - 10, cy + 4, s.name, `font-size="13" text-anchor="end"`);
    // Deterministic jitter (by case order) to avoid overlap
    pts[i]!.forEach((v, j) => {
      const jy = cy - 16 + ((j * 37) % 33);
      b += `<circle cx="${x(v).toFixed(1)}" cy="${jy}" r="4" fill="${s.color}" fill-opacity="0.75"/>`;
    });
    const { p50, p95 } = s.s.latencyMs;
    for (const [label, v] of [["p50", p50], ["p95", p95]] as const) {
      b += `<line x1="${x(v)}" x2="${x(v)}" y1="${cy - 26}" y2="${cy + 22}" stroke="${C.ink}" stroke-width="2"/>`;
      b += text(x(v), cy - 30, `${label} ${v.toLocaleString("en-US")} ms`, `font-size="11" text-anchor="${label === "p50" ? "end" : "start"}"`);
    }
  });
  b += text(0, H - 6, SOURCE, `font-size="11"`);
  writeFileSync("results/charts/2-latency.svg", svg(W, H, `Latency distribution: ${TITLE_VS}`, b));
}

// ---- 3. Cost per 1,000 requests ----
{
  const W = 720, left = 130, right = 100, top = 60, barH = 28, rowH = 48;
  const H = top + SERIES.length * rowH + 40;
  const v = SERIES.map((s) => s.s.cost.per1000Usd as number);
  const maxV = Math.max(...v);
  const x = (d: number) => left + (d / maxV) * (W - left - right);
  let b = text(0, 20, "Cost per 1,000 messages (AI Gateway billed cost, measured)", `font-size="15" font-weight="600"`);
  SERIES.forEach((s, i) => {
    const y = top + i * rowH;
    b += text(left - 10, y + barH / 2 + 5, s.name, `font-size="13" text-anchor="end"`);
    b += hbar(left, y, Math.max(x(v[i]!) - left, 1), barH, s.color);
    b += text(x(v[i]!) + 8, y + barH / 2 + 5, v[i]! < 1 ? `$${v[i]!.toFixed(4)}` : `$${v[i]!.toFixed(2)}`, `font-size="13"`);
  });
  b += `<line x1="${left}" x2="${left}" y1="${top - 6}" y2="${top + SERIES.length * rowH - 14}" stroke="${C.ink}"/>`;
  b += text(0, H - 6, SOURCE, `font-size="11"`);
  writeFileSync("results/charts/3-cost-per-1000.svg", svg(W, H, `Cost per 1,000 messages: ${TITLE_VS}`, b));
}

console.log(`wrote results/charts/1-category-accuracy.svg, 2-latency.svg, 3-cost-per-1000.svg (${SERIES.length} series)`);
