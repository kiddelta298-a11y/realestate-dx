"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchVacations, createVacation, updateVacation, fetchTenants } from "@/lib/api";
import type { Vacation, VacationStatus, Tenant } from "@/types";
import { vacationStatusLabel } from "@/types";

const statusColor: Record<VacationStatus, string> = {
  requested: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  inspection_scheduled: "bg-indigo-100 text-indigo-700",
  restoration_in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-gray-100 text-gray-600",
};

const steps: VacationStatus[] = ["requested", "confirmed", "inspection_scheduled", "restoration_in_progress", "completed"];

export default function VacationsPage() {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenantId: "", requestedMoveOut: "", notes: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ inspectionDate: "", restorationCost: "", depositRefund: "", restorationNotes: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [vRes, tRes] = await Promise.all([fetchVacations(), fetchTenants({ status: "active" })]);
      setVacations(vRes.data);
      setTenants(tRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.tenantId || !form.requestedMoveOut) return;
    try {
      await createVacation({ tenantId: form.tenantId, requestedMoveOut: form.requestedMoveOut, notes: form.notes || undefined });
      setShowForm(false);
      setForm({ tenantId: "", requestedMoveOut: "", notes: "" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "申請に失敗しました");
    }
  }

  async function handleAdvance(v: Vacation) {
    const idx = steps.indexOf(v.status);
    if (idx < steps.length - 1) {
      try {
        await updateVacation(v.id, { status: steps[idx + 1] });
        await load();
      } catch (e) {
        alert(e instanceof Error ? e.message : "更新に失敗しました");
      }
    }
  }

  async function handleSaveEdit(id: string) {
    try {
      await updateVacation(id, {
        inspectionDate: editData.inspectionDate || undefined,
        restorationCost: editData.restorationCost ? Number(editData.restorationCost) : undefined,
        depositRefund: editData.depositRefund ? Number(editData.depositRefund) : undefined,
        restorationNotes: editData.restorationNotes || undefined,
      });
      setEditId(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  return (
    <div>
      <PageHeader
        title="退去管理"
        description="退去申請と原状回復フロー"
        actions={
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            + 退去申請
          </button>
        }
      />

      {showForm && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">退去申請フォーム</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">入居者</label>
              <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">選択</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">退去希望日</label>
              <input type="date" value={form.requestedMoveOut} onChange={(e) => setForm({ ...form, requestedMoveOut: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="転勤のため等"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={!form.tenantId || !form.requestedMoveOut}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">申請</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:underline">キャンセル</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {vacations.map((v) => {
          const stepIdx = steps.indexOf(v.status);
          return (
            <div key={v.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{v.tenant?.name ?? "-"}</h3>
                  <p className="text-sm text-gray-500">
                    退去希望: {new Date(v.requestedMoveOut).toLocaleDateString("ja-JP")}
                    {v.actualMoveOut && ` → 実際: ${new Date(v.actualMoveOut).toLocaleDateString("ja-JP")}`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[v.status]}`}>
                  {vacationStatusLabel[v.status]}
                </span>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                {steps.map((s, i) => (
                  <div key={s} className="flex items-center shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i <= stepIdx ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-400"
                    }`}>{i + 1}</div>
                    {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < stepIdx ? "bg-blue-400" : "bg-gray-200"}`} />}
                  </div>
                ))}
              </div>

              {/* Info grid */}
              {(v.inspectionDate || v.restorationCost != null || v.depositRefund != null) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm bg-gray-50 rounded-lg p-3 mb-3">
                  {v.inspectionDate && (
                    <div>
                      <span className="text-gray-500 text-xs">立会日</span>
                      <p className="font-medium">{new Date(v.inspectionDate).toLocaleDateString("ja-JP")}</p>
                    </div>
                  )}
                  {v.restorationCost != null && (
                    <div>
                      <span className="text-gray-500 text-xs">原状回復費用</span>
                      <p className="font-medium">{v.restorationCost.toLocaleString()}円</p>
                    </div>
                  )}
                  {v.depositRefund != null && (
                    <div>
                      <span className="text-gray-500 text-xs">敷金返還額</span>
                      <p className="font-medium text-green-600">{v.depositRefund.toLocaleString()}円</p>
                    </div>
                  )}
                </div>
              )}

              {/* Edit form */}
              {editId === v.id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">立会日</label>
                      <input type="date" value={editData.inspectionDate} onChange={(e) => setEditData({ ...editData, inspectionDate: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">原状回復費用</label>
                      <input type="number" value={editData.restorationCost} onChange={(e) => setEditData({ ...editData, restorationCost: e.target.value })}
                        placeholder="円" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">敷金返還額</label>
                      <input type="number" value={editData.depositRefund} onChange={(e) => setEditData({ ...editData, depositRefund: e.target.value })}
                        placeholder="円" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">備考</label>
                      <input type="text" value={editData.restorationNotes} onChange={(e) => setEditData({ ...editData, restorationNotes: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(v.id)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">保存</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-gray-500 hover:underline">キャンセル</button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {v.status !== "completed" && (
                  <button onClick={() => handleAdvance(v)}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                    次のステップへ
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditId(editId === v.id ? null : v.id);
                    setEditData({
                      inspectionDate: v.inspectionDate ? v.inspectionDate.split("T")[0] : "",
                      restorationCost: v.restorationCost?.toString() ?? "",
                      depositRefund: v.depositRefund?.toString() ?? "",
                      restorationNotes: v.restorationNotes ?? "",
                    });
                  }}
                  className="text-xs text-blue-600 border border-blue-300 px-3 py-1.5 rounded hover:bg-blue-50"
                >
                  {editId === v.id ? "閉じる" : "詳細編集"}
                </button>
              </div>
            </div>
          );
        })}
        {vacations.length === 0 && <p className="text-center text-gray-400 py-8">退去申請はありません</p>}
      </div>
    </div>
  );
}
