"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import type { Property } from "@/types";
import { propertyStatusLabel } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID ?? "00000000-0000-0000-0000-000000000001";

type PostStatus = "pending" | "processing" | "posted" | "failed";

interface SuumoPost {
  id: string;
  propertyId: string;
  status: PostStatus;
  suumoPropertyId: string | null;
  useStaging: boolean;
  stagedImageUrls: string[];
  errorMessage: string | null;
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

interface StagingPreviewResult {
  success: boolean;
  originalUrl: string;
  stagedUrl: string | null;
  analysis: {
    roomType: string;
    style: string;
    lightCondition: string;
    sizeFeel: string;
    promptJa: string;
  } | null;
  error?: string;
}

const postStatusLabel: Record<PostStatus, string> = {
  pending: "待機中",
  processing: "投稿中...",
  posted: "掲載完了",
  failed: "失敗",
};

const postStatusColor: Record<PostStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  posted: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function SuumoPage() {
  const [posts, setPosts] = useState<SuumoPost[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // 投稿フォーム
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [useStaging, setUseStaging] = useState(true);
  const [posting, setPosting] = useState(false);

  // ステージングプレビュー
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPropertyId, setPreviewPropertyId] = useState("");
  const [previewResult, setPreviewResult] = useState<StagingPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [postsRes, propsRes] = await Promise.all([
        fetch(`${API_BASE}/api/suumo/posts?companyId=${COMPANY_ID}&limit=30`),
        fetch(`${API_BASE}/api/properties?companyId=${COMPANY_ID}&status=available&limit=100`),
      ]);
      const postsData = await postsRes.json();
      const propsData = await propsRes.json();
      setPosts(postsData.data ?? []);
      setProperties(propsData.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // 投稿中のものがあれば定期更新
    const hasProcessing = posts.some((p) => p.status === "processing");
    if (hasProcessing) {
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }
  }, [load, posts]);

  async function handlePost() {
    if (!selectedPropertyId) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/api/suumo/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: COMPANY_ID,
          propertyId: selectedPropertyId,
          useStaging,
        }),
      });
      if (!res.ok) throw new Error("投稿開始に失敗しました");
      setSelectedPropertyId("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setPosting(false);
    }
  }

  async function handlePreview() {
    if (!previewPropertyId) return;
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/suumo/staging/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: COMPANY_ID,
          propertyId: previewPropertyId,
          imageIndex: 0,
        }),
      });
      const data = await res.json();
      setPreviewResult(data.data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "プレビューに失敗しました");
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const postedCount = posts.filter((p) => p.status === "posted").length;

  return (
    <div>
      <PageHeader
        title="SUUMO自動投稿"
        description="物件をSUUMOに自動投稿。AIバーチャルステージングで反響率を向上"
        actions={
          <button
            onClick={() => setPreviewModalOpen(true)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            ステージングプレビュー
          </button>
        }
      />

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">SUUMO掲載中</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{postedCount}</p>
          <p className="text-xs text-gray-400 mt-1">物件</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">空室物件数</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{properties.length}</p>
          <p className="text-xs text-gray-400 mt-1">投稿可能</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">AIステージング</p>
          <p className="text-lg font-semibold text-purple-600 mt-1">有効</p>
          <p className="text-xs text-gray-400 mt-1">Replicate × Claude Vision</p>
        </div>
      </div>

      {/* 新規投稿フォーム */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">物件を投稿する</h3>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              投稿する物件（空室のみ表示）
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">物件を選択...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}｜{p.rent.toLocaleString()}円｜{p.roomLayout ?? "-"}｜{p.nearestStation ?? p.address}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              id="useStaging"
              checked={useStaging}
              onChange={(e) => setUseStaging(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="useStaging" className="text-sm text-gray-700 whitespace-nowrap">
              AIバーチャルステージングを使用
            </label>
          </div>
          <button
            onClick={handlePost}
            disabled={!selectedPropertyId || posting}
            className="bg-orange-500 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {posting ? "開始中..." : "SUUMO投稿"}
          </button>
        </div>
        {useStaging && (
          <p className="mt-2 text-xs text-purple-600">
            Claude Vision で部屋を分析し、Replicate で家具を配置した画像をSUUMOに掲載します。
            反響率向上が見込めます。
          </p>
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
              <th className="text-right px-4 py-3 font-medium text-gray-600">賃料</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">AIステージング</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SUUMO物件ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">投稿日時</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{post.property?.name ?? post.propertyId}</p>
                  <p className="text-xs text-gray-500">{post.property?.address ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {post.property ? `${post.property.rent.toLocaleString()}円` : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${postStatusColor[post.status]}`}>
                    {postStatusLabel[post.status]}
                  </span>
                  {post.errorMessage && (
                    <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate">
                      {post.errorMessage}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {post.useStaging ? (
                    <div>
                      <span className="text-purple-600 text-xs font-medium">使用</span>
                      {(post.stagedImageUrls as string[]).length > 0 && (
                        <p className="text-xs text-gray-400">
                          {(post.stagedImageUrls as string[]).length}枚生成
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">なし</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                  {post.suumoPropertyId ?? "-"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {post.postedAt ? new Date(post.postedAt).toLocaleString("ja-JP") : "-"}
                </td>
              </tr>
            ))}
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

      {/* バーチャルステージングプレビューモーダル */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              AIバーチャルステージング プレビュー
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              物件写真に Claude Vision + Replicate で家具を配置します。
              投稿前に仕上がりを確認できます。
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                プレビューする物件
              </label>
              <select
                value={previewPropertyId}
                onChange={(e) => setPreviewPropertyId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">物件を選択...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.roomLayout ?? "-"}）
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePreview}
              disabled={!previewPropertyId || previewing}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 mb-4"
            >
              {previewing ? "AI生成中... (30秒ほどかかります)" : "ステージング画像を生成"}
            </button>

            {previewResult && (
              <div className="mt-4 space-y-3">
                {previewResult.analysis && (
                  <div className="bg-purple-50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-purple-800">AI分析結果</p>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-purple-700 text-xs">
                      <span>部屋タイプ: {previewResult.analysis.roomType}</span>
                      <span>スタイル: {previewResult.analysis.style}</span>
                      <span>採光: {previewResult.analysis.lightCondition}</span>
                      <span>広さ感: {previewResult.analysis.sizeFeel}</span>
                    </div>
                    <p className="mt-1 text-purple-600 text-xs">{previewResult.analysis.promptJa}</p>
                  </div>
                )}

                {previewResult.success && previewResult.stagedUrl ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">元の写真</p>
                      <img
                        src={previewResult.originalUrl}
                        alt="元の写真"
                        className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 mb-1 font-medium">AI家具配置後</p>
                      <img
                        src={previewResult.stagedUrl}
                        alt="AIステージング後"
                        className="w-full h-40 object-cover rounded-lg border border-purple-200"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
                    生成失敗: {previewResult.error}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setPreviewModalOpen(false);
                  setPreviewResult(null);
                  setPreviewPropertyId("");
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
