"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchCustomers,
  fetchProperties,
  fetchTaskAlerts,
  fetchMonthlySales,
  fetchInquiries,
} from "@/lib/api";
import type {
  Customer,
  Property,
  TaskAlerts,
  MonthlySales,
  InquiryItem,
  AgentSales,
} from "@/types";
import { customerSourceLabel, taskStatusLabel } from "@/types";
import {
  Users,
  Building2,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  CalendarDays,
  Banknote,
  Inbox,
  BarChart3,
  Settings,
  ChevronDown,
} from "lucide-react";
import { BackButton } from "@/components/back-button";

// --- グラフ用の円グラフコンポーネント（SVG） ---
function DonutChart({
  value,
  max,
  label,
  unit,
  color,
  size = 120,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  size?: number;
}) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center shrink-0" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={10}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xl font-bold text-gray-900">
            {typeof value === "number" && value % 1 === 0
              ? value.toLocaleString()
              : value}
            <span className="text-xs font-normal text-gray-400 ml-0.5">
              {unit}
            </span>
          </p>
        </div>
      </div>
      <p className="text-xs font-medium text-gray-600 mt-2">{label}</p>
    </div>
  );
}

// --- 横棒グラフコンポーネント ---
function HorizontalBar({
  value,
  max,
  label,
  subLabel,
  color,
  bgColor,
}: {
  value: number;
  max: number;
  label: string;
  subLabel: string;
  color: string;
  bgColor: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{subLabel}</span>
      </div>
      <div className={`w-full h-5 ${bgColor} rounded-full overflow-hidden`}>
        <div
          className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- 1日以上経過かどうか判定 ---
function isOverOneDay(createdAt: string): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  return now.getTime() - created.getTime() > 24 * 60 * 60 * 1000;
}

type ChartMetric = "sales" | "properties" | "contractRate";

export default function DashboardPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [alerts, setAlerts] = useState<TaskAlerts | null>(null);
  const [sales, setSales] = useState<MonthlySales | null>(null);
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // グラフ選択状態
  const [selectedMetrics, setSelectedMetrics] = useState<Set<ChartMetric>>(
    new Set()
  );
  // 担当者選択（売上グラフ用） "" = 全体
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  function toggleMetric(metric: ChartMetric) {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) {
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [customersRes, propertiesRes, alertsRes, salesRes, inquiriesRes] =
        await Promise.all([
          fetchCustomers({ limit: 100 }),
          fetchProperties({ limit: 100 }),
          fetchTaskAlerts(),
          fetchMonthlySales(),
          fetchInquiries(),
        ]);
      setCustomers(customersRes.data);
      setProperties(propertiesRes.data);
      setAlerts(alertsRes.data);
      setSales(salesRes.data);
      setInquiries(inquiriesRes.data);
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
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={18} className="text-red-500" />
          <p className="font-medium text-red-700">データの取得に失敗しました</p>
        </div>
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          onClick={load}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          再試行
        </button>
      </div>
    );
  }

  const totalCustomers = customers.length;
  const contractedCount = customers.filter(
    (c) => c.status === "contracted"
  ).length;
  const totalProperties = properties.length;
  const vacantProperties = properties.filter(
    (p) => p.status === "available"
  ).length;
  const contractRate =
    totalCustomers > 0
      ? Math.round((contractedCount / totalCustomers) * 100)
      : 0;

  const overdueTasks = alerts?.overdue ?? [];
  const dueTodayTasks = alerts?.dueToday ?? [];
  const totalAlerts = overdueTasks.length + dueTodayTasks.length;

  const confirmedSales = sales?.confirmedSales ?? 0;
  const monthlyTarget = sales?.monthlyTarget ?? 0;
  const progressRate = sales?.progressRate ?? 0;

  // 1日超経過の問い合わせ件数
  const staleCount = inquiries.filter((i) => isOverOneDay(i.createdAt)).length;

  const quickLinks = [
    { href: "/customers", label: "顧客を登録", icon: <Users size={14} /> },
    {
      href: "/properties",
      label: "物件を登録",
      icon: <Building2 size={14} />,
    },
    {
      href: "/viewings",
      label: "内見を予約",
      icon: <CalendarDays size={14} />,
    },
    {
      href: "/tasks",
      label: "タスクを確認",
      icon: <CheckCircle2 size={14} />,
    },
  ];

  const taskStatusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
    done: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-600",
    auto_completed: "bg-teal-100 text-teal-700",
  };

  // グラフ選択肢の定義
  const metricOptions: {
    key: ChartMetric;
    label: string;
    color: string;
  }[] = [
    { key: "sales", label: "今月の売上", color: "text-blue-600" },
    { key: "properties", label: "登録物件数", color: "text-emerald-600" },
    { key: "contractRate", label: "契約率", color: "text-violet-600" },
  ];

  return (
    <div className="w-full max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <BackButton />
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">営業状況の概要</p>
      </div>

      {/* ====== KPI グラフセクション ====== */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-800">KPIグラフ</h2>
        </div>

        {/* 項目選択チェックボックス */}
        <div className="flex flex-wrap gap-3 mb-5">
          {metricOptions.map((opt) => {
            const isChecked = selectedMetrics.has(opt.key);
            return (
              <label
                key={opt.key}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all select-none text-sm font-medium ${
                  isChecked
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleMetric(opt.key)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isChecked
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isChecked && (
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                {opt.label}
              </label>
            );
          })}
        </div>

        {/* グラフ表示エリア */}
        {selectedMetrics.size === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            上の項目を選択するとグラフが表示されます
          </div>
        ) : (
          <div className="space-y-6">
            {/* 今月の売上 */}
            {selectedMetrics.has("sales") && (() => {
              const agents = sales?.byAgent ?? [];
              const agentData = selectedAgent
                ? agents.find((a) => a.userId === selectedAgent) ?? null
                : null;
              const dispSales = agentData ? agentData.confirmedSales : confirmedSales;
              const dispTarget = agentData ? agentData.monthlyTarget : monthlyTarget;
              const dispRate = agentData ? agentData.progressRate : progressRate;
              const dispLabel = agentData ? agentData.name : "全体";

              return (
                <div className="border border-gray-100 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700">
                      今月の売上目標進捗率
                      {agentData && (
                        <span className="ml-2 text-blue-600">— {dispLabel}</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* 担当者プルダウン */}
                      <div className="relative">
                        <select
                          value={selectedAgent}
                          onChange={(e) => setSelectedAgent(e.target.value)}
                          className="appearance-none border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="">全体</option>
                          {agents.map((a) => (
                            <option key={a.userId} value={a.userId}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={12}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                      </div>
                      {/* 目標設定リンク */}
                      <Link
                        href="/settings/sales-target"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                        title="目標設定"
                      >
                        <Settings size={14} />
                        目標設定
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <DonutChart
                      value={dispRate}
                      max={100}
                      label="進捗率"
                      unit="%"
                      color="#3b82f6"
                    />
                    <div className="flex-1 space-y-3">
                      <HorizontalBar
                        value={dispSales}
                        max={dispTarget || 1}
                        label="確定売上"
                        subLabel={`${(dispSales / 10000).toLocaleString()}万円`}
                        color="bg-blue-500"
                        bgColor="bg-blue-100"
                      />
                      <HorizontalBar
                        value={dispTarget}
                        max={dispTarget || 1}
                        label="今月の目標"
                        subLabel={dispTarget > 0 ? `${(dispTarget / 10000).toLocaleString()}万円` : "未設定"}
                        color="bg-gray-300"
                        bgColor="bg-gray-100"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500">残り</span>
                        <span className="text-sm font-bold text-orange-600">
                          {dispTarget > 0
                            ? `${(Math.max(0, dispTarget - dispSales) / 10000).toLocaleString()}万円`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 登録物件数 */}
            {selectedMetrics.has("properties") && (
              <div className="border border-gray-100 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  登録物件数 / 問い合わせ待ち
                </h3>
                <div className="flex items-center gap-8">
                  <DonutChart
                    value={totalProperties}
                    max={Math.max(totalProperties, 1)}
                    label="総物件数"
                    unit="件"
                    color="#10b981"
                  />
                  <div className="flex-1 space-y-3">
                    <HorizontalBar
                      value={vacantProperties}
                      max={totalProperties || 1}
                      label="空室（公開中）"
                      subLabel={`${vacantProperties}件`}
                      color="bg-emerald-500"
                      bgColor="bg-emerald-100"
                    />
                    <HorizontalBar
                      value={totalProperties - vacantProperties}
                      max={totalProperties || 1}
                      label="成約済・非公開"
                      subLabel={`${totalProperties - vacantProperties}件`}
                      color="bg-gray-400"
                      bgColor="bg-gray-100"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <Inbox size={14} className="text-amber-500" />
                      <span className="text-sm font-bold text-amber-600">
                        問い合わせ待ち {inquiries.length}件
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 契約率 */}
            {selectedMetrics.has("contractRate") && (
              <div className="border border-gray-100 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  契約率
                </h3>
                <div className="flex items-center gap-8">
                  <DonutChart
                    value={contractRate}
                    max={100}
                    label="契約率"
                    unit="%"
                    color="#8b5cf6"
                  />
                  <div className="flex-1 space-y-3">
                    <HorizontalBar
                      value={contractedCount}
                      max={totalCustomers || 1}
                      label="契約済"
                      subLabel={`${contractedCount}件`}
                      color="bg-violet-500"
                      bgColor="bg-violet-100"
                    />
                    <HorizontalBar
                      value={totalCustomers - contractedCount}
                      max={totalCustomers || 1}
                      label="対応中 / 失注"
                      subLabel={`${totalCustomers - contractedCount}件`}
                      color="bg-gray-300"
                      bgColor="bg-gray-100"
                    />
                    <Link
                      href="/contracts/rate"
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium pt-1"
                    >
                      詳細を見る <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====== KPI 数値カード ====== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* 今月の売上 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">今月の売上</p>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Banknote size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(confirmedSales / 10000).toLocaleString()}
            <span className="text-sm font-normal text-gray-400 ml-1">万円</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            目標 {(monthlyTarget / 10000).toLocaleString()}万円
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">進捗率</span>
              <span className="font-semibold text-blue-600">{progressRate}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(progressRate, 100)}%` }}
              />
            </div>
          </div>
          <Link
            href="/settings/sales-target"
            className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Settings size={12} />
            目標を設定する
          </Link>
        </div>

        {/* 登録物件数 */}
        <Link
          href="/properties"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">登録物件数</p>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
              <Building2 size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totalProperties}
            <span className="text-sm font-normal text-gray-400 ml-1">件</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            問い合わせ待ち {inquiries.length}件
          </p>
        </Link>

        {/* 契約率 */}
        <Link
          href="/contracts/rate"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">契約率</p>
            <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {contractRate}
            <span className="text-sm font-normal text-gray-400 ml-1">%</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            契約済 {contractedCount}件
          </p>
        </Link>
      </div>

      {/* ====== 下段: タスク一覧 + クイックリンク ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 問い合わせ・未完了タスク */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Inbox size={18} className="text-gray-600" />
              <h2 className="font-semibold text-gray-800">
                新規問い合わせ・未完了タスク
              </h2>
              {staleCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                  <AlertTriangle size={10} />
                  {staleCount}件 要確認
                </span>
              )}
            </div>
            <Link
              href="/tasks"
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              全件表示 <ArrowRight size={12} />
            </Link>
          </div>
          {inquiries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              未完了の問い合わせタスクはありません
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {inquiries.slice(0, 10).map((item) => {
                const stale = isOverOneDay(item.createdAt);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-gray-50 transition-colors ${
                      stale
                        ? "border-red-200 bg-red-50/50"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${stale ? "text-red-800" : "text-gray-900"}`}
                        >
                          {item.customerName}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 shrink-0">
                          {customerSourceLabel[item.source]}
                        </span>
                        {stale && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white shrink-0">
                            <AlertTriangle size={9} />
                            要確認
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-0.5 truncate ${stale ? "text-red-600" : "text-gray-500"}`}
                      >
                        {item.taskTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${taskStatusColor[item.taskStatus] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {taskStatusLabel[item.taskStatus]}
                      </span>
                      <span
                        className={`text-[10px] ${stale ? "text-red-400 font-medium" : "text-gray-400"}`}
                      >
                        {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">
            クイックアクション
          </h2>
          <div className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 group transition-colors"
              >
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-gray-400">{link.icon}</span>
                  {link.label}
                </div>
                <ArrowRight
                  size={14}
                  className="text-gray-300 group-hover:text-gray-500"
                />
              </Link>
            ))}
          </div>

          {totalAlerts > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link
                href="/tasks"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 group hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
                  <Clock size={14} className="text-red-500" />
                  期限タスク確認
                </div>
                <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-medium">
                  {totalAlerts}
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
