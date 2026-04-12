"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import {
  fetchFollowupSequences,
  createFollowupSequence,
  updateFollowupSequence,
  deleteFollowupSequence,
  addFollowupStep,
  deleteFollowupStep,
  fetchFollowupExecutions,
  retryFollowupExecution,
  executeFollowup,
} from "@/lib/api";
import type {
  FollowupSequence,
  FollowupExecution,
  TriggerEvent,
  StepChannel,
  ExecutionStatus,
} from "@/types";
import {
  triggerEventLabel,
  stepChannelLabel,
  executionStatusLabel,
} from "@/types";

type Tab = "sequences" | "history" | "pending";

const execStatusColor: Record<ExecutionStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function FollowupPage() {
  const [tab, setTab] = useState<Tab>("sequences");
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [executions, setExecutions] = useState<FollowupExecution[]>([]);
  const [pendingExecs, setPendingExecs] = useState<FollowupExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showSeqModal, setShowSeqModal] = useState(false);
  const [showStepModal, setShowStepModal] = useState<string | null>(null);
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null);

  // Sequence form
  const [seqName, setSeqName] = useState("");
  const [seqDesc, setSeqDesc] = useState("");
  const [seqTrigger, setSeqTrigger] = useState<TriggerEvent>("inquiry");

  // Step form
  const [stepDelay, setStepDelay] = useState(0);
  const [stepChannel, setStepChannel] = useState<StepChannel>("email");
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [seqRes, execRes, pendRes] = await Promise.all([
        fetchFollowupSequences(),
        fetchFollowupExecutions(),
        fetchFollowupExecutions({ status: "pending" }),
      ]);
      setSequences(seqRes.data);
      setExecutions(execRes.data);
      setPendingExecs(pendRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreateSeq() {
    if (!seqName.trim()) return;
    await createFollowupSequence({ name: seqName.trim(), description: seqDesc.trim() || undefined, triggerEvent: seqTrigger });
    setShowSeqModal(false);
    setSeqName(""); setSeqDesc(""); setSeqTrigger("inquiry");
    await loadData();
  }

  async function handleToggleActive(seq: FollowupSequence) {
    await updateFollowupSequence(seq.id, { isActive: !seq.isActive });
    await loadData();
  }

  async function handleDeleteSeq(id: string) {
    if (!confirm("このシーケンスを削除しますか？")) return;
    await deleteFollowupSequence(id);
    await loadData();
  }

  async function handleAddStep() {
    if (!showStepModal || !stepBody.trim()) return;
    const seq = sequences.find((s) => s.id === showStepModal);
    const nextOrder = seq ? Math.max(0, ...seq.steps.map((s) => s.stepOrder)) + 1 : 1;
    await addFollowupStep(showStepModal, {
      stepOrder: nextOrder,
      delayDays: stepDelay,
      channel: stepChannel,
      templateBody: stepBody.trim(),
      subject: stepChannel === "email" ? stepSubject.trim() || undefined : undefined,
    });
    setShowStepModal(null);
    setStepDelay(0); setStepChannel("email"); setStepSubject(""); setStepBody("");
    await loadData();
  }

  async function handleDeleteStep(seqId: string, stepId: string) {
    if (!confirm("このステップを削除しますか？")) return;
    await deleteFollowupStep(seqId, stepId);
    await loadData();
  }

  async function handleRetry(id: string) {
    await retryFollowupExecution(id);
    await loadData();
  }

  async function handleExecute(id: string) {
    await executeFollowup(id);
    await loadData();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={loadData} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "sequences", label: "シーケンス一覧", count: sequences.length },
    { key: "history", label: "実行履歴", count: executions.length },
    { key: "pending", label: "保留中", count: pendingExecs.length },
  ];

  return (
    <div>
      <PageHeader title="追客自動化" description="フォローアップシーケンスの管理" />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Sequences */}
      {tab === "sequences" && (
        <div>
          <div className="mb-4">
            <button onClick={() => setShowSeqModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ 新規シーケンス</button>
          </div>
          <div className="space-y-4">
            {sequences.map((seq) => (
              <div key={seq.id} className="bg-white rounded-lg shadow">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-gray-900">{seq.name}</h3>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{triggerEventLabel[seq.triggerEvent]}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${seq.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {seq.isActive ? "有効" : "無効"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleActive(seq)} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-2 py-1 rounded">
                        {seq.isActive ? "無効化" : "有効化"}
                      </button>
                      <button onClick={() => handleDeleteSeq(seq.id)} className="text-xs text-red-500 hover:text-red-700 border border-red-300 px-2 py-1 rounded">削除</button>
                    </div>
                  </div>
                  {seq.description && <p className="text-sm text-gray-500 mb-2">{seq.description}</p>}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{seq.steps.length}ステップ</span>
                    <button onClick={() => setExpandedSeq(expandedSeq === seq.id ? null : seq.id)} className="text-xs text-primary-600 hover:underline">
                      {expandedSeq === seq.id ? "閉じる" : "ステップ表示"}
                    </button>
                    <button onClick={() => { setShowStepModal(seq.id); setStepDelay(0); setStepChannel("email"); setStepSubject(""); setStepBody(""); }} className="text-xs text-blue-600 hover:underline">+ ステップ追加</button>
                  </div>
                </div>

                {/* Steps accordion */}
                {expandedSeq === seq.id && (
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                    {seq.steps.length === 0 && <p className="text-sm text-gray-400">ステップがありません</p>}
                    {seq.steps.map((step) => (
                      <div key={step.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">{step.stepOrder}</span>
                          <span className="text-gray-500">{step.delayDays}日後</span>
                          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">{stepChannelLabel[step.channel as keyof typeof stepChannelLabel] ?? step.channel}</span>
                          <span className="text-gray-700 truncate max-w-xs">{step.templateBody.slice(0, 50)}{step.templateBody.length > 50 ? "..." : ""}</span>
                        </div>
                        <button onClick={() => handleDeleteStep(seq.id, step.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sequences.length === 0 && <p className="text-center text-gray-400 py-8">シーケンスがありません</p>}
          </div>
        </div>
      )}

      {/* Tab: History */}
      {tab === "history" && (
        <div className="overflow-x-auto">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">顧客</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">シーケンス</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">チャネル</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">予定日時</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">実行日時</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {executions.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ex.customer?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{ex.sequence?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{stepChannelLabel[ex.channel as keyof typeof stepChannelLabel] ?? ex.channel}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${execStatusColor[ex.status as ExecutionStatus]}`}>
                      {executionStatusLabel[ex.status as ExecutionStatus] ?? ex.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs hidden sm:table-cell">{new Date(ex.scheduledAt).toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs hidden sm:table-cell">{ex.executedAt ? new Date(ex.executedAt).toLocaleString("ja-JP") : "-"}</td>
                  <td className="px-4 py-3 text-center">
                    {ex.status === "failed" && (
                      <button onClick={() => handleRetry(ex.id)} className="text-xs text-blue-600 hover:underline">再試行</button>
                    )}
                  </td>
                </tr>
              ))}
              {executions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">実行履歴がありません</td></tr>
              )}
            </tbody>
          </table>
          {/* Error messages for failed */}
          {executions.filter((e) => e.status === "failed" && e.errorMessage).map((ex) => (
            <div key={ex.id} className="px-4 py-2 bg-red-50 text-xs text-red-600 border-t border-red-100">
              {ex.customer?.name}: {ex.errorMessage}
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Tab: Pending */}
      {tab === "pending" && (
        <div>
          {pendingExecs.length === 0 ? (
            <p className="text-center text-gray-400 py-12">保留中のフォローアップはありません</p>
          ) : (
            <div className="space-y-3">
              {pendingExecs.map((ex) => (
                <div key={ex.id} className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{ex.customer?.name ?? "-"}</p>
                      <p className="text-xs text-gray-500">{ex.sequence?.name ?? "-"}</p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{stepChannelLabel[ex.channel as keyof typeof stepChannelLabel] ?? ex.channel}</span>
                    <span className="text-xs text-gray-500">予定: {new Date(ex.scheduledAt).toLocaleString("ja-JP")}</span>
                  </div>
                  <button onClick={() => handleExecute(ex.id)} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-green-700 font-medium">今すぐ実行</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: New Sequence */}
      {showSeqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">新規シーケンス作成</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">シーケンス名</label>
                <input type="text" value={seqName} onChange={(e) => setSeqName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="反響初期対応" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <input type="text" value={seqDesc} onChange={(e) => setSeqDesc(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="問い合わせ後の自動フォロー" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">トリガーイベント</label>
                <select value={seqTrigger} onChange={(e) => setSeqTrigger(e.target.value as TriggerEvent)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {(Object.entries(triggerEventLabel) as [TriggerEvent, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowSeqModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">キャンセル</button>
              <button onClick={handleCreateSeq} disabled={!seqName.trim()} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">作成</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Step */}
      {showStepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">ステップ追加</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">遅延日数</label>
                <input type="number" value={stepDelay} onChange={(e) => setStepDelay(Number(e.target.value))} min={0} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">チャネル</label>
                <select value={stepChannel} onChange={(e) => setStepChannel(e.target.value as StepChannel)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {(Object.entries(stepChannelLabel) as [StepChannel, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {stepChannel === "email" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
                  <input type="text" value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="お問い合わせありがとうございます" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート本文</label>
                <textarea value={stepBody} onChange={(e) => setStepBody(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="メッセージ本文を入力..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowStepModal(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">キャンセル</button>
              <button onClick={handleAddStep} disabled={!stepBody.trim()} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">追加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
