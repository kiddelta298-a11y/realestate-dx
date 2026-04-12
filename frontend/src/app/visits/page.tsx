"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchVisits, createVisit } from "@/lib/api";
import type { Visit, VisitPurpose, VisitChannel, VisitResult } from "@/types";
import { visitResultLabel, visitPurposeLabel, visitChannelLabel } from "@/types";

const visitResults: VisitResult[] = ["interested", "application", "contracted", "not_interested", "follow_up"];
const visitPurposes: VisitPurpose[] = ["inquiry", "viewing", "contract", "consultation", "other"];
const visitChannels: VisitChannel[] = ["walk_in", "appointment", "referral"];

const resultBadgeClass: Record<VisitResult, string> = {
  interested: "bg-blue-100 text-blue-700",
  application: "bg-green-100 text-green-700",
  contracted: "bg-purple-100 text-purple-700",
  not_interested: "bg-gray-100 text-gray-600",
  follow_up: "bg-yellow-100 text-yellow-700",
};

type VisitForm = {
  customerId: string;
  visitDate: string;
  purpose: VisitPurpose;
  channel: VisitChannel;
  result: VisitResult | "";
  notes: string;
};

const emptyForm: VisitForm = {
  customerId: "",
  visitDate: "",
  purpose: "inquiry",
  channel: "walk_in",
  result: "",
  notes: "",
};

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<VisitResult | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<VisitForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchVisits();
      setVisits(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = visits.filter((v) => {
    if (resultFilter && v.result !== resultFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (v.customer?.name ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  function openNew() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.customerId.trim() || !form.visitDate) return;
    setSaving(true);
    try {
      await createVisit({
        customerId: form.customerId,
        visitDate: form.visitDate,
        purpose: form.purpose,
        channel: form.channel,
        result: form.result || undefined,
        notes: form.notes || undefined,
      });
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
        title="来店記録"
        description="来店記録の一覧・登録"
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="顧客名で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value as VisitResult | "")}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全ての結果</option>
          {visitResults.map((r) => (
            <option key={r} value={r}>
              {visitResultLabel[r]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">来店日</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">顧客名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">担当者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">来店経路</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">目的</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">結果</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">備考</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{v.visitDate}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {v.customer?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                  {v.assignedUser?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                  {visitChannelLabel[v.channel]}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{visitPurposeLabel[v.purpose]}</td>
                <td className="px-4 py-3 text-center">
                  {v.result ? (
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${resultBadgeClass[v.result]}`}
                    >
                      {visitResultLabel[v.result]}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{v.notes ?? "-"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  該当する来店記録がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">新規来店登録</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">顧客ID</label>
                <input
                  type="text"
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">来店日</label>
                <input
                  type="date"
                  value={form.visitDate}
                  onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">来店経路</label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value as VisitChannel })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {visitChannels.map((c) => (
                      <option key={c} value={c}>
                        {visitChannelLabel[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目的</label>
                  <select
                    value={form.purpose}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value as VisitPurpose })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {visitPurposes.map((p) => (
                      <option key={p} value={p}>
                        {visitPurposeLabel[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">結果</label>
                <select
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value as VisitResult | "" })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">未設定</option>
                  {visitResults.map((r) => (
                    <option key={r} value={r}>
                      {visitResultLabel[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                {saving ? "保存中..." : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
