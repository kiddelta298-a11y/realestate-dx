"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchInvoices, processPayment } from "@/lib/api";
import type { RentInvoice, InvoiceStatus } from "@/types";
import { invoiceStatusLabel } from "@/types";

const statusColor: Record<InvoiceStatus, string> = {
  unpaid: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  partial: "bg-orange-100 text-orange-700",
};

export default function RentPage() {
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | "">("");
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); const res = await fetchInvoices(); setInvoices(res.data); } catch (e) { setError(e instanceof Error ? e.message : "エラー"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter ? invoices.filter((i) => i.status === filter) : invoices;

  // Summary
  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const paidAmount = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const unpaidCount = invoices.filter((i) => i.status === "unpaid" || i.status === "overdue" || i.status === "partial").length;

  async function handlePay(inv: RentInvoice) {
    setPayingId(inv.id);
    await processPayment(inv.id, inv.amount - inv.paidAmount);
    await load();
    setPayingId(null);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  return (
    <div>
      <PageHeader title="家賃管理" description="月次請求・入金管理" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">総請求額</p>
          <p className="text-2xl font-bold text-gray-900">{totalAmount.toLocaleString()}円</p>
        </div>
        <div className="bg-white rounded-lg shadow px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">入金済</p>
          <p className="text-2xl font-bold text-green-600">{paidAmount.toLocaleString()}円</p>
        </div>
        <div className="bg-white rounded-lg shadow px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">未回収件数</p>
          <p className="text-2xl font-bold text-red-600">{unpaidCount}件</p>
          {unpaidCount > 0 && <p className="text-xs text-red-500 mt-1">滞納アラート</p>}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-4 mb-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value as InvoiceStatus | "")} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
          <option value="">全ステータス</option>
          {(Object.entries(invoiceStatusLabel) as [InvoiceStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">請求月</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">入居者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">物件</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">請求額</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">入金額</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">期限</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((inv) => (
              <tr key={inv.id} className={`hover:bg-gray-50 ${inv.status === "overdue" ? "bg-red-50" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{inv.billingMonth}</td>
                <td className="px-4 py-3 text-gray-600">{inv.tenant?.name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{inv.property?.name ?? "-"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{inv.amount.toLocaleString()}円</td>
                <td className="px-4 py-3 text-right text-gray-600">{inv.paidAmount.toLocaleString()}円</td>
                <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[inv.status]}`}>{invoiceStatusLabel[inv.status]}</span></td>
                <td className="px-4 py-3 text-gray-600">{inv.dueDate}</td>
                <td className="px-4 py-3 text-center">
                  {inv.status !== "paid" && (
                    <button onClick={() => handlePay(inv)} disabled={payingId === inv.id} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">
                      {payingId === inv.id ? "処理中..." : "入金処理"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
