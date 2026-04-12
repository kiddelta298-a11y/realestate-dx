"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchApplications, updateApplicationStatus } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/types";
import { applicationStatusLabel } from "@/types";

const statusColors: Record<ApplicationStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  screening: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | "">("");
  const [detailApp, setDetailApp] = useState<Application | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApplications();
      setApplications(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    try {
      await updateApplicationStatus(id, status);
      await load();
      if (detailApp?.id === id) {
        setDetailApp((prev) => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "ステータス更新に失敗しました");
    }
  }

  const filtered = filterStatus
    ? applications.filter((a) => a.status === filterStatus)
    : applications;

  const statusCounts = applications.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
        <button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="申込管理" description="入居申込の一覧・審査ステータス管理" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">全申込</p>
          <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">審査中</p>
          <p className="text-2xl font-bold text-yellow-600">{statusCounts["screening"] ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">承認済</p>
          <p className="text-2xl font-bold text-green-600">{statusCounts["approved"] ?? 0}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-gray-600">ステータス:</span>
        <button
          onClick={() => setFilterStatus("")}
          className={`px-3 py-1 text-xs rounded-full border ${!filterStatus ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
        >
          すべて
        </button>
        {(["pending", "screening", "approved", "rejected"] as ApplicationStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full border ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
          >
            {applicationStatusLabel[s]} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">申込者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">物件</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">連絡先</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">希望入居日</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">申込日</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((app) => (
              <tr key={app.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button
                    onClick={() => setDetailApp(app)}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {app.customer?.name ?? app.customerId}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {app.property?.name ?? app.propertyId}
                  {app.property?.rent && (
                    <span className="text-xs text-gray-500 ml-1">
                      ({app.property.rent.toLocaleString()}円)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                  <div className="text-xs">{app.customer?.email ?? "-"}</div>
                  <div className="text-xs">{app.customer?.phone ?? "-"}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                  {app.desiredMoveIn ?? "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[app.status]}`}>
                    {applicationStatusLabel[app.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">
                  {new Date(app.createdAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pending">審査待ち</option>
                    <option value="screening">審査中</option>
                    <option value="approved">承認</option>
                    <option value="rejected">却下</option>
                    <option value="cancelled">取消</option>
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  該当する申込がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Detail Modal */}
      {detailApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">申込詳細</h2>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[detailApp.status]}`}>
                {applicationStatusLabel[detailApp.status]}
              </span>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="grid grid-cols-3">
                <dt className="text-gray-500">氏名</dt>
                <dd className="col-span-2 text-gray-900 font-medium">{detailApp.customer?.name ?? detailApp.customerId}</dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-gray-500">メール</dt>
                <dd className="col-span-2 text-gray-700">{detailApp.customer?.email ?? "-"}</dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-gray-500">電話</dt>
                <dd className="col-span-2 text-gray-700">{detailApp.customer?.phone ?? "-"}</dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-gray-500">物件</dt>
                <dd className="col-span-2 text-gray-700">
                  {detailApp.property?.name ?? detailApp.propertyId}
                  {detailApp.property?.address && (
                    <span className="text-xs text-gray-500 block">{detailApp.property.address}</span>
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-gray-500">希望入居日</dt>
                <dd className="col-span-2 text-gray-700">{detailApp.desiredMoveIn ?? "-"}</dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-gray-500">備考</dt>
                <dd className="col-span-2 text-gray-700">{detailApp.notes ?? "-"}</dd>
              </div>
            </dl>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setDetailApp(null)}
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
