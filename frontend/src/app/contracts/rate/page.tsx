"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchContractRateDetail } from "@/lib/api";
import type { ContractRateDetail } from "@/types";

type ViewMode = "office" | "company" | "agent";

export default function ContractRatePage() {
  const [data, setData] = useState<ContractRateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("agent");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchContractRateDetail();
        setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!data) return null;

  const tabs: { key: ViewMode; label: string }[] = [
    { key: "agent", label: "営業マン単位" },
    { key: "office", label: "営業所単位" },
    { key: "company", label: "会社単位" },
  ];

  const items =
    viewMode === "office"
      ? data.byOffice
      : viewMode === "company"
        ? data.byCompany
        : data.byAgent;

  return (
    <div>
      <PageHeader title="契約率詳細" description="営業所・会社・営業マン単位の契約率" />

      {/* 全体 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">全体契約率</h2>
        <div className="flex items-center gap-6">
          <div className="text-4xl font-bold text-violet-600">
            {data.overall.rate}%
          </div>
          <div className="text-sm text-gray-600">
            <p>全顧客: {data.overall.total}件</p>
            <p>契約済: {data.overall.contracted}件</p>
          </div>
          <div className="flex-1 max-w-xs">
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full"
                style={{ width: `${Math.min(data.overall.rate, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* タブ切替 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
              viewMode === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                名前
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                全顧客
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                契約済
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                契約率
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-48">
                グラフ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.name} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {item.name}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {item.total}件
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {item.contracted}件
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-bold text-violet-600">
                    {item.rate}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{
                        width: `${Math.min(item.rate, 100)}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
