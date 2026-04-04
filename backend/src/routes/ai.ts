import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * 切り返しAI API
 *
 * 顧客の断り文句・懸念に対する切り返しトーク3パターンを生成。
 * 担当者のreply_styleに合わせたトーン調整。
 * よくある断り文句パターンのDB化と成功事例の蓄積。
 */

const aiRoutes = new Hono();
const anthropic = new Anthropic();

// ---------------------------------------------------------------
// よくある断り文句パターン（初期データ）
// ---------------------------------------------------------------

const COMMON_OBJECTIONS: {
  pattern: string;
  category: string;
  keywords: string[];
}[] = [
  { pattern: "家賃が高い", category: "price", keywords: ["高い", "予算", "賃料", "家賃"] },
  { pattern: "もう少し考えたい", category: "timing", keywords: ["考え", "検討", "迷", "まだ"] },
  { pattern: "他の物件も見たい", category: "comparison", keywords: ["他", "比較", "もっと", "別"] },
  { pattern: "遠い・立地が合わない", category: "location", keywords: ["遠い", "立地", "通勤", "アクセス"] },
  { pattern: "設備が足りない", category: "facility", keywords: ["設備", "ない", "欲しい", "必要"] },
  { pattern: "築年数が古い", category: "age", keywords: ["古い", "築", "年数", "新しい"] },
  { pattern: "間取りが合わない", category: "layout", keywords: ["狭い", "広い", "間取り", "部屋数"] },
  { pattern: "引越し時期が合わない", category: "timing_move", keywords: ["時期", "引越", "入居", "いつ"] },
  { pattern: "初期費用が高い", category: "initial_cost", keywords: ["初期", "敷金", "礼金", "費用"] },
  { pattern: "家族に相談したい", category: "third_party", keywords: ["家族", "相談", "パートナー", "親"] },
];

// ---------------------------------------------------------------
// POST /api/ai/comeback - 切り返しトーク生成
// ---------------------------------------------------------------

const comebackSchema = z.object({
  /** 顧客の断り文句テキスト */
  objection: z.string().min(1).max(2000),
  /** 担当者ID（reply_style参照用） */
  userId: z.string().uuid().optional(),
  /** 物件コンテキスト（任意） */
  propertyContext: z
    .object({
      name: z.string().optional(),
      rent: z.number().optional(),
      address: z.string().optional(),
      features: z.array(z.string()).optional(),
    })
    .optional(),
  /** 顧客コンテキスト（任意） */
  customerContext: z
    .object({
      name: z.string().optional(),
      budget: z.number().optional(),
      preferences: z.string().optional(),
    })
    .optional(),
});

aiRoutes.post("/comeback", async (c) => {
  const body = await c.req.json();
  const parsed = comebackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      400,
    );
  }

  const { objection, userId, propertyContext, customerContext } = parsed.data;

  // 断り文句のカテゴリを自動分類
  const category = classifyObjection(objection);

  // 担当者の返信スタイルを取得
  let replyStyle: Record<string, unknown> = {};
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { replyStyle: true, name: true },
    });
    if (user?.replyStyle) {
      replyStyle = user.replyStyle as Record<string, unknown>;
    }
  }

  // 過去の成功事例を検索
  const pastSuccesses = await findPastSuccesses(category);

  // Claude API で切り返しトーク3パターンを生成
  const comebacks = await generateComebacks({
    objection,
    category,
    replyStyle,
    propertyContext,
    customerContext,
    pastSuccesses,
  });

  return c.json({
    data: {
      objection,
      category,
      comebacks,
    },
  });
});

// ---------------------------------------------------------------
// POST /api/ai/comeback/save - 成功した切り返し事例を保存
// ---------------------------------------------------------------

const saveComebackSchema = z.object({
  companyId: z.string().uuid(),
  objection: z.string().min(1),
  category: z.string().min(1),
  comeback: z.string().min(1),
  outcome: z.enum(["success", "partial", "failure"]),
  userId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

aiRoutes.post("/comeback/save", async (c) => {
  const body = await c.req.json();
  const parsed = saveComebackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      400,
    );
  }

  // タスクとして保存（専用テーブルがないため、Task を流用）
  const task = await prisma.task.create({
    data: {
      companyId: parsed.data.companyId,
      assignedUserId: parsed.data.userId,
      title: `切り返し事例: ${parsed.data.category}`,
      description: JSON.stringify({
        type: "comeback_case",
        objection: parsed.data.objection,
        category: parsed.data.category,
        comeback: parsed.data.comeback,
        outcome: parsed.data.outcome,
        notes: parsed.data.notes,
      }),
      taskType: "other",
      priority: "low",
      status: "done",
      completedAt: new Date(),
    },
  });

  return c.json({ data: { id: task.id, saved: true } }, 201);
});

// ---------------------------------------------------------------
// GET /api/ai/comeback/patterns - よくある断り文句パターン一覧
// ---------------------------------------------------------------

aiRoutes.get("/comeback/patterns", async (c) => {
  return c.json({ data: COMMON_OBJECTIONS });
});

// ---------------------------------------------------------------
// 断り文句カテゴリ分類
// ---------------------------------------------------------------

function classifyObjection(text: string): string {
  const lower = text.toLowerCase();

  for (const pattern of COMMON_OBJECTIONS) {
    if (pattern.keywords.some((kw) => lower.includes(kw))) {
      return pattern.category;
    }
  }

  return "other";
}

// ---------------------------------------------------------------
// 過去の成功事例検索
// ---------------------------------------------------------------

async function findPastSuccesses(
  category: string,
): Promise<{ objection: string; comeback: string }[]> {
  // Task テーブルから切り返し事例を検索
  const tasks = await prisma.task.findMany({
    where: {
      title: { startsWith: "切り返し事例:" },
      status: "done",
      description: { contains: `"category":"${category}"` },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return tasks
    .map((t) => {
      try {
        const data = JSON.parse(t.description ?? "{}");
        if (data.outcome === "success" || data.outcome === "partial") {
          return { objection: data.objection, comeback: data.comeback };
        }
        return null;
      } catch {
        return null;
      }
    })
    .filter((x): x is { objection: string; comeback: string } => x !== null);
}

// ---------------------------------------------------------------
// Claude API: 切り返しトーク生成
// ---------------------------------------------------------------

interface ComebackInput {
  objection: string;
  category: string;
  replyStyle: Record<string, unknown>;
  propertyContext?: { name?: string; rent?: number; address?: string; features?: string[] };
  customerContext?: { name?: string; budget?: number; preferences?: string };
  pastSuccesses: { objection: string; comeback: string }[];
}

interface ComebackResult {
  /** 切り返しトーク */
  text: string;
  /** アプローチの説明 */
  approach: string;
  /** トーン（ソフト/ニュートラル/アサーティブ） */
  tone: string;
}

async function generateComebacks(
  input: ComebackInput,
): Promise<ComebackResult[]> {
  const toneInstruction = input.replyStyle.tone
    ? `担当者のトーン: ${input.replyStyle.tone}`
    : "トーン: 丁寧で親しみやすい";

  const customInstructions = input.replyStyle.customInstructions
    ? `\n追加指示: ${input.replyStyle.customInstructions}`
    : "";

  const propertyInfo = input.propertyContext
    ? `\n物件情報: ${input.propertyContext.name ?? ""}（${input.propertyContext.address ?? ""}、${input.propertyContext.rent ? `${input.propertyContext.rent / 10000}万円` : ""}）${input.propertyContext.features?.length ? `、設備: ${input.propertyContext.features.join("・")}` : ""}`
    : "";

  const customerInfo = input.customerContext
    ? `\n顧客情報: ${input.customerContext.name ?? ""}${input.customerContext.budget ? `、予算${input.customerContext.budget}万円` : ""}${input.customerContext.preferences ? `、${input.customerContext.preferences}` : ""}`
    : "";

  const pastExamples =
    input.pastSuccesses.length > 0
      ? `\n\n## 過去の成功事例\n${input.pastSuccesses.map((s) => `- 断り: 「${s.objection}」→ 切り返し: 「${s.comeback}」`).join("\n")}`
      : "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `あなたは不動産営業のベテランコーチです。
顧客の断り文句に対する効果的な切り返しトークを3パターン生成してください。

## ルール
- 押し売りにならない、顧客の懸念に寄り添うアプローチ
- ${toneInstruction}${customInstructions}
- 具体的な提案や代替案を含める
- 各パターンは異なるアプローチ（共感型、提案型、質問型など）
- 不動産業界の専門知識を活かす
- 1パターン150文字以内

## 出力形式
必ず以下のJSON配列で出力してください。JSONのみ出力してください。
[
  {"text": "切り返しトーク", "approach": "アプローチ説明", "tone": "soft|neutral|assertive"},
  {"text": "...", "approach": "...", "tone": "..."},
  {"text": "...", "approach": "...", "tone": "..."}
]`,
      messages: [
        {
          role: "user",
          content: `顧客の断り文句: 「${input.objection}」
カテゴリ: ${input.category}${propertyInfo}${customerInfo}${pastExamples}

上記に対する切り返しトーク3パターンをJSON配列で出力してください。`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [
        {
          text: "ご不安をお感じなのですね。一緒に最適な解決策を考えましょう。",
          approach: "共感型（フォールバック）",
          tone: "soft",
        },
      ];
    }

    const parsed = JSON.parse(jsonMatch[0]) as ComebackResult[];
    return parsed.slice(0, 3);
  } catch {
    return [
      {
        text: "ご不安をお感じなのですね。一緒に最適な解決策を考えましょう。",
        approach: "共感型（フォールバック）",
        tone: "soft",
      },
    ];
  }
}

export { aiRoutes };
