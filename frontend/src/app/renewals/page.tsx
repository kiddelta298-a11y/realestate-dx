"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchRenewals, updateRenewalStatus } from "@/lib/api";
import type { Renewal, RenewalStatus } from "@/types";
import { renewalStatusLabel } from "@/types";

const statusColor: Record<RenewalStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  notified: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-600",
};

export default function RenewalsPage() {
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewModal, setRenewModal] = useState<string | null>(null);
  const [newEndDate, setNewEndDate] = useState("");
  const [newRentAmount, setNewRentAmount] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchRenewals();
      setRenewals(res.data.sort((a, b) => a.currentEndDate.localeCompare(b.currentEndDate)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, status: RenewalStatus) {
    try {
      if (status === "completed" && renewModal === id) {
        if (!newEndDate) return;
        await updateRenewalStatus(id, "completed", newEndDate, newRentAmount ? Number(newRentAmount) : undefined);
        setRenewModal(null);
        setNewEndDate("");
        setNewRentAmount("");
      } else if (status === "completed") {
        setRenewModal(id);
        return;
      } else {
        if (status === "rejected" && !confirm("この更新を拒否しますか？")) return;
        await updateRenewalStatus(id, status);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作に失敗しました");
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  const activeRenewals = renewals.filter((r) => r.status !== "completed" && r.status !== "rejected");
  const doneRenewals = renewals.filter((r) => r.status === "completed" || r.status === "rejected");

  return (
    <div>
      <PageHeader title="契約更新管理" description="更新予定一覧と手続き" />

      {renewals.length === 0 && (
        <p className="text-center text-gray-400 py-8">更新予定はありません</p>
      )}

      {activeRenewals.length > 0 && (
        <div className="space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">対応中 ({activeRenewals.length}件)</h2>
          {activeRenewals.map((r) => (
            <RenewalCard
              key={r.id}
              renewal={r}
              renewModal={renewModal}
              newEndDate={newEndDate}
              setNewEndDate={setNewEndDate}
              newRentAmount={newRentAmount}
              setNewRentAmount={setNewRentAmount}
              onAction={handleAction}
              onCancelModal={() => setRenewModal(null)}
            />
          ))}
        </div>
      )}

      {doneRenewals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">完了・拒否 ({doneRenewals.length}件)</h2>
          {doneRenewals.map((r) => (
            <RenewalCard
              key={r.id}
              renewal={r}
              renewModal={renewModal}
              newEndDate={newEndDate}
              setNewEndDate={setNewEndDate}
              newRentAmount={newRentAmount}
              setNewRentAmount={setNewRentAmount}
              onAction={handleAction}
              onCancelModal={() => setRenewModal(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RenewalCard({
  renewal: r,
  renewModal,
  newEndDate,
  setNewEndDate,
  newRentAmount,
  setNewRentAmount,
  onAction,
  onCancelModal,
}: {
  renewal: Renewal;
  renewModal: string | null;
  newEndDate: string;
  setNewEndDate: (v: string) => void;
  newRentAmount: string;
  setNewRentAmount: (v: string) => void;
  onAction: (id: string, status: RenewalStatus) => void;
  onCancelModal: () => void;
}) {
  const daysUntilExpiry = Math.ceil(
    (new Date(r.currentEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900">{r.tenant?.name ?? "-"}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            現契約満了: {new Date(r.currentEndDate).toLocaleDateString("ja-JP")}
            {daysUntilExpiry > 0 && daysUntilExpiry <= 180 && (
              <span className={`ml-2 text-xs font-medium ${daysUntilExpiry <= 60 ? "text-red-600" : "text-orange-500"}`}>
                あと{daysUntilExpiry}日
              </span>
            )}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status]}`}>
          {renewalStatusLabel[r.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
        <div>
          <span className="text-gray-500 text-xs">更新後満了</span>
          <p className="text-gray-900 font-medium">{r.newEndDate ? new Date(r.newEndDate).toLocaleDateString("ja-JP") : "-"}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">更新料</span>
          <p className="text-gray-900 font-medium">{r.renewalFee > 0 ? `${r.renewalFee.toLocaleString()}円` : "-"}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">新賃料</span>
          <p className="text-gray-900 font-medium">{r.newRentAmount ? `${r.newRentAmount.toLocaleString()}円` : "-"}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">通知日</span>
          <p className="text-gray-900">{r.notifiedAt ? new Date(r.notifiedAt).toLocaleDateString("ja-JP") : "-"}</p>
        </div>
      </div>

      {/* Completion form */}
      {renewModal === r.id && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
          <p className="text-sm font-medium text-gray-700 mb-2">更新完了情報</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">新しい契約満了日 *</label>
              <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">新賃料（任意）</label>
              <input type="number" value={newRentAmount} onChange={(e) => setNewRentAmount(e.target.value)}
                placeholder="変更なしの場合は空欄"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={() => onAction(r.id, "completed")} disabled={!newEndDate}
                className="bg-green-600 text-white text-sm px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50">
                確定
              </button>
              <button onClick={onCancelModal} className="text-sm text-gray-500 hover:underline">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {r.status !== "completed" && r.status !== "rejected" && (
        <div className="flex flex-wrap gap-2">
          {r.status === "pending" && (
            <button onClick={() => onAction(r.id, "notified")}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
              通知送信
            </button>
          )}
          {(r.status === "pending" || r.status === "notified") && (
            <button onClick={() => onAction(r.id, "accepted")}
              className="text-xs bg-green-100 text-green-700 border border-green-300 px-3 py-1.5 rounded hover:bg-green-200">
              承諾確認
            </button>
          )}
          {r.status === "accepted" && (
            <button onClick={() => onAction(r.id, "completed")}
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
              更新完了
            </button>
          )}
          <button onClick={() => onAction(r.id, "rejected")}
            className="text-xs bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded hover:bg-red-200">
            解約・拒否
          </button>
        </div>
      )}
    </div>
  );
}
