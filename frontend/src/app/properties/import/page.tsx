"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { extractPropertyFromText, extractPropertyFromUrl, createProperty } from "@/lib/api";
import type { ExtractedProperty, PropertyType } from "@/types";
import { propertyTypeLabel } from "@/types";

type InputMode = "text" | "url";

export default function PropertyImportPage() {
  const [mode, setMode] = useState<InputMode>("text");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedProperty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable form from extracted data
  const [form, setForm] = useState<ExtractedProperty | null>(null);

  async function handleExtract() {
    try {
      setExtracting(true); setError(null); setSaved(false);
      const res = mode === "text"
        ? await extractPropertyFromText(textInput)
        : await extractPropertyFromUrl(urlInput);
      setExtracted(res.data);
      setForm({ ...res.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "抽出に失敗しました");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!form || !form.address) return;
    try {
      setSaving(true);
      await createProperty({
        name: form.name ?? `物件 ${form.address}`,
        propertyType: (form.propertyType ?? "mansion") as PropertyType,
        address: form.address,
        rent: form.rent ?? 0,
        nearestStation: form.nearestStation ?? undefined,
        walkMinutes: form.walkMinutes ?? undefined,
        roomLayout: form.roomLayout ?? undefined,
        floorArea: form.floorArea ?? undefined,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function updateForm(key: keyof ExtractedProperty, value: string | number | null) {
    if (!form) return;
    setForm({ ...form, [key]: value });
  }

  return (
    <div>
      <PageHeader title="物件掲載入力自動化" description="テキストまたはURLから物件情報を自動抽出" />

      {/* Input Mode */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <button onClick={() => setMode("text")} className={`px-4 py-2 text-sm rounded-md font-medium ${mode === "text" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>テキスト入力</button>
          <button onClick={() => setMode("url")} className={`px-4 py-2 text-sm rounded-md font-medium ${mode === "url" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>URL入力</button>
        </div>

        {mode === "text" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">物件情報テキスト</label>
            <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={5} placeholder="物件名、賃料120,000円、1LDK、45m²、渋谷駅徒歩5分..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">物件掲載URL</label>
            <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://suumo.jp/..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        <button onClick={handleExtract} disabled={extracting || (mode === "text" ? !textInput.trim() : !urlInput.trim())} className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {extracting ? "抽出中..." : "情報を抽出"}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"><p className="text-red-700">{error}</p></div>}

      {saved && <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"><p className="text-green-700">物件を登録しました</p></div>}

      {/* Preview & Edit */}
      {form && !saved && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">抽出結果 — 確認・修正</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">物件名</label>
              <input type="text" value={form.name ?? ""} onChange={(e) => updateForm("name", e.target.value || null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">物件タイプ</label>
              <select value={form.propertyType ?? "mansion"} onChange={(e) => updateForm("propertyType", e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {(Object.entries(propertyTypeLabel) as [string, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
              <input type="text" value={form.address ?? ""} onChange={(e) => updateForm("address", e.target.value || null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">賃料（円）</label>
              <input type="number" value={form.rent ?? ""} onChange={(e) => updateForm("rent", e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">管理費（円）</label>
              <input type="number" value={form.managementFee ?? ""} onChange={(e) => updateForm("managementFee", e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">間取り</label>
              <input type="text" value={form.roomLayout ?? ""} onChange={(e) => updateForm("roomLayout", e.target.value || null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">面積（m²）</label>
              <input type="number" value={form.floorArea ?? ""} onChange={(e) => updateForm("floorArea", e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最寄駅</label>
              <input type="text" value={form.nearestStation ?? ""} onChange={(e) => updateForm("nearestStation", e.target.value || null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">徒歩（分）</label>
              <input type="number" value={form.walkMinutes ?? ""} onChange={(e) => updateForm("walkMinutes", e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea value={form.description ?? ""} onChange={(e) => updateForm("description", e.target.value || null)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => { setForm(null); setExtracted(null); }} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">クリア</button>
            <button onClick={handleSave} disabled={saving || !form.address} className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 font-medium disabled:opacity-50">
              {saving ? "登録中..." : "DB登録"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
