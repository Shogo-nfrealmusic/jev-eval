# jev-eval

TypeSafe AI の判断特化モデル **Jev**（`typesafe-ai/jev`）を、LLM（`openai/gpt-4o-mini`、追加で `anthropic/claude-sonnet-4.5`）と同じ条件で比べた第三者検証です。
題材は、訪日客向け写真撮影サービスに届く予約問い合わせの振り分け（合成データ60件、4言語）。

**結果は [RESULTS.md](RESULTS.md) にあります。**

## 必要なもの

- Node.js（検証時は v26.5.0）と npm
- Vercel AI Gateway の API キー（`vck_` で始まる）。Jev も比較用の LLM も、このキー1本で呼びます

### AI_GATEWAY_API_KEY の用意

1. Vercel にログインし、ダッシュボードの AI Gateway の画面で API キーを作成する
2. 無料枠ではレート制限（429）にかかり、全件計測は途中で止まります。また、モデルによっては無料枠で使えません（Claude など）。**AI Gateway にクレジットを入れてから**計測してください。全件計測（60件×3周×2モデル）の実費は $0.03 程度でした
3. リポジトリ直下に `.env.local` を作り、キーを書く

```bash
echo "AI_GATEWAY_API_KEY=vck_xxxxxxxx" > .env.local
```

`.env.local` は `.gitignore` 済みです。キーをコードに直接書いたり、コミットしたりしないでください。

## セットアップ

```bash
npm install
npx tsx src/smoke.ts   # Jev と LLM が Gateway 経由で呼べるかを1回ずつ確認
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run measure` | 本計測。60件 × 3周を、Jev と gpt-4o-mini で直列に実行し、生の応答を `results/raw/<runId>/` に保存する。最初に各モデル1回ずつウォームアップして捨てる。リトライは0回 |
| `npm run measure -- --subset large20 --rounds 1 --llm anthropic/claude-sonnet-4.5` | 比較相手を替えた追加計測（20件は `src/subsets.ts` で固定） |
| `npm run score` | いちばん新しい run を集計して `results/summary.json` と `results/per-case.json` を出す。run を指定するなら `npm run score -- <runId>`。追加計測の分は `npm run score -- <runId> sonnet` で `-sonnet` が付いたファイルに出る |
| `npm run charts` | `results/summary.json` からブログ用の SVG 3枚を `results/charts/` に出す（背景は透明で、ライト・ダークどちらの背景でも読める） |
| `npm run demo` | リプレイのデモ。http://localhost:5173 を開き、クリックか Space キーで開始する（`/?autostart` を付けると読み込み1秒後に自動で始まる）。1280×720 固定の画面。計測済みの12件を、1周目の実測レイテンシどおりの時間で左右同時に再生する |
| `npm run demo:live` | ライブのデモ。その場で API を叩く（計測ではない。左右のレーンを並列に呼ぶので、計測条件とは違う） |
| `npm run typecheck` | TypeScript の型チェック |

注意: `npm run score` は引数なしだと **いちばん新しい run** を集計します。追加計測のあとに本計測を集計し直すときは、runId を指定してください。

## ファイル構成

```
src/
  types.ts        質問の定義（Jev と LLM に送る文面はすべてここ）とカテゴリ
  data.ts         合成データ60件と正解ラベル（難しいケースは迷った理由をコメントに残している）
  jev.ts          Jev を呼ぶ（experimental_evaluate）
  baseline.ts     比較用の LLM を呼ぶ（generateObject による構造化出力）
  common.ts       共通の型と、Gateway の実費の取り出し
  run.ts          計測（直列、ウォームアップ、周回、生の応答の保存）
  score.ts        集計（正解率、レイテンシ p50/p95、コスト、運用シミュレーション）
  charts.ts       ブログ用 SVG
  subsets.ts      追加計測用の20件（結果を見る前に機械的に固定）
  demo-cases.ts   デモ用の12件（結果を見る前に機械的に固定）
  smoke.ts        疎通確認
web/
  server.ts       デモのサーバー（Node 標準の http + SSE、依存の追加なし）
  index.html      デモの画面
results/
  summary*.json   集計結果
  per-case*.json  ケースごとの全周の予測（原文は合成データ）
  charts/         SVG
  raw/            生の応答（gitignore 対象）
RESULTS.md        結果と誤答例、検証の限界
BRIEF.md          この検証の指示書
```

## データについて

`src/data.ts` の60件はすべて合成データです。実在の顧客・予約・連絡先は含みません。ラベル付けは1人で行っています（詳細は RESULTS.md の「この検証の限界」）。
