"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchCustomers, fetchProperties, fetchTaskAlerts } from "@/lib/api";
import type { Customer, Property, TaskAlerts } from "@/types";
import { propertyStatusLabel } from "@/types";

export default function DashboardPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [alerts, setAlerts] = useState<TaskAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [customersRes, propertiesRes, alertsRes] = await Promise.all([
        fetchCustomers({ limit: 100 }),
        fetchProperties({ limit: 100 }),
        fetchTaskAlerts(),
      ]);
      setCustomers(customersRes.data);
      setProperties(propertiesRes.data);
      setAlerts(alertsRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
        <button
          onClick={load}
          className="mt-2 text-sm text-red-600 underline hover:text-red-800"
        >
          再試行
        </button>
      </div>
    );
  }

  // KPI calculations
  const totalCustomers = customers.length;
  const activeCount = customers.filter((c) => c.status === "active").length;
  const contractedCount = customers.filter((c) => c.status === "contracted").length;
  const totalProperties = properties.length;
  const vacantProperties = properties.filter((p) => p.status === "available").length;

  const contractRate = totalCustomers > 0 ? (contractedCount / totalCustomers) * 100 : 0;
  const vacantRate = totalProperties > 0 ? (vacantProperties / totalProperties) * 100 : 0;

  const summaryCards = [
    { label: "顧客数", value: `${totalCustomers}`, unit: "件" },
    { label: "対応中", value: `${activeCount}`, unit: "件" },
    { label: "契約率", value: `${contractRate.toFixed(1)}`, unit: "%" },
    { label: "空室率", value: `${vacantRate.toFixed(1)}`, unit: "%" },
  ];

  // Property status breakdown
  const propertyBreakdown = [
    { key: "available" as const, count: properties.filter((p) => p.status === "available").length, color: "bg-green-100 text-green-700" },
    { key: "reserved" as const, count: properties.filter((p) => p.status === "reserved").length, color: "bg-yellow-100 text-yellow-700" },
    { key: "contracted" as const, count: properties.filter((p) => p.status === "contracted").length, color: "bg-blue-100 text-blue-700" },
    { key: "unavailable" as const, count: properties.filter((p) => p.status === "unavailable").length, color: "bg-gray-100 text-gray-600" },
  ];

  // Alert tasks
  const overdueTasks = alerts?.overdue ?? [];
  const dueTodayTasks = alerts?.dueToday ?? [];
  const alertTasks = [...overdueTasks, ...dueTodayTasks];

  return (
    <div>
      <PageHeader
        title="KPIダッシュボード"
        description="営業指標の概要"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg shadow px-5 py-4"
          >
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900">
              {card.value}
              <span className="text-sm font-normal text-gray-500 ml-1">
                {card.unit}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* Property Status Breakdown */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          物件ステータス内訳
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {propertyBreakdown.map((item) => (
            <div
              key={item.key}
              className={`rounded-lg px-4 py-3 ${item.color}`}
            >
              <p className="text-xs font-medium mb-1">
                {propertyStatusLabel[item.key]}
              </p>
              <p className="text-2xl font-bold">{item.count}</p>
              <p className="text-xs mt-1">件</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Tasks */}
      {alertTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            直近タスクアラート
          </h2>
          <div className="space-y-3">
            {overdueTasks.map((t) => (
              <div
                key={t.id}
                className="border-2 border-red-400 rounded-lg px-4 py-3 bg-red-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">&#9888;</span>
                    <span className="font-medium text-gray-900">
                      {t.title}
                    </span>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      期限超過
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    担当: {t.assignedUser?.name ?? "未割当"} / 期限: {t.dueDate ?? "-"}
                  </span>
                </div>
              </div>
            ))}
            {dueTodayTasks.map((t) => (
              <div
                key={t.id}
                className="border-2 border-red-400 rounded-lg px-4 py-3 bg-red-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">&#9888;</span>
                    <span className="font-medium text-gray-900">
                      {t.title}
                    </span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                      本日期限
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    担当: {t.assignedUser?.name ?? "未割当"} / 期限: {t.dueDate ?? "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
