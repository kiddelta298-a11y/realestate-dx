"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import {
  fetchProperties,
  createProperty,
  updateProperty,
  deleteProperty,
} from "@/lib/api";
import type { Property, PropertyType, PropertyStatus } from "@/types";
import { propertyTypeLabel, propertyStatusLabel } from "@/types";

const propertyTypes: PropertyType[] = ["apartment", "mansion", "house", "office"];

type PropertyForm = {
  name: string;
  address: string;
  rent: number;
  floorArea: number | null;
  roomLayout: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  nearestStation: string;
  walkMinutes: number;
  managementFee: number;
  deposit: number;
  keyMoney: number;
};

const emptyForm: PropertyForm = {
  name: "",
  address: "",
  rent: 0,
  floorArea: null,
  roomLayout: "",
  propertyType: "apartment",
  status: "available",
  nearestStation: "",
  walkMinutes: 0,
  managementFee: 0,
  deposit: 0,
  keyMoney: 0,
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [vacantOnly, setVacantOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchProperties({ limit: 200 });
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
    if (vacantOnly && p.status !== "available") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.nearestStation ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: Property) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      address: p.address,
      rent: p.rent,
      floorArea: p.floorArea,
      roomLayout: p.roomLayout ?? "",
      propertyType: p.propertyType,
      status: p.status,
      nearestStation: p.nearestStation ?? "",
      walkMinutes: p.walkMinutes ?? 0,
      managementFee: p.managementFee,
      deposit: p.deposit,
      keyMoney: p.keyMoney,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateProperty(editingId, {
          name: form.name,
          address: form.address,
          rent: form.rent,
          floorArea: form.floorArea,
          roomLayout: form.roomLayout || null,
          propertyType: form.propertyType,
          status: form.status,
          nearestStation: form.nearestStation || null,
          walkMinutes: form.walkMinutes || null,
          managementFee: form.managementFee,
          deposit: form.deposit,
          keyMoney: form.keyMoney,
        });
      } else {
        await createProperty({
          name: form.name,
          address: form.address,
          rent: form.rent,
          floorArea: form.floorArea ?? undefined,
          roomLayout: form.roomLayout || undefined,
          propertyType: form.propertyType,
          status: form.status,
          nearestStation: form.nearestStation || undefined,
          walkMinutes: form.walkMinutes || undefined,
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

  async function handleDelete(id: string) {
    if (!confirm("この物件を削除しますか?")) return;
    try {
      await deleteProperty(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
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
        title="物件管理"
        description="物件情報の登録・編集・検索"
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
          placeholder="物件名・住所・最寄駅で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={vacantOnly}
            onChange={(e) => setVacantOnly(e.target.checked)}
            className="rounded"
          />
          空室のみ
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">物件名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">住所</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">賃料</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">面積</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">間取り</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">種別</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">最寄駅</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{p.address}</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {p.rent.toLocaleString()}円
                </td>
                <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                  {p.floorArea != null ? `${p.floorArea}m\u00B2` : "-"}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{p.roomLayout ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{propertyTypeLabel[p.propertyType]}</td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                  {p.nearestStation ? `${p.nearestStation}駅 徒歩${p.walkMinutes ?? "?"}分` : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  {p.status === "available" ? (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      空室
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                      {propertyStatusLabel[p.status]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      削除
                    </button>
                  </div>
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
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? "物件を編集" : "新規物件登録"}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">賃料 (円)</label>
                  <input
                    type="number"
                    value={form.rent}
                    onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">面積 (m&sup2;)</label>
                  <input
                    type="number"
                    value={form.floorArea ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, floorArea: e.target.value ? Number(e.target.value) : null })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">間取り</label>
                  <input
                    type="text"
                    value={form.roomLayout}
                    onChange={(e) => setForm({ ...form, roomLayout: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">最寄駅</label>
                  <input
                    type="text"
                    value={form.nearestStation}
                    onChange={(e) => setForm({ ...form, nearestStation: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">徒歩 (分)</label>
                  <input
                    type="number"
                    value={form.walkMinutes}
                    onChange={(e) => setForm({ ...form, walkMinutes: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">管理費 (円)</label>
                  <input
                    type="number"
                    value={form.managementFee}
                    onChange={(e) => setForm({ ...form, managementFee: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">敷金 (円)</label>
                  <input
                    type="number"
                    value={form.deposit}
                    onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">礼金 (円)</label>
                  <input
                    type="number"
                    value={form.keyMoney}
                    onChange={(e) => setForm({ ...form, keyMoney: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as PropertyStatus })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="available">{propertyStatusLabel.available}</option>
                  <option value="reserved">{propertyStatusLabel.reserved}</option>
                  <option value="contracted">{propertyStatusLabel.contracted}</option>
                  <option value="unavailable">{propertyStatusLabel.unavailable}</option>
                </select>
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
