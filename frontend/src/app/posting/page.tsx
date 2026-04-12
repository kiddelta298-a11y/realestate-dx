"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import type { Property } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const COMPANY_ID =
  process.env.NEXT_PUBLIC_COMPANY_ID ?? "00000000-0000-0000-0000-000000000001";

/* ── 媒体定義 ── */

type PlatformId = "suumo" | "athome" | "homes";

interface PlatformDef {
  id: PlatformId;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  url: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "suumo",
    name: "SUUMO",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    url: "https://suumo.jp",
  },
  {
    id: "athome",
    name: "アットホーム",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    url: "https://www.athome.co.jp",
  },
  {
    id: "homes",
    name: "LIFULL HOME'S",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
    url: "https://www.homes.co.jp",
  },
];

/* ── 投稿履歴型 ── */

type PostStatus = "pending" | "processing" | "posted" | "failed";

interface MediaPost {
  id: string;
  propertyId: string;
  platform: PlatformId;
  status: PostStatus;
  externalId: string | null;
  useStaging: boolean;
  postedAt: string | null;
  createdAt: string;
  property: {
    id: string;
    name: string;
    address: string;
    rent: number;
    roomLayout: string | null;
  } | null;
}

const statusLabel: Record<PostStatus, string> = {
  pending: "待機中",
  processing: "投稿中...",
  posted: "掲載中",
  failed: "失敗",
};

const statusStyle: Record<PostStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  posted: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

/* ── コンポーネント ── */

export default function PostingPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [postedMap, setPostedMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // 選択状態
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [checkedPlatforms, setCheckedPlatforms] = useState<Set<PlatformId>>(new Set());
  const [useStaging, setUseStaging] = useState(false);
  const [posting, setPosting] = useState(false);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) ?? null;

  const load = useCallback(async () => {
    try {
      const [propsRes, postsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/api/properties?companyId=${COMPANY_ID}&status=available&limit=100`),
        fetch(`${API_BASE}/api/media-posts?companyId=${COMPANY_ID}&limit=50`),
        fetch(`${API_BASE}/api/media-posts/summary?companyId=${COMPANY_ID}`),
      ]);
      const propsData = await propsRes.json();
      const postsData = await postsRes.json();
      const summaryData = await summaryRes.json();
      setProperties(propsData.data ?? []);
      setPosts(postsData.data ?? []);
      setPostedMap(summaryData.data ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 物件を選択したら、その物件が既に投稿済みの媒体のチェックを外す
  useEffect(() => {
    if (!selectedPropertyId) {
      setCheckedPlatforms(new Set());
      return;
    }
    const already = new Set(postedMap[selectedPropertyId] ?? []);
    const available = PLATFORMS.filter((p) => !already.has(p.id)).map((p) => p.id);
    setCheckedPlatforms(new Set(available));
  }, [selectedPropertyId, postedMap]);

  function togglePlatform(id: PlatformId) {
    setCheckedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePost() {
    if (!selectedPropertyId || checkedPlatforms.size === 0) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/api/media-posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: COMPANY_ID,
          propertyId: selectedPropertyId,
          platforms: Array.from(checkedPlatforms),
          useStaging,
        }),
      });
      if (!res.ok) throw new Error("投稿に失敗しました");
      setSelectedPropertyId("");
      setCheckedPlatforms(new Set());
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const alreadyPosted = new Set(postedMap[selectedPropertyId] ?? []);

  return (
    <div>
      <PageHeader
        title="媒体一括投稿"
        description="物件を複数の不動産ポータルサイトへ一括投稿"
      />

      {/* サマリーカード */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">空室物件数</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{properties.length}</p>
          <p className="text-xs text-gray-400 mt-1">投稿可能</p>
        </div>
        {PLATFORMS.map((pl) => {
          const count = posts.filter(
            (p) => p.platform === pl.id && p.status === "posted"
          ).length;
          return (
            <div key={pl.id} className="bg-white rounded-lg shadow p-5">
              <p className={`text-sm ${pl.color}`}>{pl.name}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{count}</p>
              <p className="text-xs text-gray-400 mt-1">掲載中</p>
            </div>
          );
        })}
      </div>

      {/* メインエリア: 左=媒体選択, 中央=物件情報, 右=投稿ボタン */}
      <div className="bg-white rounded-lg shadow mb-6">
        {/* 物件セレクター */}
        <div className="px-6 py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            投稿する物件を選択（空室のみ）
          </label>
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">物件を選択...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}｜{p.rent.toLocaleString()}円｜{p.roomLayout ?? "-"}｜
                {p.nearestStation ?? p.address}
              </option>
            ))}
          </select>
        </div>

        {selectedProperty && (
          <div className="flex divide-x divide-gray-100">
            {/* 左: 媒体チェックボックス */}
            <div className="w-64 shrink-0 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">投稿先媒体</h3>
              <div className="space-y-3">
                {PLATFORMS.map((pl) => {
                  const isPosted = alreadyPosted.has(pl.id);
                  const isChecked = checkedPlatforms.has(pl.id);
                  return (
                    <label
                      key={pl.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isPosted
                          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                          : isChecked
                            ? `${pl.borderColor} ${pl.bgColor}`
                            : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isPosted}
                        onChange={() => togglePlatform(pl.id)}
                        className="rounded w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isPosted ? "text-gray-400" : pl.color}`}>
                          {pl.name}
                        </p>
                        {isPosted && (
                          <p className="text-xs text-green-600 mt-0.5">掲載済み</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useStaging}
                    onChange={(e) => setUseStaging(e.target.checked)}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">AIステージング</span>
                </label>
                {useStaging && (
                  <p className="text-xs text-purple-600 mt-1">
                    Claude Vision + Replicate で家具配置画像を生成
                  </p>
                )}
              </div>
            </div>

            {/* 中央: 物件情報 */}
            <div className="flex-1 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">物件情報</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-bold text-gray-900">{selectedProperty.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedProperty.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="賃料" value={`${selectedProperty.rent.toLocaleString()}円/月`} highlight />
                  <InfoItem label="管理費" value={`${selectedProperty.managementFee.toLocaleString()}円`} />
                  <InfoItem label="間取り" value={selectedProperty.roomLayout ?? "-"} />
                  <InfoItem
                    label="面積"
                    value={selectedProperty.floorArea ? `${selectedProperty.floorArea}m²` : "-"}
                  />
                  <InfoItem label="敷金" value={`${selectedProperty.deposit.toLocaleString()}円`} />
                  <InfoItem label="礼金" value={`${selectedProperty.keyMoney.toLocaleString()}円`} />
                  <InfoItem
                    label="最寄り駅"
                    value={
                      selectedProperty.nearestStation
                        ? `${selectedProperty.nearestStation}${selectedProperty.walkMinutes ? ` 徒歩${selectedProperty.walkMinutes}分` : ""}`
                        : "-"
                    }
                  />
                  <InfoItem
                    label="築年"
                    value={selectedProperty.builtYear ? `${selectedProperty.builtYear}年` : "-"}
                  />
                </div>

                {selectedProperty.features && selectedProperty.features.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">設備・特徴</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProperty.features.map((f, i) => (
                        <span
                          key={i}
                          className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProperty.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">備考</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedProperty.description}
                    </p>
                  </div>
                )}

                {/* 投稿ボタン */}
                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={handlePost}
                    disabled={checkedPlatforms.size === 0 || posting}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {posting
                      ? "投稿中..."
                      : checkedPlatforms.size === 0
                        ? "投稿先を選択してください"
                        : `${checkedPlatforms.size}件の媒体に一括投稿`}
                  </button>
                  {checkedPlatforms.size > 0 && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      投稿先:{" "}
                      {PLATFORMS.filter((p) => checkedPlatforms.has(p.id))
                        .map((p) => p.name)
                        .join("、")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedProperty && (
          <div className="px-6 py-12 text-center text-gray-400">
            物件を選択すると、詳細情報と投稿先媒体の選択画面が表示されます
          </div>
        )}
      </div>

      {/* 投稿履歴 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">投稿履歴</h3>
          <button onClick={load} className="text-xs text-blue-600 hover:underline">
            更新
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">物件名</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">媒体</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">賃料</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">AIステージング</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">投稿日時</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.map((post) => {
              const pl = PLATFORMS.find((p) => p.id === post.platform);
              return (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {post.property?.name ?? post.propertyId}
                    </p>
                    <p className="text-xs text-gray-500">
                      {post.property?.address ?? ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pl && (
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${pl.bgColor} ${pl.color}`}
                      >
                        {pl.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {post.property
                      ? `${post.property.rent.toLocaleString()}円`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusStyle[post.status]}`}
                    >
                      {statusLabel[post.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {post.useStaging ? (
                      <span className="text-purple-600 text-xs font-medium">使用</span>
                    ) : (
                      <span className="text-gray-400 text-xs">なし</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {post.postedAt
                      ? new Date(post.postedAt).toLocaleString("ja-JP")
                      : "-"}
                  </td>
                </tr>
              );
            })}
            {posts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  投稿履歴がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── 小コンポーネント ── */

function InfoItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-sm mt-0.5 ${highlight ? "text-blue-700 font-bold text-base" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
