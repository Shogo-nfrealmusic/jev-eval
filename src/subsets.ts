// Subsets. All fixed by mechanical rules before looking at results.
import { DEMO_CASE_IDS } from "./demo-cases.ts";

const range = (prefix: string, from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => `${prefix}${String(from + i * step).padStart(2, "0")}`);

export const SUBSETS: Record<string, readonly string[]> = {
  // 20 cases for the large-model comparison (fixed 2026-09-18). Straightforward: every 4th from s01 / Hard: every 2nd from h01
  large20: [...range("s", 1, 37, 4), ...range("h", 1, 19, 2)],
  demo12: DEMO_CASE_IDS,
};
