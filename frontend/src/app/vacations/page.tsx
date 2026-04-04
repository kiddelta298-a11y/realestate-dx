"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchVacations, createVacation, updateVacation, fetchTenants } from "@/lib/api";
import type { Vacation, VacationStatus, Tenant } from "@/types";
import { vacationStatusLabel } from "@/types";

const statusColor: Record<VacationStatus, string> = {
  requested: "bg-yellow-100 text-yellow-700",
  inspection_scheduled: "bg-blue-100 text-blue-700",
  inspected: "bg-purple-100 text-purple-700",
  deposit_settled: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
};

const steps: VacationStatus[] = ["requested", "inspection_scheduled", "inspected", "deposit_settled", "completed"];

export default function VacationsPage() {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenantId: "", requestedMoveOut: "", notes: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); const [vRes, tRes] = await Promise.all([fetchVacations(), fetchTenants()]); setVacations(vRes.data); setTenants(tRes.data); } catch (e) { setError(e instanceof Error ? e.message : "エラー"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.tenantId || !form.requestedMoveOut) return;
    const tenant = tenants.find((t) => t.id === form.tenantId);
    await createVacation({ tenantId: form.tenantId, propertyId: tenant?.propertyId ?? "", requestedMoveOut: form.requestedMoveOut, notes: form.notes || undefined });
    setShowForm(false); setForm({ tenantId: "", requestedMoveOut: "", notes: "" }); await load();
  }

  async function handleAdvance(v: Vacation) {
    const idx = steps.indexOf(v.status);
    if (idx < steps.length - 1) { await updateVacation(v.id, { status: steps[idx + 1] }); await load(); }
  }

  async function toggleChecklist(v: Vacation, itemIdx: number) {
    const newChecklist = v.checklist.map((c, i) => i === itemIdx ? { ...c, checked: !c.checked } : c);
    await updateVacation(v.id, { checklist: newChecklist }); await load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  return (
    <div>
      <PageHeader title="退去管理" description="退去申請と原状回復チェック" actions={<button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ 退去申請</button>} />

      {showForm && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">退去申請フォーム</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">入居者</label>
              <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">選択</option>
                {tenants.filter((t) => t.isActive).map((t) => (<option key={t.id} value={t.id}>{t.name} - {t.property?.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">退去希望日</label>
              <input type="date" value={form.requestedMoveOut} onChange={(e) => setForm({ ...form, requestedMoveOut: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="転勤のため等" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={!form.tenantId || !form.requestedMoveOut} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">申請</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:underline">キャンセル</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {vacations.map((v) => {
          const stepIdx = steps.indexOf(v.status);
          return (
            <div key={v.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{v.tenant?.name ?? "-"}</h3>
                  <p className="text-sm text-gray-500">{v.property?.name ?? "-"} | 退去希望: {v.requestedMoveOut}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[v.status]}`}>{vacationStatusLabel[v.status]}</span>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-1 mb-3">
                {steps.map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= stepIdx ? "bg-primary-500 text-white" : "bg-gray-200 text-gray-400"}`}>{i + 1}</div>
                    {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < stepIdx ? "bg-primary-400" : "bg-gray-200"}`} />}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-2">
                {v.status !== "completed" && <button onClick={() => handleAdvance(v)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">次のステップへ</button>}
                <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} className="text-xs text-blue-600 hover:underline">{expandedId === v.id ? "チェックリスト非表示" : "チェックリスト表示"}</button>
              </div>

              {expandedId === v.id && (
                <div className="bg-gray-50 rounded-lg p-4 mt-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">原状回復チェックリスト</h4>
                  {v.checklist.map((item, idx) => (
                    <label key={idx} className="flex items-center gap-2 py-1 text-sm">
                      <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(v, idx)} className="rounded" />
                      <span className={item.checked ? "line-through text-gray-400" : "text-gray-700"}>{item.item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {vacations.length === 0 && <p className="text-center text-gray-400 py-8">退去申請はありません</p>}
      </div>
    </div>
  );
}
