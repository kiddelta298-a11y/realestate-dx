"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { fetchCustomers, sendCustomerMessage } from "@/lib/api";
import type { Customer } from "@/types";
import { Send, Mail, MessageSquare, ArrowLeft } from "lucide-react";

type Channel = "email" | "line";

export default function CustomerMessagePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchCustomers({ limit: 200 });
        const found = res.data.find((c) => c.id === customerId);
        setCustomer(found ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  async function handleSend() {
    if (!body.trim()) return;
    try {
      setSending(true);
      setResult(null);
      const res = await sendCustomerMessage({
        customerId,
        channel,
        subject: channel === "email" ? subject : undefined,
        body: body.trim(),
      });
      setResult({ type: res.data.success ? "success" : "error", text: res.data.message });
      if (res.data.success) {
        setBody("");
        setSubject("");
      }
    } catch (e) {
      setResult({
        type: "error",
        text: e instanceof Error ? e.message : "送信に失敗しました",
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">顧客が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.push("/customers")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} /> 顧客一覧に戻る
      </button>

      <PageHeader
        title={`${customer.name} へメッセージ送信`}
        description={`${customer.email ?? "メール未登録"} / ${customer.phone ?? "電話未登録"}`}
      />

      {/* ツール選択 */}
      <div className="bg-white rounded-lg shadow p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          送信ツールを選択
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setChannel("email")}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
              channel === "email"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            <Mail size={18} />
            メール（Gmail等）
          </button>
          <button
            onClick={() => setChannel("line")}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
              channel === "line"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            <MessageSquare size={18} />
            公式LINE
          </button>
        </div>
      </div>

      {/* メッセージ入力 */}
      <div className="bg-white rounded-lg shadow p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          メッセージ作成
        </h3>

        {channel === "email" && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              件名
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="メールの件名を入力..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            本文
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              channel === "email"
                ? "メール本文を入力..."
                : "LINEメッセージを入力..."
            }
            rows={6}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {channel === "email"
              ? `送信先: ${customer.email ?? "メール未登録"}`
              : `送信先: ${customer.lineUserId ? "LINE連携済み" : "LINE未連携"}`}
          </p>
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {sending ? "送信中..." : "送信"}
          </button>
        </div>
      </div>

      {/* 送信結果 */}
      {result && (
        <div
          className={`rounded-lg p-4 ${
            result.type === "success"
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <p
            className={
              result.type === "success" ? "text-green-700" : "text-red-700"
            }
          >
            {result.text}
          </p>
        </div>
      )}
    </div>
  );
}
