// 12 cases used for the demo (screen recording). Fixed by a mechanical rule before looking at results (2026-09-18, right after the full run started).
//   Straightforward, 6: every 7th from s01 → s01, s08, s15, s22, s29, s36
//   Hard, 6: every 3rd from h01 → h01, h04, h07, h10, h13, h16
// Do not swap cases after seeing results (prevents cherry-picking in Jev's favor).
export const DEMO_CASE_IDS = ["s01", "s08", "s15", "s22", "s29", "s36", "h01", "h04", "h07", "h10", "h13", "h16"] as const;
