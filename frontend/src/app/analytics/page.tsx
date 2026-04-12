"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchAnalyticsSummary } from "@/lib/api";
import type { AnalyticsSummary } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

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

  // Funnel data
  const funnelData = [
    { name: "反響", value: data.inquiryCount, fill: "#3b82f6" },
    { name: "来店", value: data.visitCount, fill: "#22c55e" },
    { name: "申込", value: data.applicationCount, fill: "#f97316" },
    { name: "成約", value: data.contractCount, fill: "#a855f7" },
  ];

  // Bar chart data for staff
  const staffData = data.byStaff.map((s) => ({
    name: s.name,
    来店: s.visits,
    成約: s.contracts,
    成約率: s.visits > 0 ? Math.round((s.contracts / s.visits) * 100) : 0,
  }));

  // Conversion rate bar data
  const rateData = [
    { name: "来店率", rate: parseFloat(data.visitRate.toFixed(1)), fill: "#22c55e" },
    { name: "申込率", rate: parseFloat(data.applicationRate.toFixed(1)), fill: "#f97316" },
    { name: "成約率", rate: parseFloat(data.contractRate.toFixed(1)), fill: "#a855f7" },
  ];

  return (
    <div>
      <PageHeader
        title="来店率分析ダッシュボード"
        description="来店率・成約率・コンバージョン分析"
      />

      <p className="text-sm text-gray-500 mb-4">対象期間: {data.period}</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "反響数", value: data.inquiryCount, color: "text-blue-600", bg: "bg-blue-50", sub: "-" },
          { label: "来店数", value: data.visitCount, color: "text-green-600", bg: "bg-green-50", sub: `来店率 ${data.visitRate.toFixed(1)}%` },
          { label: "申込数", value: data.applicationCount, color: "text-orange-600", bg: "bg-orange-50", sub: `申込率 ${data.applicationRate.toFixed(1)}%` },
          { label: "成約数", value: data.contractCount, color: "text-purple-600", bg: "bg-purple-50", sub: `成約率 ${data.contractRate.toFixed(1)}%` },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-lg p-4`}>
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Funnel Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">コンバージョンファネル</h2>
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart>
              <Tooltip formatter={(value) => [`${value}件`, ""]} />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  position="center"
                  content={({ x, y, width, height, value, index }) => {
                    const item = funnelData[index as number];
                    if (!item || !width || !height) return null;
                    return (
                      <text
                        x={Number(x) + Number(width) / 2}
                        y={Number(y) + Number(height) / 2}
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={13}
                        fontWeight={600}
                      >
                        {item.name} {item.value}件
                      </text>
                    );
                  }}
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Rate Bar */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">転換率</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rateData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`${value}%`, "転換率"]} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {rateData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Performance Chart */}
      {staffData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">担当者別パフォーマンス</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={staffData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="来店" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="成約" fill="#a855f7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Staff Table */}
      <div className="overflow-x-auto mb-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900">担当者別詳細</h2>
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
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${parseFloat(rate) >= 30 ? "text-green-600" : parseFloat(rate) >= 15 ? "text-orange-500" : "text-gray-700"}`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {data.byStaff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">データがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Suggestions */}
      {data.aiSuggestions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">AI改善提案</h2>
          <ul className="space-y-3">
            {data.aiSuggestions.map((suggestion, i) => (
              <li key={i} className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <span className="text-yellow-500 shrink-0 mt-0.5">💡</span>
                <span className="text-sm text-gray-700">{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
