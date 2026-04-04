import { prisma } from "../lib/prisma.js";
import {
  generatePropertyEmbedding,
  generatePreferencesEmbedding,
  type PropertyForEmbedding,
  type PreferencesForEmbedding,
} from "./embedding.js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * 高精度物件提案エンジン
 *
 * アーキテクチャ設計書に基づくスコアリング:
 *   - ベクトル類似度: 60%
 *   - 条件一致率:     25%
 *   - 新着ボーナス:   10%
 *   - 担当者推薦:      5%
 */

const anthropic = new Anthropic();

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

export interface RecommendInput {
  customerId: string;
  companyId: string;
  /** 上位N件（デフォルト5） */
  limit?: number;
  /** 担当者が推薦する物件IDリスト */
  boostedPropertyIds?: string[];
}

export interface RecommendedProperty {
  propertyId: string;
  name: string;
  address: string;
  rent: number;
  roomLayout: string | null;
  nearestStation: string | null;
  walkMinutes: number | null;
  totalScore: number;
  vectorScore: number;
  conditionScore: number;
  recencyScore: number;
  boostScore: number;
  matchReasons: string[];
  imageUrl: string | null;
}

// ---------------------------------------------------------------
// スコアリング定数
// ---------------------------------------------------------------
const WEIGHT_VECTOR = 0.60;
const WEIGHT_CONDITION = 0.25;
const WEIGHT_RECENCY = 0.10;
const WEIGHT_BOOST = 0.05;

// ---------------------------------------------------------------
// メインロジック
// ---------------------------------------------------------------

export async function recommendProperties(
  input: RecommendInput,
): Promise<RecommendedProperty[]> {
  const limit = input.limit ?? 5;

  // 1. 顧客の希望条件を取得
  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    include: { preferences: true },
  });
  if (!customer) throw new Error("顧客が見つかりません");

  const pref = customer.preferences;

  // 2. ハードフィルタで候補物件を絞り込む（空室のみ）
  const candidates = await getFilteredCandidates(input.companyId, pref);
  if (candidates.length === 0) return [];

  // 3. 顧客の希望条件ベクトルを生成
  const prefEmbedding = pref
    ? generatePreferencesEmbedding({
        budgetMin: pref.budgetMin,
        budgetMax: pref.budgetMax,
        areaIds: pref.areaIds,
        stationIds: pref.stationIds,
        walkMinutesMax: pref.walkMinutesMax,
        roomLayout: pref.roomLayout,
        floorAreaMin: pref.floorAreaMin ? Number(pref.floorAreaMin) : null,
        mustConditions: pref.mustConditions,
        niceConditions: pref.niceConditions,
      })
    : null;

  // 4. 顧客の過去の反応（提案に対するリアクション）を取得
  const pastReactions = await prisma.propertyProposal.findMany({
    where: { customerId: input.customerId },
    select: { propertyId: true, customerReaction: true },
  });
  const interestedPropertyIds = new Set(
    pastReactions
      .filter((r) => r.customerReaction === "interested")
      .map((r) => r.propertyId),
  );
  const rejectedPropertyIds = new Set(
    pastReactions
      .filter((r) => r.customerReaction === "rejected")
      .map((r) => r.propertyId),
  );

  // 5. 各候補物件のスコアを算出
  const scored: RecommendedProperty[] = [];
  const boostedSet = new Set(input.boostedPropertyIds ?? []);

  for (const prop of candidates) {
    // 拒否済み物件はスキップ
    if (rejectedPropertyIds.has(prop.id)) continue;

    // ベクトル類似度
    const propEmbedding = generatePropertyEmbedding(prop as PropertyForEmbedding);
    const vectorScore = prefEmbedding
      ? cosineSimilarity(prefEmbedding, propEmbedding)
      : 0.5; // 希望条件未設定時は中立

    // 条件一致率
    const { conditionScore, matchReasons } = calculateConditionScore(prop, pref);

    // 新着ボーナス（7日以内=1.0、30日以内=0.5、それ以上=0）
    const daysSinceCreated =
      (Date.now() - new Date(prop.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore =
      daysSinceCreated <= 7 ? 1.0 : daysSinceCreated <= 30 ? 0.5 : 0;

    // 担当者推薦ブースト
    const boostScore = boostedSet.has(prop.id) ? 1.0 : 0;

    // 過去に興味を示した物件に類似しているかのボーナス（条件スコアに上乗せ）
    const interestBonus = interestedPropertyIds.has(prop.id) ? 0.1 : 0;

    // 総合スコア
    const totalScore =
      WEIGHT_VECTOR * vectorScore +
      WEIGHT_CONDITION * (conditionScore + interestBonus) +
      WEIGHT_RECENCY * recencyScore +
      WEIGHT_BOOST * boostScore;

    // 画像取得
    const firstImage = await prisma.propertyImage.findFirst({
      where: { propertyId: prop.id },
      orderBy: { sortOrder: "asc" },
    });

    scored.push({
      propertyId: prop.id,
      name: prop.name,
      address: prop.address,
      rent: prop.rent,
      roomLayout: prop.roomLayout,
      nearestStation: prop.nearestStation,
      walkMinutes: prop.walkMinutes,
      totalScore: Math.round(totalScore * 10000) / 10000,
      vectorScore: Math.round(vectorScore * 10000) / 10000,
      conditionScore: Math.round(conditionScore * 10000) / 10000,
      recencyScore,
      boostScore,
      matchReasons,
      imageUrl: firstImage?.url ?? null,
    });
  }

  // 6. スコア降順でソートし上位N件を返す
  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored.slice(0, limit);
}

// ---------------------------------------------------------------
// ハードフィルタ（空室のみ + 予算範囲）
// ---------------------------------------------------------------

async function getFilteredCandidates(
  companyId: string,
  pref: {
    budgetMin?: number | null;
    budgetMax?: number | null;
    roomLayout?: string[];
    walkMinutesMax?: number | null;
  } | null,
) {
  const where: Record<string, unknown> = {
    companyId,
    status: "available",
  };

  if (pref) {
    // 予算フィルタ（万円 → 円に変換）
    if (pref.budgetMin || pref.budgetMax) {
      where.rent = {
        ...(pref.budgetMin ? { gte: pref.budgetMin * 10000 } : {}),
        ...(pref.budgetMax ? { lte: pref.budgetMax * 10000 } : {}),
      };
    }
    // 徒歩分数フィルタ
    if (pref.walkMinutesMax) {
      where.walkMinutes = { lte: pref.walkMinutesMax };
    }
  }

  return prisma.property.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200, // 候補上限
  });
}

// ---------------------------------------------------------------
// 条件一致率スコアリング
// ---------------------------------------------------------------

interface ConditionResult {
  conditionScore: number;
  matchReasons: string[];
}

function calculateConditionScore(
  prop: {
    rent: number;
    roomLayout: string | null;
    nearestStation: string | null;
    walkMinutes: number | null;
    floorArea: unknown;
    features: unknown;
  },
  pref: {
    budgetMin?: number | null;
    budgetMax?: number | null;
    roomLayout?: string[];
    stationIds?: string[];
    walkMinutesMax?: number | null;
    floorAreaMin?: unknown;
    mustConditions?: unknown;
    niceConditions?: unknown;
  } | null,
): ConditionResult {
  if (!pref) return { conditionScore: 0.5, matchReasons: [] };

  let score = 0;
  let total = 0;
  const reasons: string[] = [];

  // 予算一致
  total++;
  const rentManYen = prop.rent / 10000;
  if (
    (!pref.budgetMin || rentManYen >= pref.budgetMin) &&
    (!pref.budgetMax || rentManYen <= pref.budgetMax)
  ) {
    score++;
    reasons.push(`予算範囲内（${rentManYen}万円）`);
  }

  // 間取り一致
  if (pref.roomLayout && pref.roomLayout.length > 0) {
    total++;
    if (prop.roomLayout && pref.roomLayout.includes(prop.roomLayout)) {
      score++;
      reasons.push(`希望間取り一致（${prop.roomLayout}）`);
    }
  }

  // 徒歩分数
  if (pref.walkMinutesMax) {
    total++;
    if (prop.walkMinutes != null && prop.walkMinutes <= pref.walkMinutesMax) {
      score++;
      reasons.push(`徒歩${prop.walkMinutes}分（${pref.walkMinutesMax}分以内）`);
    }
  }

  // 面積
  if (pref.floorAreaMin) {
    total++;
    const minArea = Number(pref.floorAreaMin);
    const propArea = Number(prop.floorArea);
    if (propArea >= minArea) {
      score++;
      reasons.push(`面積${propArea}m²（${minArea}m²以上）`);
    }
  }

  // 必須条件（設備マッチング）
  if (Array.isArray(pref.mustConditions) && pref.mustConditions.length > 0) {
    const propFeatures = Array.isArray(prop.features) ? prop.features : [];
    for (const must of pref.mustConditions) {
      total++;
      if (propFeatures.includes(must)) {
        score++;
        reasons.push(`必須設備あり: ${must}`);
      }
    }
  }

  // 希望条件（ソフトマッチ）
  if (Array.isArray(pref.niceConditions) && pref.niceConditions.length > 0) {
    const propFeatures = Array.isArray(prop.features) ? prop.features : [];
    for (const nice of pref.niceConditions) {
      total += 0.5; // 希望条件は重み半分
      if (propFeatures.includes(nice)) {
        score += 0.5;
        reasons.push(`希望設備あり: ${nice}`);
      }
    }
  }

  return {
    conditionScore: total > 0 ? score / total : 0.5,
    matchReasons: reasons,
  };
}

// ---------------------------------------------------------------
// コサイン類似度
// ---------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ---------------------------------------------------------------
// Claude API でマッチ理由文を生成
// ---------------------------------------------------------------

export async function generateMatchReasonsText(
  property: { name: string; rent: number; address: string; roomLayout: string | null },
  matchReasons: string[],
  customerName: string,
): Promise<string> {
  if (matchReasons.length === 0) {
    return `${property.name}をご提案いたします。`;
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system:
      "あなたは不動産の担当者アシスタントです。物件提案理由を1-2文で簡潔に、顧客に親しみやすいトーンで書いてください。",
    messages: [
      {
        role: "user",
        content: `顧客「${customerName}」への物件提案理由を書いてください。
物件: ${property.name}（${property.address}、${property.rent / 10000}万円、${property.roomLayout ?? "間取り不明"}）
マッチ条件: ${matchReasons.join("、")}`,
      },
    ],
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : matchReasons.join("、");
}

// ---------------------------------------------------------------
// 物件登録・更新時の embedding 生成 & DB更新
// ---------------------------------------------------------------

export async function updatePropertyEmbedding(propertyId: string): Promise<void> {
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop) return;

  const embedding = generatePropertyEmbedding(prop as PropertyForEmbedding);
  const vecStr = `[${embedding.join(",")}]`;

  // pgvector の embedding カラムを raw SQL で更新
  await prisma.$executeRawUnsafe(
    `UPDATE properties SET embedding = $1::vector WHERE id = $2`,
    vecStr,
    propertyId,
  );
}

export async function updateCustomerPreferenceEmbedding(
  customerId: string,
): Promise<void> {
  const pref = await prisma.customerPreference.findUnique({
    where: { customerId },
  });
  if (!pref) return;

  const embedding = generatePreferencesEmbedding({
    budgetMin: pref.budgetMin,
    budgetMax: pref.budgetMax,
    areaIds: pref.areaIds,
    stationIds: pref.stationIds,
    walkMinutesMax: pref.walkMinutesMax,
    roomLayout: pref.roomLayout,
    floorAreaMin: pref.floorAreaMin ? Number(pref.floorAreaMin) : null,
    mustConditions: pref.mustConditions,
    niceConditions: pref.niceConditions,
  });
  const vecStr = `[${embedding.join(",")}]`;

  await prisma.$executeRawUnsafe(
    `UPDATE customer_preferences SET embedding = $1::vector WHERE customer_id = $2`,
    vecStr,
    customerId,
  );
}

// ---------------------------------------------------------------
// pgvector によるベクトル検索（候補の事前絞り込み用）
// ---------------------------------------------------------------

export async function searchSimilarProperties(
  queryVector: number[],
  companyId: string,
  limit: number = 20,
): Promise<{ id: string; similarity: number }[]> {
  const vecStr = `[${queryVector.join(",")}]`;

  const results: { id: string; similarity: number }[] =
    await prisma.$queryRawUnsafe(
      `SELECT id, 1 - (embedding <=> $1::vector) as similarity
       FROM properties
       WHERE company_id = $2 AND status = 'available' AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      vecStr,
      companyId,
      limit,
    );

  return results;
}
