"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchCustomers, updateCustomer } from "@/lib/api";
import type { Customer, CustomerApiStatus } from "@/types";
import { customerStatusLabel, customerSourceLabel } from "@/types";

const allStatuses: CustomerApiStatus[] = ["active", "contracted", "lost"];
const pipelineStatuses: CustomerApiStatus[] = ["active", "contracted"];

const statusColor: Record<CustomerApiStatus, string> = {
  active: "bg-blue-100 text-blue-700",
  contracted: "bg-green-100 text-green-700",
  lost: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: CustomerApiStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[status]}`}
    >
      {customerStatusLabel[status]}
    </span>
  );
}

function StatusPipeline({ current }: { current: CustomerApiStatus }) {
  const currentIdx = pipelineStatuses.indexOf(current);
  const isLost = current === "lost";

  return (
    <div className="flex items-center gap-1">
      {pipelineStatuses.map((s, i) => {
        const isReached = !isLost && currentIdx >= i;
        return (
          <div key={s} className="flex items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isReached
                  ? `${statusColor[s].split(" ")[0]} ${statusColor[s].split(" ")[1]}`
                  : "bg-gray-200 text-gray-400"
              }`}
              title={customerStatusLabel[s]}
            >
              {i + 1}
            </div>
            {i < pipelineStatuses.length - 1 && (
              <div
                className={`w-4 h-0.5 ${
                  !isLost && currentIdx > i ? "bg-blue-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
      {isLost && (
        <span className="ml-1 text-[10px] text-gray-400 font-medium">失注</span>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerApiStatus | "">("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCustomers({ limit: 200 });
      setCustomers(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = customers.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        customerSourceLabel[c.source].toLowerCase().includes(q) ||
        (c.assignedUser?.name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleStatusChange(id: string, newStatus: CustomerApiStatus) {
    try {
      await updateCustomer(id, { status: newStatus });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "ステータス変更に失敗しました");
    }
  }

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
        <button onClick={load} className="mt-2 text-sm text-red-600 underline">
          再試行
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="顧客CRM"
        description="顧客情報の管理とステータス追跡"
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="名前・メール・電話・反響元で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CustomerApiStatus | "")}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全ステータス</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {customerStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">電話</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">進捗</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">反響元</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">担当者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">更新日</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">変更</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.email ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone ?? "-"}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <StatusPipeline current={c.status} />
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{customerSourceLabel[c.source]}</td>
                <td className="px-4 py-3 text-gray-600">{c.assignedUser?.name ?? "未割当"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("ja-JP") : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={c.status}
                    onChange={(e) =>
                      handleStatusChange(c.id, e.target.value as CustomerApiStatus)
                    }
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {allStatuses.map((s) => (
                      <option key={s} value={s}>
                        {customerStatusLabel[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  該当する顧客がいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
