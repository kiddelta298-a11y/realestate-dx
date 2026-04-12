"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  fetchSalesTargets,
  saveSalesTargets,
  fetchStaffMembers,
} from "@/lib/api";
import type { StaffMember } from "@/types";
import { ArrowLeft, Plus, Trash2, Settings } from "lucide-react";

export default function SalesTargetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [companyTarget, setCompanyTarget] = useState(300);
  const [agentTargets, setAgentTargets] = useState<
    { userId: string; name: string; target: number }[]
  >([]);

  // 設定で登録済みの担当者リスト
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [targetsRes, staffRes] = await Promise.all([
        fetchSalesTargets(),
        fetchStaffMembers(),
      ]);

      setCompanyTarget(targetsRes.data.companyTarget / 10000);
      setAgentTargets(
        targetsRes.data.agentTargets.map((a) => ({
          ...a,
          target: a.target / 10000,
        }))
      );
      setStaffList(staffRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);
      await saveSalesTargets({
        companyTarget: companyTarget * 10000,
        agentTargets: agentTargets.map((a) => ({
          ...a,
          target: a.target * 10000,
        })),
      });
      setMessage("目標を保存しました");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function addAgent() {
    const existing = new Set(agentTargets.map((a) => a.userId));
    const available = staffList.find((s) => !existing.has(s.id));
    if (available) {
      setAgentTargets((prev) => [
        ...prev,
        { userId: available.id, name: available.name, target: 0 },
      ]);
    }
  }

  function removeAgent(userId: string) {
    setAgentTargets((prev) => prev.filter((a) => a.userId !== userId));
  }

  function updateAgentTarget(userId: string, target: number) {
    setAgentTargets((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, target } : a))
    );
  }

  function updateAgentUser(
    oldUserId: string,
    newUserId: string,
    newName: string
  ) {
    setAgentTargets((prev) =>
      prev.map((a) =>
        a.userId === oldUserId
          ? { ...a, userId: newUserId, name: newName }
          : a
      )
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const usedIds = new Set(agentTargets.map((a) => a.userId));
  const canAddAgent = staffList.some((s) => !usedIds.has(s.id));
  const noStaffRegistered = staffList.length === 0;

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} /> ダッシュボードに戻る
      </button>

      <PageHeader
        title="売上目標設定"
        description="今月の売上目標を会社全体・担当者別に設定します"
      />

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}

      {/* 会社全体目標 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          会社全体の目標
        </h2>
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              今月の目標売上
            </label>
            <div className="relative">
              <input
                type="number"
                value={companyTarget}
                onChange={(e) =>
                  setCompanyTarget(Math.max(0, Number(e.target.value)))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={0}
                step={10}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                万円
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 担当者別目標 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">担当者別の目標</h2>
          {canAddAgent && (
            <button
              onClick={addAgent}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus size={14} /> 担当者を追加
            </button>
          )}
        </div>

        {/* 担当者が未登録の場合の案内 */}
        {noStaffRegistered && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-800 mb-2">
              担当者がまだ登録されていません。設定画面で担当者を登録すると、ここでプルダウンから選択できるようになります。
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-sm text-amber-700 font-medium hover:text-amber-900"
            >
              <Settings size={14} />
              設定画面で担当者を登録する
            </Link>
          </div>
        )}

        {agentTargets.length === 0 && !noStaffRegistered ? (
          <p className="text-sm text-gray-400 text-center py-4">
            担当者別の目標はまだ設定されていません
          </p>
        ) : (
          <div className="space-y-3">
            {agentTargets.map((agent) => (
              <div
                key={agent.userId}
                className="flex items-center gap-3 border border-gray-200 rounded-lg p-3"
              >
                {/* 担当者選択（設定で登録済みのスタッフのみ表示） */}
                <select
                  value={agent.userId}
                  onChange={(e) => {
                    const staff = staffList.find(
                      (s) => s.id === e.target.value
                    );
                    if (staff)
                      updateAgentUser(agent.userId, staff.id, staff.name);
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                >
                  {staffList.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={usedIds.has(s.id) && s.id !== agent.userId}
                    >
                      {s.name}
                    </option>
                  ))}
                </select>

                {/* 目標金額 */}
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={agent.target}
                    onChange={(e) =>
                      updateAgentTarget(
                        agent.userId,
                        Math.max(0, Number(e.target.value))
                      )
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                    step={10}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    万円
                  </span>
                </div>

                {/* 削除 */}
                <button
                  onClick={() => removeAgent(agent.userId)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存"}
      </button>
    </div>
  );
}
