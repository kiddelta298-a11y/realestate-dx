"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchAnalyticsSummary } from "@/lib/api";
import type { AnalyticsSummary } from "@/types";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAnalyticsSummary();
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        <button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button>
      </div>
    );
  }

  if (!data) return null;

  const funnelStages = [
    { label: "反響", count: data.inquiryCount, color: "bg-blue-500", rate: null },
    { label: "来店", count: data.visitCount, color: "bg-green-500", rate: data.visitRate },
    { label: "申込", count: data.applicationCount, color: "bg-orange-500", rate: data.applicationRate },
    { label: "成約", count: data.contractCount, color: "bg-purple-500", rate: data.contractRate },
  ];

  const maxCount = data.inquiryCount || 1;

  return (
    <div>
      <PageHeader
        title="来店率分析ダッシュボード"
        description="来店率・成約率・コンバージョン分析"
      />

      {/* Period */}
      <p className="text-sm text-gray-500 mb-4">対象期間: {data.period}</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">反響数</p>
          <p className="text-2xl font-bold text-blue-600">{data.inquiryCount.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">-</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">来店数</p>
          <p className="text-2xl font-bold text-green-600">{data.visitCount.toLocaleString()}</p>
          <p className="text-xs text-green-500 mt-1">来店率 {data.visitRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">申込数</p>
          <p className="text-2xl font-bold text-orange-600">{data.applicationCount.toLocaleString()}</p>
          <p className="text-xs text-orange-500 mt-1">申込率 {data.applicationRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">成約数</p>
          <p className="text-2xl font-bold text-purple-600">{data.contractCount.toLocaleString()}</p>
          <p className="text-xs text-purple-500 mt-1">成約率 {data.contractRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">コンバージョンファネル</h2>
        <div className="space-y-4">
          {funnelStages.map((stage, i) => {
            const widthPct = Math.max((stage.count / maxCount) * 100, 4);
            const nextStage = funnelStages[i + 1];
            const conversionRate = nextStage && stage.count > 0
              ? ((nextStage.count / stage.count) * 100).toFixed(1)
              : null;

            return (
              <div key={stage.label}>
                <div className="flex items-center gap-3">
                  <span className="w-10 text-sm font-medium text-gray-700 shrink-0">
                    {stage.label}
                  </span>
                  <div className="flex-1">
                    <div
                      className={`${stage.color} h-8 rounded flex items-center px-3 text-white text-sm font-medium transition-all`}
                      style={{ width: `${widthPct}%` }}
                    >
                      {stage.count.toLocaleString()}
                    </div>
                  </div>
                  {stage.rate !== null && (
                    <span className="text-xs text-gray-500 w-16 text-right shrink-0">
                      {stage.rate.toFixed(1)}%
                    </span>
                  )}
                </div>
                {conversionRate && (
                  <div className="ml-13 pl-14 text-xs text-gray-400 mt-1">
                    {"\u2193"} 転換率 {conversionRate}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Staff Performance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">担当者別パフォーマンス</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">担当者</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">来店数</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">成約数</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">成約率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.byStaff.map((staff) => {
              const rate = staff.visits > 0
                ? ((staff.contracts / staff.visits) * 100).toFixed(1)
                : "0.0";
              return (
                <tr key={staff.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{staff.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{staff.visits}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{staff.contracts}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{rate}%</td>
                </tr>
              );
            })}
            {data.byStaff.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AI Suggestions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">AI改善提案</h2>
        {data.aiSuggestions.length > 0 ? (
          <ul className="space-y-3">
            {data.aiSuggestions.map((suggestion, i) => (
              <li
                key={i}
                className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4"
              >
                <span className="text-yellow-500 text-lg shrink-0">
                  <svg className="w-5 h-5 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-2 11.66V16a2 2 0 104 0v-2.34A6 6 0 0010 2zm0 2a4 4 0 012.93 6.72.75.75 0 00-.43.68V14H7.5v-2.6a.75.75 0 00-.43-.68A4 4 0 0110 4z" />
                  </svg>
                </span>
                <span className="text-sm text-gray-700">{suggestion}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">提案はありません</p>
        )}
      </div>
    </div>
  );
}
