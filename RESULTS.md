# RESULTS — Jev vs LLMs (routing booking inquiries)

Results of evaluating TypeSafe AI's judgment-only model **Jev** on synthetic data modeled on inquiry routing for a photo-shoot service for international tourists in Japan.
Every number is copied from `results/summary.json` / `results/summary-sonnet.json` (apart from rounding for display, nothing was recomputed by hand).

---

## 1. Setup

| Item | Value |
|---|---|
| Main run | 2026-09-18 11:18:15 – 11:23:19 UTC (20:18 – 20:23 JST) / run `2026-09-18T11-18-14-993Z` |
| Extra run (larger model) | 2026-09-18 11:31:50 UTC (20:31 JST) / run `2026-09-18T11-31-50-447Z` |
| Model under test | `typesafe-ai/jev` |
| Comparison model (main run) | `openai/gpt-4o-mini` |
| Comparison model (extra run) | `anthropic/claude-sonnet-4.5` |
| Route | Everything through Vercel AI Gateway (one key) |
| SDK | `ai` 7.0.106 (`experimental_evaluate` / `generateObject`), `@ai-sdk/gateway` 4.0.86, Node v26.5.0 |
| Main run size | 60 cases × 3 rounds = 180 calls per model (+ 1 discarded warm-up) |
| Extra run size | 20 cases × 1 round = 20 calls per model (+ 1 discarded warm-up) |
| Errors | **0** (all runs, all models) |

**What we did to keep it fair**
- The question wording is identical for both sides, word for word (`QUESTIONS` in `src/types.ts` is passed to Jev as is and to the LLM as JSON)
- The LLM uses structured output via `generateObject` (not asked to emit JSON as text for us to parse). Temperature left at the default
- Serial execution. Zero retries on both sides. Same input order. The call order (Jev first or LLM first) alternates per case
- Latency is measured from just before the API call until the response is received. We take the median of the 3 rounds per case, then p50 / p95 over those 60 values
- Cost is not estimated: it is the billed cost the Gateway returns with each response (`providerMetadata.gateway.cost`)

**Data**: 60 cases (English 30 / Chinese 12 / Korean 9 / Japanese 9). 40 straightforward cases (8 categories × 5) and 20 deliberately hard ones.
9-way choice: 8 categories + `other` (none of the above). Labels, and the reasoning behind each hard case, are in `src/data.ts`.

---

## 2. Read this first: the urgency number moves a lot depending on the threshold

Urgency is a 0–1 score, counted as **high when ≥ 0.5** and compared with the gold label (the primary metric defined in the brief).

gpt-4o-mini returned **exactly 0.5 for urgency 64 times on cases whose gold label is low** (69 times in total out of 180).
It presumably used the midpoint to mean "can't tell", but under the primary definition 0.5 counts as high, so every one of these is scored wrong.
If the threshold is changed to "high when > 0.5", agreement rises to 82.8%.

| Urgency agreement | Primary (≥ 0.5 = high) | Reference (> 0.5 = high) | Times it returned exactly 0.5 |
|---|---|---|---|
| Jev | 96.7% | 95.6% | 2 |
| gpt-4o-mini | 50.0% | 82.8% | 69 |

**This is a side effect of how the boundary value is scored, not a difference in model ability.**
Everywhere below, urgency is always reported with both values side by side.
Claude Sonnet 4.5 never returned exactly 0.5 (90% under both thresholds).

---

## 3. Main results (60 cases × 3 rounds)

| | Jev | gpt-4o-mini |
|---|---|---|
| **Category accuracy (exact match)** | **96.1%** (173/180) | 93.9% (169/180) |
| Category accuracy (incl. acceptable alternatives, reference) | 98.3% | **100%** |
| 　Straightforward 40 cases | 100% | 100% |
| 　Hard 20 cases | **88.3%** | 81.7% |
| Urgency agreement (≥0.5 / >0.5) | 96.7% / 95.6% | 50.0% / 82.8% (→ §2) |
| needs_human agreement | 81.7% | 78.9% |
| needs_human **misses** (human needed, predicted false) | 21 / 69 (30.4%) | **16 / 69 (23.2%)** |
| Latency p50 | **379 ms** | 1,209 ms |
| Latency p95 | **481 ms** | 1,462 ms |
| Cost per 1,000 messages (billed) | **$0.032** | $0.122 |
| Avg tokens (input / output) | 765 / 119 | 737 / 19 |

- **Category accuracy by round**: Jev 96.7 / 96.7 / 95.0%, gpt-4o-mini 93.3 / 93.3 / 95.0%. Jev gave nearly the same answers in all 3 rounds (probabilities for the same case varied by at most about 0.05)
- **Multipliers (measured under these conditions)**: Jev is **3.2× faster** (p50) and **3.8× cheaper**. TypeSafe's published figures are "193.6× faster, 444.6× cheaper"
- **Jev's cost matches its published price**: average 765 input tokens × $0.042 per million = $0.0000321 per call, which matches the Gateway's billed amount ($0.0000321 per call on average). Output tokens (119 on average) were not billed

---

## 4. How the multipliers change with the comparison model (extra run: 20 cases × 1 round)

gpt-4o-mini is among the cheapest and fastest models. To see whether the multipliers depend on the comparison model, we added a run against the larger `anthropic/claude-sonnet-4.5`.

- **How the 20 cases were picked**: fixed by a mechanical rule before seeing any results (`src/subsets.ts`). Straightforward: every 4th from s01; hard: every 2nd from h01 (s01, s05, …, s37, h01, h03, …, h19)
- **Conditions**: same as the main run. Serial, 1 discarded warm-up, zero retries. Jev and Sonnet were called alternately within the same run

| Same 20 cases | Jev | claude-sonnet-4.5 |
|---|---|---|
| Category accuracy (exact) | 90% (18/20) | 90% (18/20) |
| Category accuracy (incl. acceptable alternatives) | 95% | 95% |
| Urgency agreement (≥0.5 / >0.5) | 100% / 100% | 90% / 90% |
| needs_human agreement | 80% | 85% |
| needs_human misses | 4 / 10 | 3 / 10 |
| Latency p50 / p95 | **416 / 560 ms** | 1,917 / 2,270 ms |
| Cost per 1,000 messages (billed) | **$0.032** | $3.41 |

**Multipliers relative to Jev (all measured)**

| Compared with | Speed (p50 ratio) | Cost | Category accuracy (exact) |
|---|---|---|---|
| gpt-4o-mini (60 cases × 3 rounds) | 3.2× faster | 3.8× cheaper | Jev +2.2 points |
| claude-sonnet-4.5 (20 cases × 1 round) | 4.6× faster | 106× cheaper | Tied (90% vs 90%) |
| TypeSafe's published figures | 193.6× faster | 444.6× cheaper | — |

**Takeaway**: the speed multiplier stayed around 3–5× regardless of the comparison model, but the cost multiplier **ranged from 3.8× to 106× depending on what Jev is compared with**.
Under our conditions, the published multipliers were not reproduced with either comparison model. We could not determine which model and conditions the published figures were based on.

For reference, the same 20 cases in round 1 of the main run give gpt-4o-mini category 19/20, p50 1,264 ms, $0.122 per 1,000 (a different run, so not mixed into the tables above).

**Sonnet's errors**: h15 classified as late_arrival (Jev and gpt-4o-mini made the same mistake), and h19 (wedding shoot in Hokkaido) as other. On the other hand, it correctly answered other for h07 ("what time tomorrow?"), which Jev got wrong.

---

## 5. Cases Jev got wrong (category)

**Jev got the category wrong on only 3 of the 60 cases** (7 of 180 calls). That is short of the 5 examples the brief asked for; rather than padding the list, we show those 3.

| id | Message | Gold | Jev's answer | Jev's probabilities (top) | Rounds |
|---|---|---|---|---|---|
| h07 | what time tomorrow? | other | reschedule | reschedule 0.60–0.65 / other 0.35–0.40 | Wrong in all 3 |
| h15 | We might be a bit late tomorrow morning because our flight lands at 7. Is the 9am shoot still ok or should we move it later? | reschedule (late_arrival acceptable) | late_arrival | late_arrival 0.83–0.87 / reschedule 0.13–0.17 | Wrong in all 3 |
| h06 | tmrw shoot - can we do 4 ppl not 2 and also move to 5pm?? thx | group_size (reschedule acceptable) | reschedule | reschedule 0.51 / group_size 0.45 | Wrong in 1 of 3 |

- **h07 is exactly the kind of failure this evaluation most wanted to measure**: a message that fits no category (other) forced into an existing one (reschedule). It is wrong even with acceptable alternatives, and it is the only Jev error that alternatives do not rescue. gpt-4o-mini and Sonnet both correctly answered other
- However, **the probability was low (0.60–0.65)**, so under the operating rule in §8 it falls into "send to a human" and would be caught in practice
- In h06 the two probabilities are nearly tied (0.51 vs 0.45) and the answer flipped between rounds. **The probabilities honestly show that the model is torn**

---

## 6. Cases the LLM (gpt-4o-mini) got wrong (category)

**It got 4 cases wrong** (11 of 180 calls), also short of 5. **All 4 are within the acceptable alternatives**, so its accuracy including alternatives is 100%.

| id | Message | Gold | gpt-4o-mini's answer | Rounds |
|---|---|---|---|---|
| h02 | Typhoon warning for Saturday. If we can't shoot, do we get our money back or can we move it? | weather (refund / reschedule acceptable) | refund | Wrong in all 3 |
| h10 | 내일 비 오면 그냥 취소하고 환불 받을 수 있나요? (If it rains tomorrow, can I just cancel and get a refund?) | weather (cancel / refund acceptable) | refund | Wrong in all 3 |
| h15 | We might be a bit late tomorrow morning … should we move it later? | reschedule (late_arrival acceptable) | late_arrival | Wrong in all 3 |
| h16 | How much would it cost to add my grandparents? They just decided to come. | pricing (group_size acceptable) | group_size | Wrong in 2 of 3 |

- The LLM returns no probabilities, so there is no way to tell how unsure it was
- On h02 and h10, Jev answered weather (0.61–0.65) while putting 0.31–0.35 on refund; its hesitation shows up in the probabilities

---

## 7. needs_human misses (7 cases missed in all 3 rounds)

These are cases that need a human but were predicted false. **This is Jev's biggest weakness**: 21/69 misses (gpt-4o-mini: 16/69).
Jev missed the following 7 cases the same way in all 3 rounds (round-by-round values are in `results/per-case.json`).

| id | Message | Gold | Jev P(needs_human) | Jev category (prob.) | gpt-4o-mini |
|---|---|---|---|---|---|
| **h01** | 台風で飛行機が飛ばないので、明日の撮影を土曜に変えたいです。 (Our flight is grounded by the typhoon, so we'd like to move tomorrow's shoot to Saturday.) | true | **0.40 – 0.43** | reschedule (1.00) | true (3/3 correct) |
| **h08** | Please unsubscribe me from this mailing list. | true | **0.25 – 0.30** | other (0.99) | false (3/3 missed) |
| h15 | We might be a bit late tomorrow morning … should we move it later? | true | 0.29 – 0.30 | late_arrival (0.83–0.87) | 1/3 missed |
| h17 | 촬영장소가 비가 오면 실내로 바뀌나요? 그럼 가격도 달라지나요? (If it rains, does the shoot move indoors? Does the price change then?) | true | 0.38 – 0.39 | weather (0.99) | 3/3 missed |
| h18 | 請問可以改期嗎 (Can I reschedule?) | true | 0.28 – 0.33 | reschedule (1.00) | 3/3 missed |
| h19 | I booked with you guys last year and loved it! Do you do wedding shoots in Hokkaido?? 😍📸 | true | 0.26 | location (0.97–0.98) | 3/3 missed |
| h20 | 취소해주세요. (Please cancel.) | true | 0.47 – 0.49 | cancel (1.00) | true (3/3 correct) |

### Two cases to quote

**h01 (flight grounded by a typhoon → move tomorrow's shoot to Saturday)**
- Message: 「台風で飛行機が飛ばないので、明日の撮影を土曜に変えたいです。」 ("Our flight is grounded by the typhoon, so we'd like to move tomorrow's shoot to Saturday.")
- Gold: category = reschedule (weather acceptable), urgency = high, needs_human = **true**
- Why: the shoot is tomorrow, and a weather-driven date change needs a human decision (e.g. whether to waive the change fee)
- Jev (3 rounds):
  - category: reschedule 1.00 (all 3; correct)
  - urgency: 0.88 / 0.88 / 0.91 (high; correct)
  - needs_human: P = **0.42 / 0.40 / 0.43 → false (missed)**
- gpt-4o-mini: reschedule, urgency = 1, needs_human = true in all 3 rounds (all correct)
- Point: **because the category probability is 1.00, the operating rule in §8 sends it to "auto-process"**

**h08 (unsubscribe from the mailing list)**
- Message: "Please unsubscribe me from this mailing list."
- Gold: category = other, urgency = low, needs_human = **true** (unrelated to shoot bookings, so a human has to reroute it)
- Jev (3 rounds):
  - category: other 0.99 (all 3; correct; only 0.01 on cancel)
  - urgency: 0.00 / 0.01 / 0.00 (low; correct)
  - needs_human: P = **0.25 / 0.30 / 0.27 → false (missed)**
- gpt-4o-mini: other, urgency = 0, needs_human = false in all 3 rounds (missed, same as Jev)
- Point: Jev correctly sees that the message is unrelated to bookings, but does not connect that to "so a human needs to reroute it". The labeling rule (out of scope → true) is also debatable for this case

**What the 7 cases have in common**: the category is correct with high probability, but needs_human sits just below 0.5.
Jev does not pick up the latter conditions in the rule: "missing information" (h18, h20), "several requests at once" (h17), "out of scope" (h08, h19).

---

## 8. Operational simulation (routing on Jev's probabilities)

We split Jev's 180 decisions into three tiers by the **maximum category probability** (the LLM returns no probabilities, so this simulation is not possible for it).

| Tier | Condition | Calls | Share | Category accuracy | Of which need a human | Of which needs_human missed |
|---|---|---|---|---|---|---|
| **Auto-process** | prob. > 0.95 | 157 | **87.2%** | **100% (157/157)** | 49 | **18** (h01, h08, h17, h18, h19, h20 × 3 rounds) |
| Extra check | 0.70 – 0.95 | 8 | 4.4% | 62.5% (5/8) | 8 | 3 (h15 × 3 rounds) |
| Send to a human | < 0.70 | 15 | 8.3% | 73.3% (11/15) | 12 | 0 |

- **As a category router, this is a very strong result.** Above 0.95 it was never wrong, and 87% of traffic could be auto-processed. All 7 wrong calls (h07 at 0.60–0.65, h06 at 0.51, h15 at 0.83–0.87) fell outside auto-process (extra check or human)
- **However, "157 auto-processed, all correct" only looks at category.** Of those 157, 49 actually needed a human, and **for 18 of them (6 cases × 3 rounds) Jev's needs_human was also false.** In other words, the category is high-confidence *and* Jev says no human is needed, so nothing puts a human in the loop and they pass straight through auto-processing
- In production, auto-processing should not be decided by category probability alone; an additional rule such as **a threshold on the needs_human probability** is needed. Because such a threshold would be chosen after seeing the results, we present it as a design proposal rather than a validated value in §8.1

The extra 20-case run showed the same pattern: 85% (17 calls) auto-processed with category all correct, and 3 of them (h01, h17, h19) were needs_human misses.

### 8.1 Design proposal: a two-stage auto-process condition (sensitivity analysis)

As a way to stop the pass-through above, we computed a two-stage auto-process condition:

> Auto-process = max category probability > 0.95　**and**　P(needs_human) < X

**These thresholds were chosen after seeing the results and are not validated values. In production they have to be set separately on your own data.**

Main run (60 cases × 3 rounds, 180 calls). The baseline is auto-processing on category probability alone (157 calls, 18 pass-throughs).

| X | Auto-processed | Share | Category accuracy | needs_human misses passing through | Caught (of the 18) | Additionally sent to a human |
|---|---|---|---|---|---|---|
| none (category only) | 157 | 87.2% | 100% | 18 | — | — |
| 0.50 | 117 | 65.0% | 100% | 18 (h01, h08, h17, h18, h19, h20) | 0 | 40 |
| 0.40 | 99 | 55.0% | 100% | 12 (h08, h17, h18, h19) | 6 | 58 |
| 0.30 | 53 | 29.4% | 100% | 6 (h08, h18, h19) | 12 | 104 |
| 0.25 | 35 | 19.4% | 100% | **0** | **18** | 122 |
| 0.20 | 10 | 5.6% | 100% | 0 | 18 | 147 |

- "Additionally sent to a human" is the drop from the category-only baseline of 157 (i.e. the loss in automation rate)
- **X = 0.50 is the same as using Jev's own needs_human verdict (true if P ≥ 0.5).** The 40 calls it routes to a human are the ones Jev itself flagged; it catches none of the 18 pass-throughs (all 18 have P < 0.5)
- **Catching all 18 requires X ≤ 0.25, at which point auto-processing drops from 87.2% to 19.4%.** The P(needs_human) values of the missed cases are spread across 0.25–0.49, with no clear boundary from cases that truly need no human. Jev's needs_human probabilities are not as cleanly separated as its category probabilities
- At every X, category accuracy among the auto-processed calls stays at 100%
- The extra 20-case run (Jev from the Sonnet comparison run) had the same shape: baseline 17 auto-processed with 3 pass-throughs; X = 0.25 gives 0 pass-throughs (4 auto-processed, 20%), X = 0.30 gives 1 (h19), and X = 0.50 still leaves 3

---

## 9. Category accuracy by gold category (main run, exact match, all rounds pooled)

| Gold category | Calls | Jev | gpt-4o-mini |
|---|---|---|---|
| reschedule | 27 | 88.9% | 88.9% |
| cancel | 18 | 100% | 100% |
| refund | 18 | 100% | 100% |
| location | 18 | 100% | 100% |
| pricing | 18 | 100% | 88.9% |
| group_size | 18 | 94.4% | 100% |
| late_arrival | 21 | 100% | 100% |
| weather | 24 | 100% | **75.0%** |
| other | 18 | **83.3%** | 100% |

- gpt-4o-mini tended to pull weather-related inquiries (h02, h10) toward refund
- Jev forced "what time tomorrow?" (h07), which belongs in other, into an existing category
- Charts: `results/charts/1-category-accuracy.svg`, `2-latency.svg`, `3-cost-per-1000.svg`

---

## 10. Where Jev won and where it lost

**Won**
- Speed: 3.2× faster than gpt-4o-mini and 4.6× faster than Sonnet 4.5 at p50. p95 was a steady 481 ms
- Cost: 3.8× cheaper than gpt-4o-mini and 106× cheaper than Sonnet 4.5. The billed amount matched the published price ($0.042 per million input tokens, output free)
- Category on hard cases: 88.3% (gpt-4o-mini 81.7%)
- **Usable probabilities**: category probability exceeded 0.95 on 157 of 180 calls and was never wrong there. When the model was unsure, the probabilities split (h06: 0.51 vs 0.45). This is operationally useful information that the LLM does not provide
- Reproducibility: nearly identical answers across 3 rounds

**Lost**
- **More needs_human misses**: 21/69 (gpt-4o-mini 16/69). It missed h01, the example from the brief
- **Cases that need a human slip through auto-processing even when the category is right**: 18 of the 157 auto-processed calls (§8). Closing the gap with a needs_human threshold drops automation from 87% to 19% if all of them are to be caught (§8.1, estimated with a post-hoc threshold)
- **Forced a no-category message into an existing category**: h07 classified as reschedule in all 3 rounds (gpt-4o-mini and Sonnet got it right)
- Including acceptable alternatives, gpt-4o-mini (100%) beat Jev (98.3%) on category
- The published multipliers (193.6× faster, 444.6× cheaper) were not reproduced against either comparison model

---

## 11. Limitations

- **Synthetic data**: no real customer data was used. The cases were modeled on real-world practice, but the real distribution (language mix, length, category balance) may differ
- **A single annotator** (drafted by Claude, reviewed and corrected by one person). Inter-annotator agreement was not measured. In particular, needs_human = true for out-of-scope messages (h08) and the range of acceptable alternatives involve judgment calls
- **A single network environment**: one machine, one network, one time window. Latency depends on the distance to the Gateway and on load
- **The multipliers depend on the comparison model**: the cost multiplier ranged from 3.8× to 106× between gpt-4o-mini and Sonnet 4.5. The Sonnet run was only 20 cases × 1 round
- **n = 60** (n = 20 for the extra run): one case changes accuracy by 1.7 points (5 points at n = 20). The accuracy gaps between models (e.g. 96.1% vs 93.9%) cannot be called statistically meaningful
- **One prompt**: both sides got the same wording; prompt-engineering for the LLM could change its results (we deliberately did not, for fairness)
- **Urgency is sensitive to the threshold definition** (§2)

---

## 12. Files used for reproduction

- Data and labels: `src/data.ts` (comments explain the labeling call on hard cases)
- Question wording: `src/types.ts`
- Measurement: `src/run.ts`, `src/jev.ts`, `src/baseline.ts`
- Scoring: `src/score.ts` → `results/summary.json`, `results/per-case.json` (the Sonnet run's files carry a `-sonnet` suffix)
- Raw responses: `results/raw/` (gitignored)
- Demo: `npm run demo` (the 12 cases are in `src/demo-cases.ts`, fixed before seeing results)
