import Anthropic from "@anthropic-ai/sdk";
import Replicate from "replicate";

/**
 * バーチャルステージングサービス（AI家具配置）
 *
 * 物件写真に AI を使って家具・インテリアを合成し、
 * 入居者がより具体的な生活イメージを持てるようにする。
 *
 * フロー:
 *   1. Claude Vision で部屋タイプ・広さ・採光を分析
 *   2. 部屋タイプに合ったスタイリングプロンプトを生成
 *   3. Replicate (Stable Diffusion img2img) で家具配置画像を生成
 *
 * 必要な環境変数:
 *   ANTHROPIC_API_KEY  - Claude API キー（既存）
 *   REPLICATE_API_TOKEN - Replicate API トークン
 */

const anthropic = new Anthropic();

// バーチャルステージングモデル（Replicate）
// interior design / virtual staging 専用モデル
const STAGING_MODEL = "adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8b1bd48494f5ba77e98d94e2d";

export interface StagingAnalysis {
  roomType: string;       // "リビング" | "寝室" | "ダイニング" | "洋室" | etc.
  style: string;          // "モダン" | "ナチュラル" | "シンプル" | etc.
  lightCondition: string; // "明るい" | "やや暗い" | etc.
  sizeFeel: string;       // "広々" | "コンパクト" | etc.
  promptJa: string;       // 日本語スタイリング説明
  promptEn: string;       // Stable Diffusion 用英語プロンプト
}

export interface StagingResult {
  success: boolean;
  originalUrl: string;
  stagedUrl: string | null;
  analysis: StagingAnalysis | null;
  error?: string;
}

// ---------------------------------------------------------------
// 部屋分析（Claude Vision）
// ---------------------------------------------------------------

export async function analyzeRoom(
  imageUrl: string,
  roomLayout: string | null,
): Promise<StagingAnalysis> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: imageUrl },
          },
          {
            type: "text",
            text: `この部屋の写真を分析してください。間取りは「${roomLayout ?? "不明"}」です。
以下のJSON形式で出力してください（JSONのみ出力）:

{
  "roomType": "部屋タイプ（リビング/寝室/ダイニング/洋室/キッチン/バス等）",
  "style": "推奨スタイル（モダン/ナチュラル/シンプル/北欧/和モダン等）",
  "lightCondition": "採光状況（明るい/やや明るい/やや暗い/暗い）",
  "sizeFeel": "広さ感（広々/ゆったり/コンパクト/狭め）",
  "promptJa": "家具配置の日本語説明（50文字以内）",
  "promptEn": "Stable Diffusion用英語プロンプト（例: modern Japanese apartment living room, furnished with sofa, coffee table, plants, natural light, high quality interior photography）"
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("部屋分析結果のパースに失敗しました");

  return JSON.parse(jsonMatch[0]) as StagingAnalysis;
}

// ---------------------------------------------------------------
// バーチャルステージング画像生成（Replicate）
// ---------------------------------------------------------------

export async function generateStagedImage(
  imageUrl: string,
  analysis: StagingAnalysis,
): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN を .env に設定してください");

  const replicate = new Replicate({ auth: token });

  const output = await replicate.run(STAGING_MODEL as `${string}/${string}:${string}`, {
    input: {
      image: imageUrl,
      prompt: analysis.promptEn,
      negative_prompt:
        "cluttered, messy, dirty, dark, low quality, blurry, distorted, people, text, watermark",
      num_inference_steps: 30,
      guidance_scale: 7.5,
      strength: 0.6, // 0=元画像維持, 1=完全生成。0.6で家具追加しつつ部屋構造を維持
      seed: 42,
    },
  });

  // Replicate の出力は配列またはURL文字列
  if (Array.isArray(output) && output.length > 0) {
    return output[0] as string;
  }
  if (typeof output === "string") {
    return output;
  }

  throw new Error("Replicate から有効な画像URLが返りませんでした");
}

// ---------------------------------------------------------------
// メイン処理: 1枚の画像をバーチャルステージング
// ---------------------------------------------------------------

export async function applyVirtualStaging(
  imageUrl: string,
  roomLayout: string | null,
): Promise<StagingResult> {
  try {
    // Step1: Claude Vision で部屋を分析
    const analysis = await analyzeRoom(imageUrl, roomLayout);

    // Step2: Replicate で家具配置画像を生成
    const stagedUrl = await generateStagedImage(imageUrl, analysis);

    return {
      success: true,
      originalUrl: imageUrl,
      stagedUrl,
      analysis,
    };
  } catch (err) {
    return {
      success: false,
      originalUrl: imageUrl,
      stagedUrl: null,
      analysis: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------
// 複数画像の一括ステージング（物件の全写真を処理）
// ---------------------------------------------------------------

export async function applyBatchStaging(
  imageUrls: string[],
  roomLayout: string | null,
  maxImages = 3, // コスト抑制のため最大3枚
): Promise<StagingResult[]> {
  const targets = imageUrls.slice(0, maxImages);
  return Promise.all(targets.map((url) => applyVirtualStaging(url, roomLayout)));
}
