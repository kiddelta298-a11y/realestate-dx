"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import {
  fetchChatSessions,
  createChatSession,
  fetchChatMessages,
  sendAutoReply,
  fetchCustomers,
} from "@/lib/api";
import type { ChatSession, ChatMessage, Customer } from "@/types";
import { MessageSquare, Send, Bot, User, RefreshCw } from "lucide-react";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, cRes] = await Promise.all([fetchChatSessions(), fetchCustomers({ limit: 200 })]);
      setSessions(sRes.data);
      setCustomers(cRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetchChatMessages(sessionId);
      setMessages(res.data);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.id);
    }
  }, [activeSession, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSelectSession(session: ChatSession) {
    setActiveSession(session);
    setMessages([]);
  }

  async function handleSend() {
    if (!activeSession || !newMessage.trim() || sending) return;
    setSending(true);
    const msg = newMessage.trim();
    setNewMessage("");
    try {
      await sendAutoReply(activeSession.id, msg);
      await loadMessages(activeSession.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "送信に失敗しました");
      setNewMessage(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateSession() {
    if (!selectedCustomerId) return;
    try {
      const res = await createChatSession(selectedCustomerId);
      await loadSessions();
      setActiveSession(res.data);
      setShowNewSession(false);
      setSelectedCustomerId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "セッション作成に失敗しました");
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  }

  return (
    <div>
      <PageHeader
        title="チャット管理"
        description="顧客チャットとAI自動返信"
        actions={
          <button
            onClick={() => setShowNewSession(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + 新規セッション
          </button>
        }
      />

      {showNewSession && (
        <div className="bg-white rounded-lg shadow p-5 mb-4">
          <h3 className="font-bold text-gray-900 mb-3">新規チャットセッション</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">顧客</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選択してください</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreateSession}
              disabled={!selectedCustomerId}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              作成
            </button>
            <button
              onClick={() => setShowNewSession(false)}
              className="text-sm text-gray-500 hover:underline"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
        {/* Session list */}
        <div className="w-72 shrink-0 bg-white rounded-lg shadow overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">セッション一覧</span>
            <button onClick={loadSessions} className="text-gray-400 hover:text-gray-600">
              <RefreshCw size={14} />
            </button>
          </div>
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-400">読み込み中...</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">セッションなし</div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  activeSession?.id === s.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {s.customer?.name ?? "不明"}
                  </span>
                  {s.isAiActive && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                      AI
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {s.customer?.email ?? s.channel} · {formatDate(s.startedAt)}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col min-w-0">
          {activeSession ? (
            <>
              {/* Header */}
              <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {activeSession.customer?.name ?? "不明"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activeSession.customer?.email ?? ""} · {activeSession.channel}
                    {activeSession.isAiActive && (
                      <span className="ml-2 text-green-600">AI対応中</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-8">
                    メッセージがありません
                  </div>
                )}
                {messages.map((m) => {
                  const isCustomer = m.senderType === "customer";
                  const isAi = m.senderType === "ai";
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2 ${isCustomer ? "justify-start" : "justify-end"}`}
                    >
                      {isCustomer && (
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          <User size={13} className="text-gray-600" />
                        </div>
                      )}
                      <div className={`max-w-[70%] ${isCustomer ? "" : "items-end"} flex flex-col gap-0.5`}>
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                            isCustomer
                              ? "bg-gray-100 text-gray-900 rounded-tl-sm"
                              : isAi
                              ? "bg-blue-50 text-blue-900 border border-blue-200 rounded-tr-sm"
                              : "bg-blue-600 text-white rounded-tr-sm"
                          } ${m.isDraft ? "opacity-70 border-dashed" : ""}`}
                        >
                          {m.content}
                          {m.isDraft && (
                            <span className="ml-2 text-xs opacity-60">(下書き)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                          {isAi && <Bot size={10} />}
                          <span>{formatTime(m.createdAt)}</span>
                        </div>
                      </div>
                      {!isCustomer && (
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isAi ? "bg-blue-100" : "bg-green-100"
                          }`}
                        >
                          {isAi ? (
                            <Bot size={13} className="text-blue-600" />
                          ) : (
                            <User size={13} className="text-green-600" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-200 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="顧客メッセージを入力してAI返信を生成..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 text-sm"
                  >
                    <Send size={14} />
                    {sending ? "生成中..." : "送信"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  顧客メッセージを入力するとAIが自動返信を生成します
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-400">
              <MessageSquare size={40} className="text-gray-300" />
              <p className="text-sm">左からセッションを選択してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
