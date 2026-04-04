import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------
// Claude API を使った不動産チャット自動対応サービス
// ---------------------------------------------------------------

const client = new Anthropic();

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------
// 営業時間判定
// ---------------------------------------------------------------

interface BusinessHours {
  /** 開始時刻 (HH:MM, 24h) */
  start: string;
  /** 終了時刻 (HH:MM, 24h) */
  end: string;
  /** 営業曜日 (0=日, 1=月, ..., 6=土) */
  businessDays: number[];
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  start: "09:00",
  end: "18:00",
  businessDays: [1, 2, 3, 4, 5], // 月〜金
};

export function isWithinBusinessHours(
  settings: Record<string, unknown> = {},
): boolean {
  const hours: BusinessHours = {
    start:
      (settings.business_hours_start as string) ??
      DEFAULT_BUSINESS_HOURS.start,
    end:
      (settings.business_hours_end as string) ?? DEFAULT_BUSINESS_HOURS.end,
    businessDays:
      (settings.business_days as number[]) ??
      DEFAULT_BUSINESS_HOURS.businessDays,
  };

  const now = new Date();
  // 日本時間に変換
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const day = jst.getDay();
  const hhmm = `${String(jst.getHours()).padStart(2, "0")}:${String(jst.getMinutes()).padStart(2, "0")}`;

  if (!hours.businessDays.includes(day)) return false;
  return hhmm >= hours.start && hhmm < hours.end;
}

// ---------------------------------------------------------------
// チャットメッセージ型
// ---------------------------------------------------------------

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReplyStyle {
  tone?: string; // "丁寧" | "フレンドリー" | "ビジネス"
  signature?: string; // 担当者名の署名
  customInstructions?: string; // 追加指示
}

// ---------------------------------------------------------------
// システムプロンプト
// ---------------------------------------------------------------

function buildSystemPrompt(opts: {
  companyName: string;
  assigneeName?: string;
  replyStyle: ReplyStyle;
  isBusinessHours: boolean;
}): string {
  const styleInstructions = opts.replyStyle.tone
    ? `返信トーン: ${opts.replyStyle.tone}`
    : "返信トーン: 丁寧で親しみやすい";

  const customInstructions = opts.replyStyle.customInstructions
    ? `\n追加指示: ${opts.replyStyle.customInstructions}`
    : "";

  const signature = opts.replyStyle.signature
    ? `\n署名: ${opts.replyStyle.signature}`
    : opts.assigneeName
      ? `\n署名: ${opts.assigneeName}`
      : "";

  const modeDescription = opts.isBusinessHours
    ? `現在は営業時間内です。あなたは担当者の返信下書きを作成するアシスタントです。
担当者が確認・編集してから顧客に送信します。
提案スタイルで書いてください（「〜はいかがでしょうか」「〜をご提案いたします」）。`
    : `現在は営業時間外です。あなたは顧客に直接対応するAIアシスタントです。
営業時間外であることを最初に伝え、翌営業日に担当者から改めて連絡する旨を添えてください。
ただし、基本的な質問（物件の空き状況、内見予約の希望受付、一般的な不動産Q&A）には可能な限り回答してください。`;

  return `あなたは「${opts.companyName}」の不動産AIアシスタントです。

## 役割
${modeDescription}

## 専門領域
- 賃貸・売買物件の案内
- 内見予約の受付・調整
- 契約手続きの説明
- 周辺環境・交通アクセスの情報提供
- 初期費用の概算説明

## 返信ルール
- ${styleInstructions}${customInstructions}
- 専門用語は分かりやすく言い換える
- 具体的な金額や条件は「目安」「参考」と明記し、正式には担当者確認が必要と伝える
- 個人情報の取得を求めない（顧客が自発的に共有した場合のみ記録）
- 競合他社の批判をしない
- 法的助言はしない（「宅建士にご確認ください」と案内）
- 1回の返信は300文字以内を目安に簡潔に${signature}

## 禁止事項
- 物件の確定的な空き状況を断言しない（「確認いたします」と回答）
- 審査結果の予測をしない
- 値引き交渉の確約をしない`;
}

// ---------------------------------------------------------------
// AI返信生成
// ---------------------------------------------------------------

export interface GenerateReplyInput {
  /** 顧客のメッセージ */
  customerMessage: string;
  /** チャット履歴（直近のやり取り） */
  chatHistory: ChatHistoryMessage[];
  /** 会社名 */
  companyName: string;
  /** 担当者名 */
  assigneeName?: string;
  /** 担当者の返信スタイル */
  replyStyle?: ReplyStyle;
  /** 営業時間内か */
  isBusinessHours: boolean;
}

export interface GenerateReplyResult {
  /** AI生成の返信テキスト */
  reply: string;
  /** 営業時間内ならtrue（下書きモード） */
  isDraft: boolean;
  /** 使用トークン数 */
  usage: { inputTokens: number; outputTokens: number };
}

export async function generateReply(
  input: GenerateReplyInput,
): Promise<GenerateReplyResult> {
  const systemPrompt = buildSystemPrompt({
    companyName: input.companyName,
    assigneeName: input.assigneeName,
    replyStyle: input.replyStyle ?? {},
    isBusinessHours: input.isBusinessHours,
  });

  // チャット履歴を Anthropic Messages API の形式に変換
  const messages: Anthropic.MessageParam[] = [
    ...input.chatHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: input.customerMessage },
  ];

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const reply =
    response.content[0].type === "text" ? response.content[0].text : "";

  return {
    reply,
    isDraft: input.isBusinessHours,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
