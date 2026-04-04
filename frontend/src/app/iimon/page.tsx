"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID ?? "00000000-0000-0000-0000-000000000001";

type SyncStatus = "pending" | "running" | "completed" | "failed";

interface IimonSync {
  id: string;
  status: SyncStatus;
  newCount: number;
  updatedCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

interface IimonStatusData {
  latestSync: IimonSync | null;
  iimonPropertyCount: number;
  isConfigured: boolean;
}

const statusLabel: Record<SyncStatus, string> = {
  pending: "待機中",
  running: "同期中...",
  completed: "完了",
  failed: "失敗",
};

const statusColor: Record<SyncStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function IimonPage() {
  const [status, setStatus] = useState<IimonStatusData | null>(null);
  const [syncs, setSyncs] = useState<IimonSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, syncsRes] = await Promise.all([
        fetch(`${API_BASE}/api/iimon/status?companyId=${COMPANY_ID}`),
        fetch(`${API_BASE}/api/iimon/syncs?companyId=${COMPANY_ID}`),
      ]);
      const statusData = await statusRes.json();
      const syncsData = await syncsRes.json();
      setStatus(statusData.data);
      setSyncs(syncsData.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    // 同期中は5秒ごとにポーリング
    const interval = setInterval(() => {
      if (status?.latestSync?.status === "running") {
        loadStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadStatus, status?.latestSync?.status]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/iimon/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: COMPANY_ID }),
      });
      if (!res.ok) throw new Error("同期開始に失敗しました");
      await loadStatus();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const isRunning = status?.latestSync?.status === "running";

  return (
    <div>
      <PageHeader
        title="iimon連携"
        description="いい物件速いもんから新着物件・空室状況・申込状況を自動取得"
        actions={
          <button
            onClick={handleSync}
            disabled={syncing || isRunning}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? "同期中..." : syncing ? "開始中..." : "今すぐ同期"}
          </button>
        }
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* 設定状態バナー */}
      {status && !status.isConfigured && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm font-medium">iimon認証情報が未設定です</p>
          <p className="text-yellow-700 text-xs mt-1">
            .env に <code className="bg-yellow-100 px-1 rounded">IIMON_EMAIL</code> と{" "}
            <code className="bg-yellow-100 px-1 rounded">IIMON_PASSWORD</code> を設定してください。
          </p>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">iimon連携物件数</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {status?.iimonPropertyCount ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">不動産DXに取込済み</p>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">最終同期</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {status?.latestSync
              ? new Date(status.latestSync.startedAt).toLocaleString("ja-JP")
              : "未実施"}
          </p>
          {status?.latestSync && (
            <span
              className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[status.latestSync.status]}`}
            >
              {statusLabel[status.latestSync.status]}
            </span>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">前回の取込結果</p>
          {status?.latestSync ? (
            <div className="mt-1 space-y-0.5">
              <p className="text-sm text-gray-900">
                新規: <span className="font-bold text-green-600">{status.latestSync.newCount}件</span>
              </p>
              <p className="text-sm text-gray-900">
                更新: <span className="font-bold text-blue-600">{status.latestSync.updatedCount}件</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-1">データなし</p>
          )}
        </div>
      </div>

      {/* 仕組み説明 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">連携の仕組み</h3>
        <div className="flex items-start gap-8 text-sm text-gray-600">
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">🏠</div>
            <p className="font-medium text-gray-800 text-xs">iimon</p>
            <p className="text-xs text-center">新着物件・空室状況・申込状況</p>
          </div>
          <div className="flex items-center mt-4 text-gray-300 text-xl">→</div>
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg">🤖</div>
            <p className="font-medium text-gray-800 text-xs">自動抽出</p>
            <p className="text-xs text-center">Playwrightで毎日取得・差分更新</p>
          </div>
          <div className="flex items-center mt-4 text-gray-300 text-xl">→</div>
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">📊</div>
            <p className="font-medium text-gray-800 text-xs">不動産DX</p>
            <p className="text-xs text-center">物件管理DBに自動登録・更新</p>
          </div>
          <div className="flex items-center mt-4 text-gray-300 text-xl">→</div>
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-lg">📮</div>
            <p className="font-medium text-gray-800 text-xs">SUUMO自動投稿</p>
            <p className="text-xs text-center">AIステージング付きで掲載</p>
          </div>
        </div>
      </div>

      {/* 同期履歴 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">同期履歴</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">開始日時</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">新規</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">更新</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">完了日時</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {syncs.map((sync) => (
              <tr key={sync.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">
                  {new Date(sync.startedAt).toLocaleString("ja-JP")}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[sync.status]}`}>
                    {statusLabel[sync.status]}
                  </span>
                  {sync.errorMessage && (
                    <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs">
                      {sync.errorMessage.split("\n")[0]}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-green-600">
                  +{sync.newCount}
                </td>
                <td className="px-4 py-3 text-right font-medium text-blue-600">
                  {sync.updatedCount}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {sync.completedAt
                    ? new Date(sync.completedAt).toLocaleString("ja-JP")
                    : "-"}
                </td>
              </tr>
            ))}
            {syncs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  同期履歴がありません。「今すぐ同期」を実行してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
