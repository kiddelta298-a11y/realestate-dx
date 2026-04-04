import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * 物件掲載情報の自動解析サービス
 *
 * Claude API を使用して:
 * 1. テキスト（チラシ文面等）から物件情報を構造化抽出
 * 2. 画像（物件チラシ等）から物件情報をOCR + 構造化抽出
 * 3. 不動産ポータルURLのHTMLから物件情報を構造化抽出
 */

const client = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------
// 抽出結果の型定義
// ---------------------------------------------------------------

export const extractedPropertySchema = z.object({
  name: z.string().describe("物件名"),
  propertyType: z
    .enum(["apartment", "mansion", "house", "office"])
    .describe("種別"),
  address: z.string().describe("住所"),
  nearestStation: z.string().nullable().describe("最寄駅"),
  walkMinutes: z.number().int().nullable().describe("徒歩分数"),
  rent: z.number().int().describe("賃料（円）"),
  managementFee: z.number().int().describe("管理費（円）"),
  deposit: z.number().int().describe("敷金（円）"),
  keyMoney: z.number().int().describe("礼金（円）"),
  roomLayout: z.string().nullable().describe("間取り"),
  floorArea: z.number().nullable().describe("面積（m2）"),
  floor: z.number().int().nullable().describe("階数"),
  totalFloors: z.number().int().nullable().describe("総階数"),
  builtYear: z.number().int().nullable().describe("築年"),
  availableFrom: z.string().nullable().describe("入居可能日 (YYYY-MM-DD)"),
  features: z.array(z.string()).describe("設備・特徴"),
  description: z.string().nullable().describe("物件説明"),
});

export type ExtractedProperty = z.infer<typeof extractedPropertySchema>;

export interface ExtractionResult {
  /** 抽出成功 */
  success: boolean;
  /** 抽出された物件データ */
  property: ExtractedProperty | null;
  /** 信頼度（0.0〜1.0） */
  confidence: number;
  /** 抽出元の情報 */
  source: "text" | "image" | "url";
  /** 注意事項・不明点 */
  warnings: string[];
  /** エラーメッセージ */
  error?: string;
}

// ---------------------------------------------------------------
// 共通プロンプト
// ---------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `あなたは不動産物件情報の自動抽出エンジンです。
与えられたテキストや画像から物件情報を正確に構造化データとして抽出してください。

## 出力形式
必ず以下のJSON形式で出力してください。JSONのみ出力し、他のテキストは含めないでください。

{
  "property": {
    "name": "物件名（不明な場合はアドレスから推定）",
    "propertyType": "apartment | mansion | house | office",
    "address": "住所（都道府県から）",
    "nearestStation": "最寄駅名（null可）",
    "walkMinutes": 数値（null可）,
    "rent": 賃料（円単位の整数）,
    "managementFee": 管理費（円、不明なら0）,
    "deposit": 敷金（円、不明なら0）,
    "keyMoney": 礼金（円、不明なら0）,
    "roomLayout": "間取り（1K, 1LDK等、null可）",
    "floorArea": 面積（m2、null可）,
    "floor": 階数（null可）,
    "totalFloors": 総階数（null可）,
    "builtYear": 築年（西暦4桁、null可）,
    "availableFrom": "入居可能日（YYYY-MM-DD、null可）",
    "features": ["設備1", "設備2", ...],
    "description": "物件の概要説明（null可）"
  },
  "confidence": 0.0〜1.0の信頼度,
  "warnings": ["不明点や注意事項の配列"]
}

## ルール
- 「万円」は円に変換（例: 8.5万 → 85000）
- 「築○年」は西暦に変換（例: 2024年3月時点で「築5年」→ 2019）
- propertyType の判定: マンション/アパート/一戸建て/事務所から推定
- features は設備名を配列で列挙（オートロック, 宅配BOX, バス・トイレ別 等）
- 不明な項目は null を設定
- 信頼度は情報の明確さに基づいて判定（全情報明確=0.9以上、推定多い=0.5以下）`;

// ---------------------------------------------------------------
// テキストから物件情報を抽出
// ---------------------------------------------------------------

export async function extractFromText(
  text: string,
): Promise<ExtractionResult> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下のテキストから物件情報を抽出してJSON形式で出力してください。\n\n---\n${text}\n---`,
        },
      ],
    });

    return parseExtractionResponse(response, "text");
  } catch (err) {
    return {
      success: false,
      property: null,
      confidence: 0,
      source: "text",
      warnings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------
// 画像から物件情報を抽出
// ---------------------------------------------------------------

export async function extractFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<ExtractionResult> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text: "この物件チラシ/画像から物件情報を読み取り、JSON形式で出力してください。",
            },
          ],
        },
      ],
    });

    return parseExtractionResponse(response, "image");
  } catch (err) {
    return {
      success: false,
      property: null,
      confidence: 0,
      source: "image",
      warnings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------
// URLから物件情報を抽出
// ---------------------------------------------------------------

export async function extractFromUrl(
  url: string,
): Promise<ExtractionResult> {
  try {
    // URLからHTMLを取得
    const html = await fetchPageContent(url);

    // HTMLからテキストコンテンツを抽出（タグ除去、主要部分のみ）
    const textContent = stripHtml(html);

    // テキストが大きすぎる場合はトリミング
    const trimmed = textContent.slice(0, 8000);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下は不動産ポータルサイトの物件ページのテキストコンテンツです。物件情報を抽出してJSON形式で出力してください。\n\nURL: ${url}\n\n---\n${trimmed}\n---`,
        },
      ],
    });

    return parseExtractionResponse(response, "url");
  } catch (err) {
    return {
      success: false,
      property: null,
      confidence: 0,
      source: "url",
      warnings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------

/**
 * Claude API レスポンスをパースして ExtractionResult に変換
 */
function parseExtractionResponse(
  response: Anthropic.Message,
  source: "text" | "image" | "url",
): ExtractionResult {
  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // JSON部分を抽出（```json ... ``` や余分なテキストを除去）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      success: false,
      property: null,
      confidence: 0,
      source,
      warnings: ["AIの応答からJSONを抽出できませんでした"],
      error: "JSON parse failed",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const propertyData = parsed.property ?? parsed;

    // Zodでバリデーション（部分一致でも許容）
    const result = extractedPropertySchema.safeParse(propertyData);

    if (result.success) {
      return {
        success: true,
        property: result.data,
        confidence: parsed.confidence ?? 0.7,
        source,
        warnings: parsed.warnings ?? [],
      };
    }

    // バリデーション失敗でも、部分的に使えるデータがあれば返す
    return {
      success: true,
      property: {
        name: propertyData.name ?? "不明",
        propertyType: propertyData.propertyType ?? "apartment",
        address: propertyData.address ?? "不明",
        nearestStation: propertyData.nearestStation ?? null,
        walkMinutes: propertyData.walkMinutes ?? null,
        rent: propertyData.rent ?? 0,
        managementFee: propertyData.managementFee ?? 0,
        deposit: propertyData.deposit ?? 0,
        keyMoney: propertyData.keyMoney ?? 0,
        roomLayout: propertyData.roomLayout ?? null,
        floorArea: propertyData.floorArea ?? null,
        floor: propertyData.floor ?? null,
        totalFloors: propertyData.totalFloors ?? null,
        builtYear: propertyData.builtYear ?? null,
        availableFrom: propertyData.availableFrom ?? null,
        features: Array.isArray(propertyData.features)
          ? propertyData.features
          : [],
        description: propertyData.description ?? null,
      },
      confidence: (parsed.confidence ?? 0.5) * 0.8, // バリデーション失敗分を減点
      source,
      warnings: [
        ...(parsed.warnings ?? []),
        "一部フィールドのバリデーションに失敗したため、デフォルト値で補完しました",
      ],
    };
  } catch {
    return {
      success: false,
      property: null,
      confidence: 0,
      source,
      warnings: ["JSONのパースに失敗しました"],
      error: "JSON parse failed",
    };
  }
}

/**
 * URLからHTMLコンテンツを取得
 */
async function fetchPageContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * HTMLからテキストコンテンツを抽出（簡易パーサー）
 */
function stripHtml(html: string): string {
  return (
    html
      // script, style, head タグの中身を除去
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      // HTMLタグを除去
      .replace(/<[^>]+>/g, " ")
      // HTMLエンティティをデコード
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
      // 連続空白を整理
      .replace(/\s+/g, " ")
      .trim()
  );
}
