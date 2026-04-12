"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchTenants, updateTenant } from "@/lib/api";
import type { Tenant, TenantStatus } from "@/types";
import { tenantStatusLabel } from "@/types";

const statusColor: Record<TenantStatus, string> = {
  active: "bg-green-100 text-green-700",
  notice_given: "bg-yellow-100 text-yellow-700",
  vacated: "bg-gray-100 text-gray-500",
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "">("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTenants();
      setTenants(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter ? tenants.filter((t) => t.status === statusFilter) : tenants;
  const detail = tenants.find((t) => t.id === detailId);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  return (
    <div>
      <PageHeader title="入居者管理" description="入居者情報の管理" />

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TenantStatus | "")}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全ステータス</option>
          {(Object.entries(tenantStatusLabel) as [TenantStatus, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length}名</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">メール</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">電話</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">賃料</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">入居日</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">満了日</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{t.email ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{t.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">
                    {(t.rentAmount + t.managementFee).toLocaleString()}円
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.moveInDate ? new Date(t.leaseStartDate).toLocaleDateString("ja-JP") : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {new Date(t.leaseEndDate).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[t.status]}`}>
                      {tenantStatusLabel[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDetailId(t.id)} className="text-xs text-blue-600 hover:underline">詳細</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">入居者がいません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{detail.name}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">メール:</span> <span className="text-gray-900">{detail.email ?? "-"}</span></div>
              <div><span className="text-gray-500">電話:</span> <span className="text-gray-900">{detail.phone ?? "-"}</span></div>
              <div><span className="text-gray-500">入居開始:</span> <span className="text-gray-900">{new Date(detail.leaseStartDate).toLocaleDateString("ja-JP")}</span></div>
              <div><span className="text-gray-500">契約満了:</span> <span className="text-gray-900">{new Date(detail.leaseEndDate).toLocaleDateString("ja-JP")}</span></div>
              <div><span className="text-gray-500">賃料:</span> <span className="text-gray-900">{detail.rentAmount.toLocaleString()}円</span></div>
              <div><span className="text-gray-500">管理費:</span> <span className="text-gray-900">{detail.managementFee.toLocaleString()}円</span></div>
              <div><span className="text-gray-500">ステータス:</span>
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor[detail.status]}`}>
                  {tenantStatusLabel[detail.status]}
                </span>
              </div>
              {detail.emergencyContact && (
                <div className="col-span-2">
                  <span className="text-gray-500">緊急連絡先:</span>{" "}
                  <span className="text-gray-900">
                    {typeof detail.emergencyContact === "object"
                      ? `${detail.emergencyContact.name ?? ""} ${detail.emergencyContact.phone ?? ""}`
                      : "-"}
                  </span>
                </div>
              )}
              {detail.notes && (
                <div className="col-span-2">
                  <span className="text-gray-500">備考:</span> <span className="text-gray-900">{detail.notes}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setDetailId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
