"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchInvoices, generateMonthlyInvoices, processPayment } from "@/lib/api";
import type { RentInvoice, InvoiceStatus } from "@/types";
import { invoiceStatusLabel } from "@/types";

const statusColor: Record<InvoiceStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  partial: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function RentPage() {
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | "">("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [genDueDate, setGenDueDate] = useState(() => {
    const d = new Date();
    d.setDate(27);
    return d.toISOString().split("T")[0];
  });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchInvoices();
      setInvoices(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter ? invoices.filter((i) => i.status === filter) : invoices;

  const totalAmount = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const paidAmount = invoices.reduce((s, i) => s + (i.paidAmount ?? 0), 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const pendingCount = invoices.filter((i) => i.status === "pending" || i.status === "partial").length;

  async function handlePay(inv: RentInvoice) {
    setPayingId(inv.id);
    try {
      const remaining = inv.totalAmount - (inv.paidAmount ?? 0);
      await processPayment(inv.id, remaining, "bank_transfer");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "入金処理に失敗しました");
    } finally {
      setPayingId(null);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await generateMonthlyInvoices(genMonth, genDueDate);
      alert(`${res.data.created}件の請求書を作成しました`);
      setShowGenerate(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "一括生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  return (
    <div>
      <PageHeader
        title="家賃管理"
        description="月次請求・入金管理"
        actions={
          <button
            onClick={() => setShowGenerate(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + 月次一括生成
          </button>
        }
      />

      {/* Generate Modal */}
      {showGenerate && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">月次請求書一括生成</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">請求月</label>
              <input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">支払期限</label>
              <input type="date" value={genDueDate} onChange={(e) => setGenDueDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleGenerate} disabled={generating}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {generating ? "生成中..." : "生成"}
            </button>
            <button onClick={() => setShowGenerate(false)} className="text-sm text-gray-500 hover:underline">キャンセル</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">入居中の全入居者の請求書を一括作成します（既存の同月分はスキップ）</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">総請求額</p>
          <p className="text-xl font-bold text-gray-900">{totalAmount.toLocaleString()}円</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">入金済</p>
          <p className="text-xl font-bold text-green-600">{paidAmount.toLocaleString()}円</p>
        </div>
        <div className={`rounded-lg shadow px-4 py-4 ${overdueCount > 0 ? "bg-red-50" : "bg-white"}`}>
          <p className="text-xs text-gray-500 mb-1">滞納</p>
          <p className={`text-xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-gray-400"}`}>{overdueCount}件</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">未払い</p>
          <p className="text-xl font-bold text-yellow-600">{pendingCount}件</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value as InvoiceStatus | "")}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全ステータス</option>
          {(Object.entries(invoiceStatusLabel) as [InvoiceStatus, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length}件</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">請求月</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">入居者</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">請求額</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">入金額</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">期限</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">入金日</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((inv) => (
                <tr key={inv.id} className={`hover:bg-gray-50 ${inv.status === "overdue" ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.billingMonth}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.tenant?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">{inv.totalAmount.toLocaleString()}円</td>
                  <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{(inv.paidAmount ?? 0).toLocaleString()}円</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[inv.status]}`}>
                      {invoiceStatusLabel[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {new Date(inv.dueDate).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("ja-JP") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(inv.status === "pending" || inv.status === "overdue" || inv.status === "partial") && (
                      <button
                        onClick={() => handlePay(inv)}
                        disabled={payingId === inv.id}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {payingId === inv.id ? "処理中..." : "入金処理"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {invoices.length === 0 ? "請求書がありません。月次一括生成で作成してください。" : "該当する請求書がありません"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
