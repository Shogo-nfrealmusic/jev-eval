// 合成データセット 60件（実顧客データは不使用）。
// 言語: en 30 / zh 12 / ko 9 / ja 9。素直 40件（s01-s40, 8カテゴリ各5件）+ 難しい 20件（h01-h20）。
// カテゴリは 8種 + other（該当なし）。other は実運用で必ず来る「無理やり既存カテゴリに当てはめる」失敗を測るため全件採点する。
//
// ラベル付けのルール（types.ts の質問文と同じ基準）
//   urgency high  : 撮影が今日・明日 / 現地で誰かが待っている / 強い怒り / 約束済みのものを長く待たされている。それ以外は low
//   needsHuman    : 返金・苦情・強い感情・意図不明/情報不足・複数の要件・事業範囲外・ポリシーの例外 → true
//                   単一で定型処理できる依頼 → false

import type { Case } from "./types.ts";

export const CASES: Case[] = [
  // ======================== 素直なケース 40件 ========================

  // ---- reschedule ----
  { id: "s01", lang: "en", hard: false, text: "Hi, we booked a family shoot in Asakusa on October 12. Would it be possible to move it to October 14 at the same time? Thanks!", expected: { category: "reschedule", urgency: "low", needsHuman: false } },
  { id: "s02", lang: "en", hard: false, text: "Could we push our session on Nov 3 from 9am to 3pm instead? Same location (Shibuya Crossing).", expected: { category: "reschedule", urgency: "low", needsHuman: false } },
  { id: "s03", lang: "zh", hard: false, text: "你好，我们预订了10月20日在京都伏见稻荷的拍摄，请问可以改到10月22日吗？", expected: { category: "reschedule", urgency: "low", needsHuman: false } },
  { id: "s04", lang: "ko", hard: false, text: "안녕하세요, 10월 25일 오사카 촬영 예약했는데 26일로 날짜 변경 가능할까요?", expected: { category: "reschedule", urgency: "low", needsHuman: false } },
  { id: "s05", lang: "ja", hard: false, text: "お世話になっております。11月8日の撮影を11月15日に変更したいのですが、空いていますでしょうか。", expected: { category: "reschedule", urgency: "low", needsHuman: false } },

  // ---- cancel ----
  { id: "s06", lang: "en", hard: false, text: "Unfortunately our trip to Japan has been called off. Please cancel our booking for December 2.", expected: { category: "cancel", urgency: "low", needsHuman: false } },
  { id: "s07", lang: "en", hard: false, text: "Hi, I need to cancel the couple shoot we booked for next month. Our plans changed. Sorry for the trouble.", expected: { category: "cancel", urgency: "low", needsHuman: false } },
  { id: "s08", lang: "zh", hard: false, text: "您好，因为行程有变，我想取消11月5日在东京的拍摄预约。", expected: { category: "cancel", urgency: "low", needsHuman: false } },
  { id: "s09", lang: "ko", hard: false, text: "죄송하지만 11월 10일 교토 촬영 예약을 취소하고 싶습니다.", expected: { category: "cancel", urgency: "low", needsHuman: false } },
  { id: "s10", lang: "en", hard: false, text: "Please cancel my reservation for Oct 30. We won't be able to make it.", expected: { category: "cancel", urgency: "low", needsHuman: false } },

  // ---- refund（返金はお金が絡むので needsHuman は常に true）----
  { id: "s11", lang: "en", hard: false, text: "We cancelled our shoot last week, 10 days in advance as per your policy. When will the refund be processed? I haven't received anything yet.", expected: { category: "refund", urgency: "low", needsHuman: true } },
  { id: "s12", lang: "en", hard: false, text: "I was charged twice for my booking on Oct 3. Can you refund the duplicate payment?", expected: { category: "refund", urgency: "low", needsHuman: true } },
  { id: "s13", lang: "zh", hard: false, text: "请问我取消预约后，定金什么时候可以退回到我的信用卡？", expected: { category: "refund", urgency: "low", needsHuman: true } },
  { id: "s14", lang: "ko", hard: false, text: "예약 취소했는데 환불은 언제 되나요? 아직 카드로 들어오지 않았어요.", expected: { category: "refund", urgency: "low", needsHuman: true } },
  { id: "s15", lang: "en", hard: false, text: "Could you confirm how much will be refunded for my cancelled booking? I cancelled 5 days before the shoot date.", expected: { category: "refund", urgency: "low", needsHuman: true } },

  // ---- location ----
  { id: "s16", lang: "en", hard: false, text: "Where exactly is the meeting point for the Fushimi Inari shoot? Is it at the main gate?", expected: { category: "location", urgency: "low", needsHuman: false } },
  { id: "s17", lang: "en", hard: false, text: "Can we do the shoot at the Arashiyama bamboo forest instead of Gion? Is that area covered?", expected: { category: "location", urgency: "low", needsHuman: false } },
  { id: "s18", lang: "zh", hard: false, text: "请问浅草的拍摄在哪里集合？附近有地铁站吗？", expected: { category: "location", urgency: "low", needsHuman: false } },
  { id: "s19", lang: "ja", hard: false, text: "撮影場所はお台場も選べますか？夜景を撮りたいです。", expected: { category: "location", urgency: "low", needsHuman: false } },
  { id: "s20", lang: "en", hard: false, text: "Do you offer shoots at Lake Kawaguchiko near Mt. Fuji, or only in Tokyo?", expected: { category: "location", urgency: "low", needsHuman: false } },

  // ---- pricing ----
  { id: "s21", lang: "en", hard: false, text: "How much is the 2-hour plan for a family of four? Does it include all edited photos?", expected: { category: "pricing", urgency: "low", needsHuman: false } },
  { id: "s22", lang: "en", hard: false, text: "Is there an extra charge for shooting on weekends or at sunrise?", expected: { category: "pricing", urgency: "low", needsHuman: false } },
  { id: "s23", lang: "zh", hard: false, text: "请问情侣拍摄套餐多少钱？包括和服租赁吗？", expected: { category: "pricing", urgency: "low", needsHuman: false } },
  { id: "s24", lang: "ko", hard: false, text: "가족 촬영 1시간 플랜 가격이 얼마인가요? 사진은 몇 장 받을 수 있나요?", expected: { category: "pricing", urgency: "low", needsHuman: false } },
  { id: "s25", lang: "ja", hard: false, text: "プロポーズ撮影のプランの料金を教えてください。", expected: { category: "pricing", urgency: "low", needsHuman: false } },

  // ---- group_size ----
  { id: "s26", lang: "en", hard: false, text: "My parents decided to join us, so we'll be 5 people instead of 3 on Nov 12. Is that okay?", expected: { category: "group_size", urgency: "low", needsHuman: false } },
  { id: "s27", lang: "en", hard: false, text: "One of our friends can't come anymore, so our group will be 3 instead of 4 for the Oct 19 shoot.", expected: { category: "group_size", urgency: "low", needsHuman: false } },
  { id: "s28", lang: "zh", hard: false, text: "我们原来预约是2个人，现在想加上我父母，一共4个人，可以吗？", expected: { category: "group_size", urgency: "low", needsHuman: false } },
  { id: "s29", lang: "ja", hard: false, text: "10月27日の撮影ですが、子どもが1人増えて大人2名・子ども2名になりました。", expected: { category: "group_size", urgency: "low", needsHuman: false } },
  { id: "s30", lang: "en", hard: false, text: "Can we add 2 more people to our group booking for the end of the month?", expected: { category: "group_size", urgency: "low", needsHuman: false } },

  // ---- late_arrival（当日なので urgency は常に high）----
  { id: "s31", lang: "en", hard: false, text: "Hi, our train is delayed, we'll be about 15 minutes late to the meeting point. So sorry!", expected: { category: "late_arrival", urgency: "high", needsHuman: false } },
  { id: "s32", lang: "en", hard: false, text: "Running late! Stuck in traffic, ETA 20 min. Please ask the photographer to wait.", expected: { category: "late_arrival", urgency: "high", needsHuman: false } },
  { id: "s33", lang: "zh", hard: false, text: "不好意思，我们迷路了，大概晚到10分钟。", expected: { category: "late_arrival", urgency: "high", needsHuman: false } },
  { id: "s34", lang: "ko", hard: false, text: "지하철이 지연돼서 15분 정도 늦을 것 같아요. 죄송합니다!", expected: { category: "late_arrival", urgency: "high", needsHuman: false } },
  { id: "s35", lang: "ja", hard: false, text: "すみません、電車が遅れていて10分ほど遅れます。", expected: { category: "late_arrival", urgency: "high", needsHuman: false } },

  // ---- weather ----
  { id: "s36", lang: "en", hard: false, text: "The forecast says rain for our shoot tomorrow. What happens if it rains? Will it be postponed?", expected: { category: "weather", urgency: "high", needsHuman: false } },
  { id: "s37", lang: "en", hard: false, text: "What's your policy if it's raining on the shoot day? Do you still shoot in light rain?", expected: { category: "weather", urgency: "low", needsHuman: false } },
  { id: "s38", lang: "zh", hard: false, text: "明天京都下雨的话，拍摄还会照常进行吗？", expected: { category: "weather", urgency: "high", needsHuman: false } },
  { id: "s39", lang: "ko", hard: false, text: "비가 오면 촬영은 어떻게 되나요? 다음 주 예약이에요.", expected: { category: "weather", urgency: "low", needsHuman: false } },
  { id: "s40", lang: "ja", hard: false, text: "雨天の場合の撮影はどうなりますか？来月予約しています。", expected: { category: "weather", urgency: "low", needsHuman: false } },

  // ======================== 難しいケース 20件 ========================

  // [2カテゴリ] BRIEF の例そのもの。原因は weather だが、依頼している行動は日程変更。
  // 「何をしてほしいか」で振り分けるのが実務なので reschedule を正解にした。明日の件なので high、
  // 天候理由の変更は手数料免除などの判断が要るので needsHuman。
  { id: "h01", lang: "ja", hard: true, text: "台風で飛行機が飛ばないので、明日の撮影を土曜に変えたいです。", expected: { category: "reschedule", urgency: "high", needsHuman: true }, alsoAcceptable: ["weather"] },

  // [3カテゴリ] まだ何も決めておらず「台風ならどうなるか」を聞いている段階なので weather。
  // 返金か日程変更かの二択を求めていて、どちらもあり得る。警報が出ている＝直近なので high。
  { id: "h02", lang: "en", hard: true, text: "Typhoon warning for Saturday. If we can't shoot, do we get our money back or can we move it?", expected: { category: "weather", urgency: "high", needsHuman: true }, alsoAcceptable: ["refund", "reschedule"] },

  // [感情的・情報なし] 何に怒っているのか一切わからない。8つのどれにも当てはまらないので other。
  // 見たいのは、既存カテゴリに無理やり当てはめないか、確率が割れるか、needsHuman を true にできるか。
  { id: "h03", lang: "en", hard: true, text: "Worst experience ever. What is going on with you people??", expected: { category: "other", urgency: "high", needsHuman: true } },

  // [感情的・情報なし] h03 の中国語版。
  { id: "h04", lang: "zh", hard: true, text: "太差劲了，你们到底怎么回事？", expected: { category: "other", urgency: "high", needsHuman: true } },

  // [絵文字・タイプミス・向きが逆] 遅れているのは客ではなくカメラマン側。late_arrival の定義に
  // 「顧客・カメラマンどちらの遅延も含む」と明記しているので late_arrival。現地で待っている＋怒りなので high/true。
  { id: "h05", lang: "en", hard: true, text: "Hey the photographer hasnt shown up yet were at the gate since 10 min?? 😡😡", expected: { category: "late_arrival", urgency: "high", needsHuman: true } },

  // [2カテゴリ・略語] 人数変更と時間変更を同時に依頼。先に書かれていて、料金にも影響する人数変更を主とした。
  // 正直どちらが正解とも言えないので reschedule も準正解。
  { id: "h06", lang: "en", hard: true, text: "tmrw shoot - can we do 4 ppl not 2 and also move to 5pm?? thx", expected: { category: "group_size", urgency: "high", needsHuman: true }, alsoAcceptable: ["reschedule"] },

  // [短すぎる] 予約時間の確認と思われるが、8カテゴリに「予約内容の確認」はないので other。
  // 明日のことなので high、情報不足なので true。
  { id: "h07", lang: "en", hard: true, text: "what time tomorrow?", expected: { category: "other", urgency: "high", needsHuman: true } },

  // [撮影と無関係] 配信停止なので other。事業範囲外なので needsHuman は true とした
  // （このキューに入るべきでないものを人が振り分け直す、という意味）。
  { id: "h08", lang: "en", hard: true, text: "Please unsubscribe me from this mailing list.", expected: { category: "other", urgency: "low", needsHuman: true } },

  // [撮影と無関係] 配信停止の中国語版で other。「停止」が cancel に吸われるかを見たい。
  { id: "h09", lang: "zh", hard: true, text: "请停止给我发邮件", expected: { category: "other", urgency: "low", needsHuman: true } },

  // [3カテゴリ・条件付き] 「明日雨なら取消して返金できるか」。実際の依頼はまだ発生しておらず、
  // 雨天時のポリシーを聞いているので weather。cancel / refund も準正解。明日なので high。
  { id: "h10", lang: "ko", hard: true, text: "내일 비 오면 그냥 취소하고 환불 받을 수 있나요?", expected: { category: "weather", urgency: "high", needsHuman: true }, alsoAcceptable: ["cancel", "refund"] },

  // [敬語・遠回し] 「返金」という単語を使わずに、キャンセル後の支払い済み代金の扱いを聞いている。
  // 「キャンセル」という単語に引っ張られて cancel にならないかを見たい。
  { id: "h11", lang: "ja", hard: true, text: "先日キャンセルさせていただいた件で、お支払い済みの代金のお取り扱いについてご教示いただけますと幸いです。", expected: { category: "refund", urgency: "low", needsHuman: true } },

  // [関西弁] 当日30分遅れ。撮影時間が削れるかもしれず、どうすればいいか聞いているので needsHuman。
  { id: "h12", lang: "ja", hard: true, text: "今日の撮影なんやけど、電車止まってもうて30分くらい遅れそうやねん…間に合わんかったらどないしよ", expected: { category: "late_arrival", urgency: "high", needsHuman: true } },

  // [タイプミス] 中身は素直な日程変更。タイプミスだけで崩れるかを見る。
  { id: "h13", lang: "en", hard: true, text: "Hi can we chnage the dat of our shoot from the 15th to the 17h? sry for typos on my phone", expected: { category: "reschedule", urgency: "low", needsHuman: false } },

  // [絵文字・カテゴリ外] 撮影後の写真納品の催促。8カテゴリに「納品」がないので other。
  // 2週間待たされていて放置できないので high、不満があるので needsHuman。
  { id: "h14", lang: "zh", hard: true, text: "摄影师人很好👍 但是照片什么时候能收到啊？已经两周了😢", expected: { category: "other", urgency: "high", needsHuman: true } },

  // [遅刻 vs 日程変更] まだ当日ではなく、遅れそうなので時間を後ろにずらすべきかの相談。
  // 行動としては時間変更なので reschedule。late_arrival も準正解。判断が要るので true。
  { id: "h15", lang: "en", hard: true, text: "We might be a bit late tomorrow morning because our flight lands at 7. Is the 9am shoot still ok or should we move it later?", expected: { category: "reschedule", urgency: "high", needsHuman: true }, alsoAcceptable: ["late_arrival"] },

  // [人数 vs 料金] 発端は人数の追加だが、聞いているのは金額なので pricing が主。group_size は準正解。
  // 定型の料金案内で済むので false。
  { id: "h16", lang: "en", hard: true, text: "How much would it cost to add my grandparents? They just decided to come.", expected: { category: "pricing", urgency: "low", needsHuman: false }, alsoAcceptable: ["group_size"] },

  // [3カテゴリ] 雨なら屋内に変わるか（天候・場所）、料金も変わるか（料金）。起点が天候なので weather。
  { id: "h17", lang: "ko", hard: true, text: "촬영장소가 비가 오면 실내로 바뀌나요? 그럼 가격도 달라지나요?", expected: { category: "weather", urgency: "low", needsHuman: true }, alsoAcceptable: ["location", "pricing"] },

  // [短すぎる・繁体字] 「日程変更できますか」だけ。カテゴリは明確だが、日付も予約も書いていないので needsHuman。
  { id: "h18", lang: "zh", hard: true, text: "請問可以改期嗎", expected: { category: "reschedule", urgency: "low", needsHuman: true } },

  // [場所・範囲外の可能性] 北海道で結婚式の撮影。聞いているのは場所だが、
  // エリア外かつ別サービス（ウェディング）の可能性が高く、人の判断が要る。
  { id: "h19", lang: "en", hard: true, text: "I booked with you guys last year and loved it! Do you do wedding shoots in Hokkaido?? 😍📸", expected: { category: "location", urgency: "low", needsHuman: true } },

  // [短すぎる] 「キャンセルしてください」だけ。どの予約か分からないので needsHuman。いつの予約かも不明なので low。
  { id: "h20", lang: "ko", hard: true, text: "취소해주세요.", expected: { category: "cancel", urgency: "low", needsHuman: true } },
];
