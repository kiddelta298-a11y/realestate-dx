"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import {
  fetchSenderSettings,
  saveSenderSettings,
  fetchExternalServices,
  saveExternalService,
  deleteExternalService,
  fetchStaffMembers,
  saveStaffMember,
  deleteStaffMember,
  updateStaffPermission,
  sendInvitation,
  fetchLineAccount,
  saveLineAccount,
  testLineMessage,
} from "@/lib/api";
import type {
  SenderSettings,
  ExternalServiceSettings,
  StaffMember,
  PermissionLevel,
  LineAccount,
} from "@/types";
import { permissionLabel } from "@/types";
import {
  Trash2,
  Plus,
  Users,
  Mail,
  Shield,
  ChevronDown,
  Check,
  MessageSquare,
  Link2,
  Sheet,
  RefreshCw,
} from "lucide-react";

const allPermissions: PermissionLevel[] = [
  "admin",
  "manager",
  "member",
  "viewer",
];

const permissionColor: Record<PermissionLevel, string> = {
  admin: "bg-red-100 text-red-700",
  manager: "bg-amber-100 text-amber-700",
  member: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-600",
};

const statusLabel: Record<string, { text: string; color: string }> = {
  active: { text: "有効", color: "bg-green-100 text-green-700" },
  invited: { text: "招待中", color: "bg-yellow-100 text-yellow-700" },
  disabled: { text: "無効", color: "bg-gray-100 text-gray-500" },
};

const defaultSender: SenderSettings = {
  companyName: "",
  emailAddress: "",
  emailPassword: "",
  emailSmtpHost: "smtp.gmail.com",
  emailSmtpPort: 587,
  lineChannelId: "",
  lineChannelSecret: "",
  lineAccessToken: "",
};

const defaultService: ExternalServiceSettings = {
  serviceName: "",
  loginId: "",
  loginPassword: "",
  apiKey: "",
  notes: "",
};

// --- タブ定義 ---
type SettingsTab = "users" | "sender" | "external" | "line" | "iimon" | "spreadsheet";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("users");

  const [sender, setSender] = useState<SenderSettings>(defaultSender);
  const [services, setServices] = useState<ExternalServiceSettings[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [senderMsg, setSenderMsg] = useState<string | null>(null);
  const [serviceMsg, setServiceMsg] = useState<string | null>(null);
  const [staffMsg, setStaffMsg] = useState<string | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [newService, setNewService] =
    useState<ExternalServiceSettings>(defaultService);
  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    role: "営業",
    permission: "member" as PermissionLevel,
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] =
    useState<PermissionLevel>("member");
  // LINE連携
  const [lineAccount, setLineAccount] = useState<LineAccount | null>(null);
  const [lineChannelId, setLineChannelId] = useState("");
  const [lineChannelSecret, setLineChannelSecret] = useState("");
  const [lineAccessToken, setLineAccessToken] = useState("");
  const [lineMsg, setLineMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineTesting, setLineTesting] = useState(false);

  // iimon連携
  const [iimonEmail, setIimonEmail] = useState("");
  const [iimonPassword, setIimonPassword] = useState("");

  // スプレッドシート連携
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetStatus, setSheetStatus] = useState<"disconnected" | "connected" | "checking">("disconnected");
  const [sheetSummary, setSheetSummary] = useState<Record<string, number> | null>(null);
  const [sheetMsg, setSheetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [iimonMsg, setIimonMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {}
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [senderRes, servicesRes, staffRes, lineRes] = await Promise.all([
        fetchSenderSettings(),
        fetchExternalServices(),
        fetchStaffMembers(),
        fetchLineAccount().catch(() => ({ data: null })),
      ]);
      if (senderRes.data) setSender(senderRes.data);
      setServices(servicesRes.data);
      setStaffList(staffRes.data);
      if (lineRes.data) {
        setLineAccount(lineRes.data);
        setLineChannelId(lineRes.data.channelId);
        setLineChannelSecret(lineRes.data.channelSecret);
        setLineAccessToken(lineRes.data.channelAccessToken);
      }
      // spreadsheet URL from localStorage
      const savedSheetUrl = localStorage.getItem("dx_sheet_url");
      if (savedSheetUrl) setSheetUrl(savedSheetUrl);

      // iimon credentials from localStorage
      const iimonCreds = localStorage.getItem("dx_iimon_creds");
      if (iimonCreds) {
        const parsed = JSON.parse(iimonCreds);
        setIimonEmail(parsed.email ?? "");
        setIimonPassword(parsed.password ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- 送り元 ---
  async function handleSaveSender() {
    try {
      await saveSenderSettings(sender);
      setSenderMsg("送り元情報を保存しました");
      setTimeout(() => setSenderMsg(null), 3000);
    } catch {
      setSenderMsg("保存に失敗しました");
    }
  }

  // --- 外部連携 ---
  async function handleSaveService() {
    if (!newService.serviceName.trim()) return;
    try {
      const res = await saveExternalService(newService);
      setServices((prev) => {
        const idx = prev.findIndex((s) => s.id === res.data.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = res.data;
          return updated;
        }
        return [...prev, res.data];
      });
      setNewService(defaultService);
      setShowAddService(false);
      setServiceMsg("連携情報を保存しました");
      setTimeout(() => setServiceMsg(null), 3000);
    } catch {
      setServiceMsg("保存に失敗しました");
    }
  }

  async function handleDeleteService(id: string) {
    await deleteExternalService(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  // --- スタッフ直接追加 ---
  async function handleSaveStaff() {
    if (!newStaff.name.trim()) return;
    try {
      const res = await saveStaffMember({
        ...newStaff,
        permission: newStaff.permission,
        status: "active",
      });
      setStaffList((prev) => [...prev, res.data]);
      setNewStaff({
        name: "",
        email: "",
        role: "営業",
        permission: "member",
      });
      setShowAddStaff(false);
      setStaffMsg("担当者を登録しました");
      setTimeout(() => setStaffMsg(null), 3000);
    } catch {
      setStaffMsg("登録に失敗しました");
    }
  }

  async function handleDeleteStaff(id: string) {
    await deleteStaffMember(id);
    setStaffList((prev) => prev.filter((s) => s.id !== id));
  }

  async function handlePermissionChange(id: string, perm: PermissionLevel) {
    try {
      const res = await updateStaffPermission(id, perm);
      setStaffList((prev) =>
        prev.map((s) => (s.id === id ? res.data : s))
      );
    } catch {
      // ignore
    }
  }

  // --- 招待 ---
  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      setInviting(true);
      setInviteResult(null);
      const res = await sendInvitation(inviteEmail.trim(), invitePermission);
      const inviteUrl = `${window.location.origin}/invite/${res.data.token}`;
      setInviteResult({
        type: "success",
        text: `招待メールを送信しました（招待URL: ${inviteUrl}）`,
      });
      setInviteEmail("");
      // スタッフ一覧を再取得
      const staffRes = await fetchStaffMembers();
      setStaffList(staffRes.data);
    } catch (e) {
      setInviteResult({
        type: "error",
        text: e instanceof Error ? e.message : "招待に失敗しました",
      });
    } finally {
      setInviting(false);
    }
  }

  // --- LINE連携 ---
  async function handleSaveLine() {
    if (!lineChannelId.trim() || !lineChannelSecret.trim() || !lineAccessToken.trim()) return;
    try {
      setLineSaving(true);
      setLineMsg(null);
      const res = await saveLineAccount({
        channelId: lineChannelId.trim(),
        channelSecret: lineChannelSecret.trim(),
        channelAccessToken: lineAccessToken.trim(),
      });
      setLineAccount(res.data);
      setLineMsg({ type: "success", text: "LINE連携設定を保存しました" });
      setTimeout(() => setLineMsg(null), 3000);
    } catch {
      setLineMsg({ type: "error", text: "保存に失敗しました" });
    } finally {
      setLineSaving(false);
    }
  }

  async function handleTestLine() {
    try {
      setLineTesting(true);
      setLineMsg(null);
      await testLineMessage();
      setLineMsg({ type: "success", text: "テストメッセージを送信しました" });
      setTimeout(() => setLineMsg(null), 3000);
    } catch {
      setLineMsg({ type: "error", text: "テスト送信に失敗しました" });
    } finally {
      setLineTesting(false);
    }
  }

  // --- iimon連携 ---
  function handleSaveIimon() {
    localStorage.setItem("dx_iimon_creds", JSON.stringify({ email: iimonEmail, password: iimonPassword }));
    setIimonMsg({ type: "success", text: "iimon認証情報を保存しました" });
    setTimeout(() => setIimonMsg(null), 3000);
  }

  // --- スプレッドシート連携 ---
  async function handleCheckSheet() {
    if (!sheetUrl.trim()) return;
    try {
      setSheetStatus("checking");
      setSheetMsg(null);
      const url = sheetUrl.trim().replace(/\/$/, "");
      const res = await fetch(`${url}?action=ping`);
      const data = await res.json();
      if (data.status === "ok") {
        setSheetStatus("connected");
        localStorage.setItem("dx_sheet_url", url);
        // サマリー取得
        const summaryRes = await fetch(`${url}?action=summary`);
        const summaryData = await summaryRes.json();
        setSheetSummary(summaryData);
        setSheetMsg({ type: "success", text: "スプレッドシートに接続しました" });
      } else {
        setSheetStatus("disconnected");
        setSheetMsg({ type: "error", text: "接続に失敗しました" });
      }
    } catch {
      setSheetStatus("disconnected");
      setSheetMsg({ type: "error", text: "接続に失敗しました。URLが正しいか確認してください。" });
    }
  }

  async function handleSyncToSheet() {
    if (!sheetUrl.trim()) return;
    try {
      setSyncing(true);
      setSheetMsg(null);
      const url = sheetUrl.trim().replace(/\/$/, "");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          direction: "Platform → Sheet",
          target: "全データ",
          operation: "手動同期",
          count: 0,
          status: "開始",
          detail: "設定画面から手動同期を開始",
        }),
      });
      const data = await res.json();
      if (data.logged) {
        setSheetMsg({ type: "success", text: "同期リクエストを送信しました" });
      }
      setTimeout(() => setSheetMsg(null), 3000);
    } catch {
      setSheetMsg({ type: "error", text: "同期に失敗しました" });
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnectSheet() {
    localStorage.removeItem("dx_sheet_url");
    setSheetUrl("");
    setSheetStatus("disconnected");
    setSheetSummary(null);
    setSheetMsg(null);
  }

  function togglePassword(key: string) {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: "users", label: "ユーザー管理", icon: <Users size={14} /> },
    { key: "sender", label: "送り元情報", icon: <Mail size={14} /> },
    { key: "external", label: "外部連携", icon: <Shield size={14} /> },
    { key: "line", label: "LINE連携", icon: <MessageSquare size={14} /> },
    { key: "iimon", label: "iimon連携", icon: <Link2 size={14} /> },
    { key: "spreadsheet", label: "スプレッドシート", icon: <Sheet size={14} /> },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader title="設定" description="ユーザー・送り元情報・外部連携を一括管理" />

      {/* タブ */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== ユーザー管理タブ ====== */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* 招待 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-gray-600" />
                <h2 className="text-lg font-bold text-gray-900">招待</h2>
              </div>
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                <Plus size={14} /> 招待する
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              メールアドレスを入力して管理画面への招待を送信します。招待された担当者はリンクからパスワードを設定してログインできます。
            </p>

            {showInvite && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="yamada@example.com"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      権限レベル
                    </label>
                    <select
                      value={invitePermission}
                      onChange={(e) =>
                        setInvitePermission(e.target.value as PermissionLevel)
                      }
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {allPermissions.map((p) => (
                        <option key={p} value={p}>
                          {permissionLabel[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || inviting}
                      className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Mail size={14} />
                      {inviting ? "送信中..." : "招待メールを送信"}
                    </button>
                    <button
                      onClick={() => {
                        setShowInvite(false);
                        setInviteEmail("");
                        setInviteResult(null);
                      }}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}

            {inviteResult && (
              <div
                className={`rounded-lg p-3 ${
                  inviteResult.type === "success"
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <p
                  className={`text-sm ${inviteResult.type === "success" ? "text-green-700" : "text-red-700"}`}
                >
                  {inviteResult.text}
                </p>
              </div>
            )}
          </div>

          {/* ユーザー一覧 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-gray-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  ユーザー管理
                </h2>
              </div>
              <button
                onClick={() => setShowAddStaff(true)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus size={14} /> 直接追加
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              担当者の権限レベルを管理します。管理者（全権限）のみ他のユーザーの権限を変更できます。
            </p>

            {staffMsg && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-700">{staffMsg}</p>
              </div>
            )}

            {staffList.length > 0 ? (
              <div className="space-y-2 mb-4">
                {staffList.map((s) => {
                  const st = statusLabel[s.status] ?? statusLabel.active;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between border rounded-lg px-4 py-3 ${
                        s.status === "invited"
                          ? "border-yellow-200 bg-yellow-50/30"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {s.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {s.name}
                            </p>
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${st.color}`}
                            >
                              {st.text}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {s.email || "メール未設定"} / {s.role}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {/* 権限セレクタ */}
                        <div className="relative">
                          <select
                            value={s.permission ?? "member"}
                            onChange={(e) =>
                              handlePermissionChange(
                                s.id,
                                e.target.value as PermissionLevel
                              )
                            }
                            className={`appearance-none border rounded-md pl-2 pr-7 py-1 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${permissionColor[s.permission ?? "member"]}`}
                          >
                            {allPermissions.map((p) => (
                              <option key={p} value={p}>
                                {permissionLabel[p]}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={10}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteStaff(s.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4 mb-4">
                ユーザーが登録されていません。「招待する」または「直接追加」から追加してください。
              </p>
            )}

            {/* 直接追加フォーム */}
            {showAddStaff && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  ユーザー直接追加
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        氏名
                      </label>
                      <input
                        type="text"
                        value={newStaff.name}
                        onChange={(e) =>
                          setNewStaff({ ...newStaff, name: e.target.value })
                        }
                        placeholder="山田 太郎"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        メールアドレス
                      </label>
                      <input
                        type="email"
                        value={newStaff.email}
                        onChange={(e) =>
                          setNewStaff({ ...newStaff, email: e.target.value })
                        }
                        placeholder="yamada@example.com"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        役職
                      </label>
                      <select
                        value={newStaff.role}
                        onChange={(e) =>
                          setNewStaff({ ...newStaff, role: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="営業">営業</option>
                        <option value="営業マネージャー">
                          営業マネージャー
                        </option>
                        <option value="管理">管理</option>
                        <option value="その他">その他</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        権限レベル
                      </label>
                      <select
                        value={newStaff.permission}
                        onChange={(e) =>
                          setNewStaff({
                            ...newStaff,
                            permission: e.target.value as PermissionLevel,
                          })
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {allPermissions.map((p) => (
                          <option key={p} value={p}>
                            {permissionLabel[p]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveStaff}
                      disabled={!newStaff.name.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      登録
                    </button>
                    <button
                      onClick={() => setShowAddStaff(false)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== 送り元情報タブ ====== */}
      {activeTab === "sender" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            送り元情報（メール・LINE）
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            ここで設定したメールアドレスは、招待メール・顧客へのメール送信の送信元として使用されます。
          </p>

          {senderMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">{senderMsg}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会社名
              </label>
              <input
                type="text"
                value={sender.companyName}
                onChange={(e) =>
                  setSender({ ...sender, companyName: e.target.value })
                }
                placeholder="株式会社〇〇不動産"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                メール設定
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={sender.emailAddress}
                    onChange={(e) =>
                      setSender({ ...sender, emailAddress: e.target.value })
                    }
                    placeholder="info@example.com"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    メールパスワード
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords["emailPw"] ? "text" : "password"}
                      value={sender.emailPassword}
                      onChange={(e) =>
                        setSender({ ...sender, emailPassword: e.target.value })
                      }
                      placeholder="アプリパスワード"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("emailPw")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords["emailPw"] ? "隠す" : "表示"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    SMTPホスト
                  </label>
                  <input
                    type="text"
                    value={sender.emailSmtpHost}
                    onChange={(e) =>
                      setSender({ ...sender, emailSmtpHost: e.target.value })
                    }
                    placeholder="smtp.gmail.com"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    SMTPポート
                  </label>
                  <input
                    type="number"
                    value={sender.emailSmtpPort}
                    onChange={(e) =>
                      setSender({
                        ...sender,
                        emailSmtpPort: Number(e.target.value),
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                LINE公式アカウント設定
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Channel ID
                  </label>
                  <input
                    type="text"
                    value={sender.lineChannelId}
                    onChange={(e) =>
                      setSender({ ...sender, lineChannelId: e.target.value })
                    }
                    placeholder="1234567890"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Channel Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords["lineSec"] ? "text" : "password"}
                      value={sender.lineChannelSecret}
                      onChange={(e) =>
                        setSender({
                          ...sender,
                          lineChannelSecret: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("lineSec")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords["lineSec"] ? "隠す" : "表示"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Channel Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords["lineToken"] ? "text" : "password"}
                      value={sender.lineAccessToken}
                      onChange={(e) =>
                        setSender({
                          ...sender,
                          lineAccessToken: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("lineToken")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords["lineToken"] ? "隠す" : "表示"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSender}
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* ====== 外部連携タブ ====== */}
      {activeTab === "external" && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              外部連携サービス管理
            </h2>
            <button
              onClick={() => setShowAddService(true)}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={14} /> 追加
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            SUUMO、いい生活など外部サービスの登録情報・ログイン情報を管理します
          </p>

          {serviceMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">{serviceMsg}</p>
            </div>
          )}

          {services.length > 0 ? (
            <div className="space-y-3 mb-4">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">
                      {s.serviceName}
                    </h3>
                    <button
                      onClick={() => s.id && handleDeleteService(s.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">ログインID:</span>{" "}
                      <span className="text-gray-700">{s.loginId || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">パスワード:</span>{" "}
                      <span className="text-gray-700">
                        {s.loginPassword ? "********" : "-"}
                      </span>
                    </div>
                    {s.apiKey && (
                      <div className="col-span-2">
                        <span className="text-gray-500">APIキー:</span>{" "}
                        <span className="text-gray-700">
                          {s.apiKey.slice(0, 8)}...
                        </span>
                      </div>
                    )}
                    {s.notes && (
                      <div className="col-span-2">
                        <span className="text-gray-500">備考:</span>{" "}
                        <span className="text-gray-700">{s.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4 mb-4">
              外部連携サービスが登録されていません
            </p>
          )}

          {showAddService && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                サービス追加
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    サービス名
                  </label>
                  <input
                    type="text"
                    value={newService.serviceName}
                    onChange={(e) =>
                      setNewService({
                        ...newService,
                        serviceName: e.target.value,
                      })
                    }
                    placeholder="SUUMO / いい生活 / HOME'S など"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      ログインID
                    </label>
                    <input
                      type="text"
                      value={newService.loginId}
                      onChange={(e) =>
                        setNewService({
                          ...newService,
                          loginId: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      パスワード
                    </label>
                    <input
                      type="password"
                      value={newService.loginPassword}
                      onChange={(e) =>
                        setNewService({
                          ...newService,
                          loginPassword: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    APIキー（任意）
                  </label>
                  <input
                    type="text"
                    value={newService.apiKey}
                    onChange={(e) =>
                      setNewService({ ...newService, apiKey: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    備考
                  </label>
                  <input
                    type="text"
                    value={newService.notes}
                    onChange={(e) =>
                      setNewService({ ...newService, notes: e.target.value })
                    }
                    placeholder="管理者アカウント、API連携用など"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveService}
                    disabled={!newService.serviceName.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setShowAddService(false);
                      setNewService(defaultService);
                    }}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ====== LINE連携タブ ====== */}
      {activeTab === "line" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">LINE公式アカウント連携</h2>
          <p className="text-sm text-gray-500 mb-4">
            LINE Messaging APIの認証情報を設定します。顧客へのLINEメッセージ送信に使用されます。
          </p>

          {lineMsg && (
            <div className={`rounded-lg p-3 mb-4 ${lineMsg.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`text-sm ${lineMsg.type === "success" ? "text-green-700" : "text-red-700"}`}>{lineMsg.text}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
              <input
                type="text"
                value={lineChannelId}
                onChange={(e) => setLineChannelId(e.target.value)}
                placeholder="1234567890"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
              <div className="relative">
                <input
                  type={showPasswords["lineSecret2"] ? "text" : "password"}
                  value={lineChannelSecret}
                  onChange={(e) => setLineChannelSecret(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => togglePassword("lineSecret2")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showPasswords["lineSecret2"] ? "隠す" : "表示"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
              <div className="relative">
                <input
                  type={showPasswords["lineToken2"] ? "text" : "password"}
                  value={lineAccessToken}
                  onChange={(e) => setLineAccessToken(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => togglePassword("lineToken2")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showPasswords["lineToken2"] ? "隠す" : "表示"}
                </button>
              </div>
            </div>

            {lineAccount && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-600">
                  連携状態: <span className="font-medium text-green-700">接続済み</span>
                  {lineAccount.webhookActive && <> / Webhook: <span className="font-medium text-green-700">有効</span></>}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveLine}
                disabled={lineSaving || !lineChannelId.trim() || !lineChannelSecret.trim() || !lineAccessToken.trim()}
                className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {lineSaving ? "保存中..." : "保存"}
              </button>
              {lineAccount && (
                <button
                  onClick={handleTestLine}
                  disabled={lineTesting}
                  className="bg-green-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {lineTesting ? "送信中..." : "テスト送信"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== iimon連携タブ ====== */}
      {activeTab === "iimon" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">iimon連携設定</h2>
            <p className="text-sm text-gray-500 mb-4">
              いい物件速いもん（iimon）の認証情報を設定します。物件情報の自動取込に使用されます。
            </p>

            {iimonMsg && (
              <div className={`rounded-lg p-3 mb-4 ${iimonMsg.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <p className={`text-sm ${iimonMsg.type === "success" ? "text-green-700" : "text-red-700"}`}>{iimonMsg.text}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">iimonメールアドレス</label>
                <input
                  type="email"
                  value={iimonEmail}
                  onChange={(e) => setIimonEmail(e.target.value)}
                  placeholder="your-account@example.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">iimonパスワード</label>
                <div className="relative">
                  <input
                    type={showPasswords["iimonPw"] ? "text" : "password"}
                    value={iimonPassword}
                    onChange={(e) => setIimonPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => togglePassword("iimonPw")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                    {showPasswords["iimonPw"] ? "隠す" : "表示"}
                  </button>
                </div>
              </div>
              <button
                onClick={handleSaveIimon}
                disabled={!iimonEmail.trim() || !iimonPassword.trim()}
                className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>

          {/* 連携の仕組み */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">連携の仕組み</h3>
            <div className="flex items-start gap-8 text-sm text-gray-600">
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">🏠</div>
                <p className="font-medium text-gray-800 text-xs">iimon</p>
                <p className="text-xs text-center">新着物件・空室状況</p>
              </div>
              <div className="flex items-center mt-4 text-gray-300 text-xl">→</div>
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg">🤖</div>
                <p className="font-medium text-gray-800 text-xs">自動抽出</p>
                <p className="text-xs text-center">毎日自動取得・差分更新</p>
              </div>
              <div className="flex items-center mt-4 text-gray-300 text-xl">→</div>
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">📊</div>
                <p className="font-medium text-gray-800 text-xs">不動産DX</p>
                <p className="text-xs text-center">物件DBに自動登録</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ====== スプレッドシート連携タブ ====== */}
      {activeTab === "spreadsheet" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Google スプレッドシート連携</h2>
            <p className="text-sm text-gray-500 mb-4">
              Google Apps ScriptのデプロイURLを登録すると、不動産DXプラットフォームのデータをスプレッドシートと同期できます。
            </p>

            {sheetMsg && (
              <div className={`rounded-lg p-3 mb-4 ${sheetMsg.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <p className={`text-sm ${sheetMsg.type === "success" ? "text-green-700" : "text-red-700"}`}>{sheetMsg.text}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apps Script デプロイURL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/xxxxx/exec"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={sheetStatus === "connected"}
                  />
                  {sheetStatus === "connected" ? (
                    <button
                      onClick={handleDisconnectSheet}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                    >
                      解除
                    </button>
                  ) : (
                    <button
                      onClick={handleCheckSheet}
                      disabled={!sheetUrl.trim() || sheetStatus === "checking"}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sheetStatus === "checking" ? "確認中..." : "接続テスト"}
                    </button>
                  )}
                </div>
              </div>

              {/* 接続状態 */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                sheetStatus === "connected"
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-50 text-gray-500"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  sheetStatus === "connected" ? "bg-green-500" : "bg-gray-300"
                }`} />
                {sheetStatus === "connected" ? "接続中" : "未接続"}
              </div>

              {/* サマリー */}
              {sheetSummary && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">スプレッドシートデータ</h3>
                    <button
                      onClick={handleSyncToSheet}
                      disabled={syncing}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                      {syncing ? "同期中..." : "手動同期"}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "物件", value: sheetSummary.properties },
                      { label: "顧客", value: sheetSummary.customers },
                      { label: "申込", value: sheetSummary.applications },
                      { label: "タスク", value: sheetSummary.tasks },
                      { label: "入居者", value: sheetSummary.tenants },
                      { label: "契約", value: sheetSummary.contracts },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-md p-2 text-center">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-lg font-bold text-gray-900">{item.value ?? 0}</p>
                      </div>
                    ))}
                  </div>
                  {sheetSummary.monthlySales !== undefined && (
                    <div className="mt-3 bg-blue-50 rounded-md p-2 text-center">
                      <p className="text-xs text-blue-600">今月の売上合計</p>
                      <p className="text-lg font-bold text-blue-900">
                        {(sheetSummary.monthlySales / 10000).toLocaleString()}万円
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* セットアップガイド */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">セットアップ手順</h3>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>対象のGoogleスプレッドシートを開き、「拡張機能」→「Apps Script」を選択</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>提供されたスクリプトコードを貼り付けて保存</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>「▶ 実行」で <code className="bg-gray-100 px-1 rounded">setupSheets</code> を実行し、シート構造を初期化</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>「デプロイ」→「新しいデプロイ」→ 種類: ウェブアプリ、アクセス: 全員 で公開</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                <span>表示されたデプロイURLを上の入力欄に貼り付けて「接続テスト」をクリック</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
