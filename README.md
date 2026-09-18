# jev-eval

A third-party check of **Jev** (`typesafe-ai/jev`), TypeSafe AI's judgment-only model, against LLMs (`openai/gpt-4o-mini` and `anthropic/claude-sonnet-4.5`) under identical conditions.
The task: routing booking inquiries sent to a photo-shoot service for international tourists in Japan (60 synthetic messages in 4 languages).

**Results are in [RESULTS.md](RESULTS.md).**

## Requirements

- Node.js (tested with v26.5.0) and npm
- A Vercel AI Gateway API key (starts with `vck_`). Jev and the comparison LLMs are all called through this one key

### Getting an AI_GATEWAY_API_KEY

1. Log in to Vercel and create an API key on the AI Gateway page of your dashboard
2. On the free tier you will hit rate limits (HTTP 429) and the full run stops partway; some models (e.g. Claude) are not available on the free tier at all. **Add AI Gateway credits before measuring.** The main run (60 × 3, Jev + gpt-4o-mini) cost about $0.03; the Claude run (60 × 3, Jev + Sonnet 4.5) about $0.62
3. Create `.env.local` in the repository root with the key

```bash
echo "AI_GATEWAY_API_KEY=vck_xxxxxxxx" > .env.local
```

`.env.local` is gitignored. Never hard-code the key or commit it.

## Setup

```bash
npm install
npx tsx src/smoke.ts   # one call each to Jev and the LLMs, to confirm they are reachable through the Gateway
```

## Commands

| Command | What it does |
|---|---|
| `npm run measure` | Main run. 60 cases × 3 rounds, Jev and gpt-4o-mini called serially; raw responses saved to `results/raw/<runId>/`. One warm-up call per model is discarded first. No retries |
| `npm run measure:claude` | Same 60 × 3 run with `anthropic/claude-sonnet-4.5` as the comparison model (Jev re-measured alongside). Score it with `npm run score -- <runId> sonnet60` |
| `npm run measure -- --subset large20 --rounds 1 --llm anthropic/claude-sonnet-4.5` | Pilot run (superseded) (the 20 cases are fixed in `src/subsets.ts`) |
| `npm run score` | Scores the most recent run into `results/summary.json` and `results/per-case.json`. To pick a run: `npm run score -- <runId>`. Add a name to write suffixed files instead, e.g. `npm run score -- <runId> sonnet60` |
| `npm run charts` | Writes three SVG charts for the blog post to `results/charts/` (transparent background, readable on both light and dark pages) |
| `npm run demo` | Replay demo. Open http://localhost:5173 and click or press Space to start (append `/?autostart` to start automatically 1 s after load). Fixed 1280×720 layout. Replays 12 measured cases in three lanes (Jev / GPT-4o-mini / Claude Sonnet 4.5) side by side, each taking exactly its measured round-1 latency. The Claude lane appears once `results/summary-sonnet60.json` exists |
| `npm run demo:live` | Live demo that calls the APIs on the spot. Not a measurement: all lanes are called in parallel, which differs from the measurement conditions |
| `npm run typecheck` | TypeScript type check |

Note: with no argument, `npm run score` scores the **most recent** run. After another run, pass the runId explicitly to re-score the main run.

## Layout

```
src/
  types.ts        Question definitions (every word sent to Jev and the LLM lives here) and categories
  data.ts         60 synthetic cases with gold labels (hard cases carry comments explaining the labeling call)
  jev.ts          Calls Jev (experimental_evaluate)
  baseline.ts     Calls the comparison LLM (structured output via generateObject)
  common.ts       Shared types; extracts the Gateway's billed cost
  run.ts          Measurement (serial, warm-up, rounds, raw response logging)
  score.ts        Scoring (accuracy, latency p50/p95, cost, operational simulation)
  charts.ts       SVG charts
  subsets.ts      The 20 cases for the pilot Claude run (fixed mechanically before seeing results)
  demo-cases.ts   The 12 demo cases (fixed mechanically before seeing results)
  smoke.ts        Connectivity check
web/
  server.ts       Demo server (Node's built-in http + SSE, no extra dependencies)
  index.html      Demo page
results/
  summary*.json   Scored results
  per-case*.json  Every prediction per case and round (message texts are synthetic)
  charts/         SVGs
  raw/            Raw responses (gitignored)
RESULTS.md        Results, error examples, limitations
BRIEF.md          The original brief for this evaluation (Japanese)
```

## About the data

All 60 cases in `src/data.ts` are synthetic. They contain no real customers, bookings, or contact details. Labels were assigned by a single annotator (see "Limitations" in RESULTS.md).
