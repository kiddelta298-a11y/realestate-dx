"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchLineAccount, saveLineAccount, testLineMessage } from "@/lib/api";
import type { LineAccount } from "@/types";

export default function LineSettingsPage() {
  const [account, setAccount] = useState<LineAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [channelId, setChannelId] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [channelAccessToken, setChannelAccessToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLineAccount();
      setAccount(res.data);
      if (res.data) {
        setChannelId(res.data.channelId);
        setChannelSecret(res.data.channelSecret);
        setChannelAccessToken(res.data.channelAccessToken);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!channelId.trim() || !channelSecret.trim() || !channelAccessToken.trim()) return;
    try {
      setSaving(true);
      setMessage(null);
      const res = await saveLineAccount({ channelId: channelId.trim(), channelSecret: channelSecret.trim(), channelAccessToken: channelAccessToken.trim() });
      setAccount(res.data);
      setMessage({ type: "success", text: "LINE連携設定を保存しました" });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    try {
      setTesting(true);
      setMessage(null);
      const res = await testLineMessage();
      setMessage({ type: res.data.success ? "success" : "error", text: res.data.message });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "送信に失敗しました" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">読み込み中...</p></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700">{error}</p><button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button></div>;

  const isConnected = account !== null;
  const canSave = channelId.trim() && channelSecret.trim() && channelAccessToken.trim();

  return (
    <div>
      <PageHeader title="LINE連携設定" description="LINE公式アカウントとの連携を管理" />

      {/* 接続状態 */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center gap-3">
          <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {isConnected ? "接続済み" : "未接続"}
          </span>
          {isConnected ? (
            <span className="text-sm text-gray-600">Channel ID: {account.channelId}</span>
          ) : (
            <span className="text-sm text-gray-500">LINE公式アカウントの設定を行ってください</span>
          )}
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`rounded-lg p-4 mb-6 ${message.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className={message.type === "success" ? "text-green-700" : "text-red-700"}>{message.text}</p>
        </div>
      )}

      {/* 設定フォーム */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">アカウント設定</h2>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
            <input type="text" value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="1234567890" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
            <div className="relative">
              <input type={showSecret ? "text" : "password"} value={channelSecret} onChange={(e) => setChannelSecret(e.target.value)} placeholder="チャネルシークレットを入力" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">{showSecret ? "隠す" : "表示"}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
            <div className="relative">
              <input type={showToken ? "text" : "password"} value={channelAccessToken} onChange={(e) => setChannelAccessToken(e.target.value)} placeholder="チャネルアクセストークンを入力" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">{showToken ? "隠す" : "表示"}</button>
            </div>
          </div>
          <button onClick={handleSave} disabled={!canSave || saving} className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {/* テストメッセージ */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">テストメッセージ</h2>
          <p className="text-sm text-gray-500 mb-4">接続確認のためテストメッセージを送信します</p>
          <button onClick={handleTest} disabled={testing} className="bg-green-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {testing ? "送信中..." : "テストメッセージ送信"}
          </button>
        </div>
      )}

      {/* 注意事項 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-2">設定手順</h3>
        <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
          <li>LINE Developers Console でMessaging APIチャネルを作成してください</li>
          <li>Webhook URL: <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/webhooks/line</code></li>
          <li>チャネルアクセストークン（長期）を使用してください</li>
        </ul>
      </div>
    </div>
  );
}
