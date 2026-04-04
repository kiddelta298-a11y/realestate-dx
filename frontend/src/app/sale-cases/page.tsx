"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchSaleCases, createSaleCase, updateSaleCase } from "@/lib/api";
import type { SaleCase, SaleCaseStatus } from "@/types";
import { saleCaseStatusLabel } from "@/types";

const saleCaseStatuses: SaleCaseStatus[] = [
  "inquiry",
  "viewing",
  "negotiation",
  "contracted",
  "completed",
  "lost",
];

const statusBadgeColors: Record<SaleCaseStatus, string> = {
  inquiry: "bg-blue-100 text-blue-700",
  viewing: "bg-cyan-100 text-cyan-700",
  negotiation: "bg-yellow-100 text-yellow-700",
  contracted: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  lost: "bg-red-100 text-red-700",
};

type SaleCaseForm = {
  salePropertyId: string;
  customerId: string;
  assignedUserId: string;
  offerPrice: number;
  notes: string;
  status: SaleCaseStatus;
};

const emptyForm: SaleCaseForm = {
  salePropertyId: "",
  customerId: "",
  assignedUserId: "",
  offerPrice: 0,
  notes: "",
  status: "inquiry",
};

export default function SaleCasesPage() {
  const [saleCases, setSaleCases] = useState<SaleCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SaleCaseStatus | "">("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SaleCaseForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSaleCases();
      setSaleCases(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Collect unique assigned users for the filter dropdown
  const assignedUsers = Array.from(
    new Map(
      saleCases
        .filter((c) => c.assignedUser)
        .map((c) => [c.assignedUser!.id, c.assignedUser!.name])
    )
  );

  const filtered = saleCases.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (assignedFilter && c.assignedUser?.id !== assignedFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (c.saleProperty?.name ?? "").toLowerCase().includes(q) ||
        (c.customer?.name ?? "").toLowerCase().includes(q) ||
        (c.assignedUser?.name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: SaleCase) {
    setEditingId(c.id);
    setForm({
      salePropertyId: c.salePropertyId,
      customerId: c.customerId,
      assignedUserId: c.assignedUserId ?? "",
      offerPrice: c.offerPrice ?? 0,
      notes: c.notes ?? "",
      status: c.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.salePropertyId.trim() || !form.customerId.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateSaleCase(editingId, {
          salePropertyId: form.salePropertyId,
          customerId: form.customerId,
          assignedUserId: form.assignedUserId || undefined,
          offerPrice: form.offerPrice || undefined,
          notes: form.notes || undefined,
          status: form.status,
        });
      } else {
        await createSaleCase({
          salePropertyId: form.salePropertyId,
          customerId: form.customerId,
          assignedUserId: form.assignedUserId || undefined,
          notes: form.notes || undefined,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
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
        title="売買案件管理"
        description="売買案件の一覧・担当者別ビュー・ステータス遷移"
        actions={
          <button
            onClick={openNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + 新規登録
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="物件名・顧客名・担当者で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SaleCaseStatus | "")}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全ステータス</option>
          {saleCaseStatuses.map((s) => (
            <option key={s} value={s}>
              {saleCaseStatusLabel[s]}
            </option>
          ))}
        </select>
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全担当者</option>
          {assignedUsers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">物件名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">顧客名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">担当者</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">提示価格(万円)</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">更新日</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {c.saleProperty?.name ?? c.salePropertyId}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c.customer?.name ?? c.customerId}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c.assignedUser?.name ?? c.assignedUserId ?? "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {c.offerPrice != null ? c.offerPrice.toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeColors[c.status]}`}
                  >
                    {saleCaseStatusLabel[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {c.updatedAt
                    ? new Date(c.updatedAt).toLocaleDateString("ja-JP")
                    : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openEdit(c)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    編集
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  該当する売買案件がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? "売買案件を編集" : "新規売買案件登録"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  物件ID
                </label>
                <input
                  type="text"
                  value={form.salePropertyId}
                  onChange={(e) =>
                    setForm({ ...form, salePropertyId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="売買物件IDを入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  顧客ID
                </label>
                <input
                  type="text"
                  value={form.customerId}
                  onChange={(e) =>
                    setForm({ ...form, customerId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="顧客IDを入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当者ID
                </label>
                <input
                  type="text"
                  value={form.assignedUserId}
                  onChange={(e) =>
                    setForm({ ...form, assignedUserId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="担当者IDを入力 (任意)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  提示価格 (万円)
                </label>
                <input
                  type="number"
                  value={form.offerPrice}
                  onChange={(e) =>
                    setForm({ ...form, offerPrice: Number(e.target.value) })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="備考を入力 (任意)"
                />
              </div>
              {editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ステータス
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as SaleCaseStatus,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {saleCaseStatuses.map((s) => (
                      <option key={s} value={s}>
                        {saleCaseStatusLabel[s]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={saving}
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "保存中..." : editingId ? "更新" : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
