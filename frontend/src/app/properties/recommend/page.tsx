"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchPropertyRecommendations, fetchCustomers } from "@/lib/api";
import type { Customer, PropertyRecommendation } from "@/types";
import { propertyTypeLabel } from "@/types";

export default function PropertyRecommendPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [minArea, setMinArea] = useState("");
  const [preferredStation, setPreferredStation] = useState("");
  const [preferredLayout, setPreferredLayout] = useState("");

  const [results, setResults] = useState<PropertyRecommendation[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers({ limit: 100 }).then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  async function handleSearch() {
    try {
      setSearching(true);
      setError(null);
      const res = await fetchPropertyRecommendations({
        customerId: customerId || undefined,
        maxRent: maxRent ? Number(maxRent) : undefined,
        minArea: minArea ? Number(minArea) : undefined,
        preferredStation: preferredStation || undefined,
        preferredLayout: preferredLayout || undefined,
      });
      setResults(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSearching(false);
    }
  }

  function scoreColor(score: number) {
    const pct = Math.round(score * 100);
    if (pct >= 80) return "bg-green-100 text-green-700";
    if (pct >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div>
      <PageHeader title="物件提案" description="顧客の希望条件に合った物件を提案" />

      {/* 条件入力 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">希望条件</h2>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">顧客（任意）</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">選択なし</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">希望賃料上限（円）</label>
            <input type="number" value={maxRent} onChange={(e) => setMaxRent(e.target.value)} placeholder="150000" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">希望面積下限（m²）</label>
            <input type="number" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="30" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">希望駅</label>
            <input type="text" value={preferredStation} onChange={(e) => setPreferredStation(e.target.value)} placeholder="渋谷" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">希望間取り</label>
            <input type="text" value={preferredLayout} onChange={(e) => setPreferredLayout(e.target.value)} placeholder="1LDK" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <button onClick={handleSearch} disabled={searching} className="mt-5 bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {searching ? "検索中..." : "提案を取得"}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* 結果 */}
      {results === null && !searching && (
        <div className="text-center py-12 text-gray-400">条件を入力して提案を取得してください</div>
      )}

      {searching && (
        <div className="text-center py-12 text-gray-500">提案を検索中...</div>
      )}

      {results !== null && !searching && results.length === 0 && (
        <div className="text-center py-12 text-gray-400">条件に合う物件が見つかりませんでした</div>
      )}

      {results !== null && !searching && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">提案物件（{results.length}件）</h2>
          {results.map((rec, i) => {
            const p = rec.property;
            const pct = Math.round(rec.matchScore * 100);
            return (
              <div key={p.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-medium">#{i + 1}</span>
                      <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rec.matchReasons.map((r) => (
                        <span key={r} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">{r}</span>
                      ))}
                    </div>
                  </div>
                  <span className={`text-lg font-bold px-3 py-1 rounded-full ${scoreColor(rec.matchScore)}`}>
                    {pct}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">住所: </span>
                    <span className="text-gray-900">{p.address}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">賃料: </span>
                    <span className="text-gray-900 font-medium">{p.rent.toLocaleString()}円</span>
                  </div>
                  <div>
                    <span className="text-gray-500">間取り: </span>
                    <span className="text-gray-900">{p.roomLayout ?? "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">面積: </span>
                    <span className="text-gray-900">{p.floorArea ?? "-"}m²</span>
                  </div>
                  <div>
                    <span className="text-gray-500">最寄駅: </span>
                    <span className="text-gray-900">{p.nearestStation ?? "-"}{p.walkMinutes ? ` 徒歩${p.walkMinutes}分` : ""}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">タイプ: </span>
                    <span className="text-gray-900">{propertyTypeLabel[p.propertyType]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
