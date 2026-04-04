"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchRenewals, updateRenewalStatus } from "@/lib/api";
import type { Renewal, RenewalStatus } from "@/types";
import { renewalStatusLabel } from "@/types";

const statusColor: Record<RenewalStatus, string> = {
  upcoming: "bg-yellow-100 text-yellow-700",
  notified: "bg-blue-100 text-blue-700",
  renewed: "bg-green-100 text-green-700",
  terminated: "bg-red-100 text-red-700",
};

export default function RenewalsPage() {
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewModal, setRenewModal] = useState<string | null>(null);
  const [newEndDate, setNewEndDate] = useState("");

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); const res = await fetchRenewals(); setRenewals(res.data.sort((a, b) => a.currentEndDate.localeCompare(b.currentEndDate))); } catch (e) { setError(e instanceof Error ? e.message : "エラー"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, status: RenewalStatus) {
    if (status === "renewed" && renewModal === id && newEndDate) {
      await updateRenewalStatus(id, "renewed", newEndDate);
      setRenewModal(null); setNewEndDate("");
    } else if (status === "renewed") {
      setRenewModal(id); return;
    } else {
      if (status === "terminated" && !confirm("この契約を解約しますか？")) return;
      await updateRenewalStatus(id, status);
    }
    await load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  return (
    <div>
      <PageHeader title="契約更新管理" description="更新予定一覧と手続き" />

      <div className="space-y-4">
        {renewals.map((r) => (
          <div key={r.id} className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{r.tenant?.name ?? "-"}</h3>
                <p className="text-sm text-gray-500">{r.property?.name ?? "-"}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status]}`}>{renewalStatusLabel[r.status]}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
              <div><span className="text-gray-500">現契約満了:</span> <span className="text-gray-900 font-medium">{r.currentEndDate}</span></div>
              <div><span className="text-gray-500">更新後満了:</span> <span className="text-gray-900">{r.newEndDate ?? "-"}</span></div>
              <div><span className="text-gray-500">更新料:</span> <span className="text-gray-900">{r.renewalFee?.toLocaleString() ?? "-"}円</span></div>
            </div>

            {/* Renew Modal inline */}
            {renewModal === r.id && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">新しい契約満了日</label>
                <div className="flex gap-2">
                  <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => handleAction(r.id, "renewed")} disabled={!newEndDate} className="bg-green-600 text-white text-sm px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50">更新確定</button>
                  <button onClick={() => setRenewModal(null)} className="text-sm text-gray-500 hover:underline">キャンセル</button>
                </div>
              </div>
            )}

            {(r.status === "upcoming" || r.status === "notified") && (
              <div className="flex gap-2">
                {r.status === "upcoming" && <button onClick={() => handleAction(r.id, "notified")} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">通知送信</button>}
                <button onClick={() => handleAction(r.id, "renewed")} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">更新手続き</button>
                <button onClick={() => handleAction(r.id, "terminated")} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700">解約</button>
              </div>
            )}
          </div>
        ))}
        {renewals.length === 0 && <p className="text-center text-gray-400 py-8">更新予定はありません</p>}
      </div>
    </div>
  );
}
