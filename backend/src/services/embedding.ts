/**
 * Embedding 生成サービス
 *
 * 物件情報・顧客希望条件をテキスト化し、ベクトルに変換する。
 * pgvector の VECTOR(384) カラムに格納するため 384 次元のベクトルを返す。
 *
 * 現在の実装:
 *   - 構造化データからテキスト表現を生成
 *   - テキストを deterministic hash → 384次元ベクトルに変換（ベースライン）
 *
 * 本番推奨:
 *   - @xenova/transformers (all-MiniLM-L6-v2) でローカル embedding
 *   - または OpenAI text-embedding-3-small API
 */

const VECTOR_DIM = 384;

// ---------------------------------------------------------------
// 物件テキスト化
// ---------------------------------------------------------------

export interface PropertyForEmbedding {
  name: string;
  propertyType: string;
  address: string;
  nearestStation?: string | null;
  walkMinutes?: number | null;
  rent: number;
  managementFee?: number;
  roomLayout?: string | null;
  floorArea?: number | null;
  builtYear?: number | null;
  features?: unknown;
  description?: string | null;
}

export function propertyToText(p: PropertyForEmbedding): string {
  const parts: string[] = [
    `物件名:${p.name}`,
    `種別:${p.propertyType}`,
    `住所:${p.address}`,
  ];
  if (p.nearestStation) parts.push(`最寄駅:${p.nearestStation} 徒歩${p.walkMinutes ?? "?"}分`);
  parts.push(`賃料:${p.rent}円`);
  if (p.managementFee) parts.push(`管理費:${p.managementFee}円`);
  if (p.roomLayout) parts.push(`間取り:${p.roomLayout}`);
  if (p.floorArea) parts.push(`面積:${p.floorArea}m2`);
  if (p.builtYear) parts.push(`築年:${p.builtYear}年`);
  if (Array.isArray(p.features) && p.features.length > 0) {
    parts.push(`設備:${p.features.join(",")}`);
  }
  if (p.description) parts.push(p.description.slice(0, 200));
  return parts.join(" ");
}

// ---------------------------------------------------------------
// 顧客希望条件テキスト化
// ---------------------------------------------------------------

export interface PreferencesForEmbedding {
  budgetMin?: number | null;
  budgetMax?: number | null;
  areaIds?: string[];
  stationIds?: string[];
  walkMinutesMax?: number | null;
  roomLayout?: string[];
  floorAreaMin?: number | null;
  mustConditions?: unknown;
  niceConditions?: unknown;
}

export function preferencesToText(pref: PreferencesForEmbedding): string {
  const parts: string[] = [];
  if (pref.budgetMin || pref.budgetMax) {
    parts.push(`予算:${pref.budgetMin ?? 0}〜${pref.budgetMax ?? "上限なし"}万円`);
  }
  if (pref.roomLayout && pref.roomLayout.length > 0) {
    parts.push(`間取り:${pref.roomLayout.join(",")}`);
  }
  if (pref.walkMinutesMax) parts.push(`徒歩${pref.walkMinutesMax}分以内`);
  if (pref.floorAreaMin) parts.push(`面積${pref.floorAreaMin}m2以上`);
  if (Array.isArray(pref.mustConditions) && pref.mustConditions.length > 0) {
    parts.push(`必須:${pref.mustConditions.join(",")}`);
  }
  if (Array.isArray(pref.niceConditions) && pref.niceConditions.length > 0) {
    parts.push(`希望:${pref.niceConditions.join(",")}`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------
// テキスト → ベクトル変換（deterministic hash baseline）
//
// NOTE: 本番では all-MiniLM-L6-v2 等のセマンティック embedding に置換すること。
// この実装は構造化テキストのトークン分布に基づく擬似ベクトルであり、
// セマンティック類似度は限定的だが、同一語彙を含むテキスト同士の
// コサイン類似度は正の相関を持つ。
// ---------------------------------------------------------------

export function textToVector(text: string): number[] {
  const vec = new Float64Array(VECTOR_DIM);

  // trigram ベースのハッシュ → 各次元にスコアを加算
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash + trigram.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(hash) % VECTOR_DIM;
    vec[idx] += 1;
  }

  // L2 正規化
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

// ---------------------------------------------------------------
// 高レベル API
// ---------------------------------------------------------------

export function generatePropertyEmbedding(p: PropertyForEmbedding): number[] {
  return textToVector(propertyToText(p));
}

export function generatePreferencesEmbedding(pref: PreferencesForEmbedding): number[] {
  return textToVector(preferencesToText(pref));
}
