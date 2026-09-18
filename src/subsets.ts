// 部分集合。どれも計測結果を見る前に、機械的なルールで固定した。
import { DEMO_CASE_IDS } from "./demo-cases.ts";

const range = (prefix: string, from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => `${prefix}${String(from + i * step).padStart(2, "0")}`);

export const SUBSETS: Record<string, readonly string[]> = {
  // 大型モデル比較用 20件（2026-09-18 固定）。素直: s01 から4件おき / 難しい: h01 から2件おき
  large20: [...range("s", 1, 37, 4), ...range("h", 1, 19, 2)],
  demo12: DEMO_CASE_IDS,
};
