"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import {
  fetchSaleProperties,
  createSaleProperty,
  updateSaleProperty,
} from "@/lib/api";
import type { SaleProperty, SalePropertyStatus, PropertyType } from "@/types";
import { salePropertyStatusLabel, propertyTypeLabel } from "@/types";

const propertyTypes: PropertyType[] = ["apartment", "mansion", "house", "office"];

const salePropertyStatuses: SalePropertyStatus[] = [
  "available",
  "under_contract",
  "sold",
  "withdrawn",
];

type SalePropertyForm = {
  name: string;
  address: string;
  price: number;
  propertyType: PropertyType;
  landArea: string;
  buildingArea: string;
  builtYear: string;
  roomLayout: string;
  status: SalePropertyStatus;
  description: string;
};

const emptyForm: SalePropertyForm = {
  name: "",
  address: "",
  price: 0,
  propertyType: "apartment",
  landArea: "",
  buildingArea: "",
  builtYear: "",
  roomLayout: "",
  status: "available",
  description: "",
};

const statusBadgeClass: Record<SalePropertyStatus, string> = {
  available: "bg-green-100 text-green-700",
  under_contract: "bg-yellow-100 text-yellow-700",
  sold: "bg-gray-100 text-gray-600",
  withdrawn: "bg-red-100 text-red-700",
};

export default function SalePropertiesPage() {
  const [properties, setProperties] = useState<SaleProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SalePropertyStatus | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SalePropertyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSaleProperties();
      setProperties(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = properties.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: SaleProperty) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      address: p.address,
      price: p.price,
      propertyType: p.propertyType,
      landArea: p.landArea != null ? String(p.landArea) : "",
      buildingArea: p.buildingArea != null ? String(p.buildingArea) : "",
      builtYear: p.builtYear != null ? String(p.builtYear) : "",
      roomLayout: p.roomLayout ?? "",
      status: p.status,
      description: p.description ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateSaleProperty(editingId, {
          name: form.name,
          address: form.address,
          price: form.price,
          propertyType: form.propertyType,
          landArea: form.landArea ? Number(form.landArea) : null,
          buildingArea: form.buildingArea ? Number(form.buildingArea) : null,
          builtYear: form.builtYear ? Number(form.builtYear) : null,
          roomLayout: form.roomLayout || null,
          status: form.status,
          description: form.description || null,
        });
      } else {
        await createSaleProperty({
          name: form.name,
          address: form.address,
          price: form.price,
          propertyType: form.propertyType,
          landArea: form.landArea ? Number(form.landArea) : undefined,
          buildingArea: form.buildingArea ? Number(form.buildingArea) : undefined,
          builtYear: form.builtYear ? Number(form.builtYear) : undefined,
          roomLayout: form.roomLayout || undefined,
          description: form.description || undefined,
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
        title="売買物件管理"
        description="売買物件の登録・編集・ステータス管理"
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
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="物件名・住所で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SalePropertyStatus | "")}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべてのステータス</option>
          {salePropertyStatuses.map((s) => (
            <option key={s} value={s}>
              {salePropertyStatusLabel[s]}
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">住所</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">価格(万円)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">種別</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">土地面積</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">建物面積</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">間取り</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.address}</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {(p.price / 10000).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-600">{propertyTypeLabel[p.propertyType]}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {p.landArea ? `${p.landArea}m\u00B2` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {p.buildingArea ? `${p.buildingArea}m\u00B2` : "-"}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.roomLayout ?? "-"}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeClass[p.status]}`}
                  >
                    {salePropertyStatusLabel[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    編集
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  該当する物件がありません
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
              {editingId ? "売買物件を編集" : "新規売買物件登録"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">物件名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">価格 (円)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">物件タイプ</label>
                  <select
                    value={form.propertyType}
                    onChange={(e) =>
                      setForm({ ...form, propertyType: e.target.value as PropertyType })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {propertyTypes.map((t) => (
                      <option key={t} value={t}>
                        {propertyTypeLabel[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">土地面積</label>
                  <input
                    type="text"
                    value={form.landArea}
                    onChange={(e) => setForm({ ...form, landArea: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">建物面積</label>
                  <input
                    type="text"
                    value={form.buildingArea}
                    onChange={(e) => setForm({ ...form, buildingArea: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">築年</label>
                  <input
                    type="text"
                    value={form.builtYear}
                    onChange={(e) => setForm({ ...form, builtYear: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">間取り</label>
                  <input
                    type="text"
                    value={form.roomLayout}
                    onChange={(e) => setForm({ ...form, roomLayout: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as SalePropertyStatus })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {salePropertyStatuses.map((s) => (
                    <option key={s} value={s}>
                      {salePropertyStatusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                {saving ? "保存中..." : editingId ? "更新" : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
