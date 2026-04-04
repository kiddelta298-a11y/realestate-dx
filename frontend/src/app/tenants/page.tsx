"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchTenants, createTenant, updateTenant } from "@/lib/api";
import type { Tenant } from "@/types";

const emptyForm = { name: "", email: "", phone: "", propertyId: "", emergencyContact: "", emergencyPhone: "", guarantorName: "", guarantorPhone: "", moveInDate: "" };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); const res = await fetchTenants(); setTenants(res.data); } catch (e) { setError(e instanceof Error ? e.message : "エラー"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function openNew() { setEditingId(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(t: Tenant) {
    setEditingId(t.id);
    setForm({ name: t.name, email: t.email ?? "", phone: t.phone ?? "", propertyId: t.propertyId, emergencyContact: t.emergencyContact ?? "", emergencyPhone: t.emergencyPhone ?? "", guarantorName: t.guarantorName ?? "", guarantorPhone: t.guarantorPhone ?? "", moveInDate: t.moveInDate });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.moveInDate) return;
    if (editingId) { await updateTenant(editingId, { name: form.name, email: form.email || null, phone: form.phone || null, emergencyContact: form.emergencyContact || null, emergencyPhone: form.emergencyPhone || null, guarantorName: form.guarantorName || null, guarantorPhone: form.guarantorPhone || null }); }
    else { await createTenant({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, propertyId: form.propertyId || "p1", emergencyContact: form.emergencyContact || undefined, emergencyPhone: form.emergencyPhone || undefined, guarantorName: form.guarantorName || undefined, guarantorPhone: form.guarantorPhone || undefined, moveInDate: form.moveInDate }); }
    setModalOpen(false); await load();
  }

  const detail = tenants.find((t) => t.id === detailId);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  return (
    <div>
      <PageHeader title="入居者管理" description="入居者情報の登録・管理" actions={<button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ 新規登録</button>} />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">物件</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">電話</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">入居日</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{t.property?.name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{t.phone ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{t.moveInDate}</td>
                <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{t.isActive ? "入居中" : "退去済"}</span></td>
                <td className="px-4 py-3 text-center flex gap-2 justify-center">
                  <button onClick={() => setDetailId(t.id)} className="text-xs text-blue-600 hover:underline">詳細</button>
                  <button onClick={() => openEdit(t)} className="text-xs text-blue-600 hover:underline">編集</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{detail.name} の詳細</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">メール:</span> <span className="text-gray-900">{detail.email ?? "-"}</span></div>
              <div><span className="text-gray-500">電話:</span> <span className="text-gray-900">{detail.phone ?? "-"}</span></div>
              <div><span className="text-gray-500">物件:</span> <span className="text-gray-900">{detail.property?.name ?? "-"}</span></div>
              <div><span className="text-gray-500">家賃:</span> <span className="text-gray-900">{detail.property?.rent?.toLocaleString() ?? "-"}円</span></div>
              <div><span className="text-gray-500">入居日:</span> <span className="text-gray-900">{detail.moveInDate}</span></div>
              <div><span className="text-gray-500">退去日:</span> <span className="text-gray-900">{detail.moveOutDate ?? "-"}</span></div>
              <div className="col-span-2 border-t pt-2 mt-2"><span className="font-medium text-gray-700">緊急連絡先</span></div>
              <div><span className="text-gray-500">氏名:</span> <span className="text-gray-900">{detail.emergencyContact ?? "-"}</span></div>
              <div><span className="text-gray-500">電話:</span> <span className="text-gray-900">{detail.emergencyPhone ?? "-"}</span></div>
              <div className="col-span-2 border-t pt-2 mt-2"><span className="font-medium text-gray-700">保証人</span></div>
              <div><span className="text-gray-500">氏名:</span> <span className="text-gray-900">{detail.guarantorName ?? "-"}</span></div>
              <div><span className="text-gray-500">電話:</span> <span className="text-gray-900">{detail.guarantorPhone ?? "-"}</span></div>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setDetailId(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editingId ? "入居者編集" : "新規入居者登録"}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">氏名</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">入居日</label><input type="date" value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">メール</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">電話</label><input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">緊急連絡先（氏名）</label><input type="text" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">緊急連絡先（電話）</label><input type="text" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">保証人（氏名）</label><input type="text" value={form.guarantorName} onChange={(e) => setForm({ ...form, guarantorName: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">保証人（電話）</label><input type="text" value={form.guarantorPhone} onChange={(e) => setForm({ ...form, guarantorPhone: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} disabled={!form.name.trim()} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">{editingId ? "更新" : "登録"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
