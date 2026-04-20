"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardList,
  Repeat2,
  Lightbulb,
  FileText,
  ScrollText,
  CalendarDays,
  Home,
  Banknote,
  RefreshCw,
  Upload,
  TrendingUp,
  FootprintsIcon,
  BrainCircuit,
  MessageSquare,
  Link2,
  Send,
  LandPlot,
  Briefcase,
  ChevronDown,
  ChevronRight,
  X,
  Settings,
  LogOut,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "概要",
    items: [
      { href: "/", label: "ダッシュボード", icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    label: "管理物件",
    items: [
      { href: "/properties", label: "物件管理", icon: <Building2 size={16} /> },
      { href: "/customers", label: "顧客CRM", icon: <Users size={16} /> },
      { href: "/tasks", label: "タスク管理", icon: <ClipboardList size={16} /> },
      { href: "/followup", label: "追客自動化", icon: <Repeat2 size={16} /> },
      { href: "/properties/recommend", label: "物件提案", icon: <Lightbulb size={16} /> },
      { href: "/chat", label: "チャット対応", icon: <MessageSquare size={16} /> },
    ],
  },
  {
    label: "申込・契約",
    items: [
      { href: "/viewings", label: "内見予約", icon: <CalendarDays size={16} /> },
      { href: "/applications", label: "申込管理", icon: <FileText size={16} /> },
      { href: "/contracts", label: "電子契約", icon: <ScrollText size={16} /> },
    ],
  },
  {
    label: "賃貸管理",
    items: [
      { href: "/tenants", label: "入居者管理", icon: <Home size={16} /> },
      { href: "/rent", label: "家賃管理", icon: <Banknote size={16} /> },
      { href: "/renewals", label: "契約更新", icon: <RefreshCw size={16} /> },
      { href: "/vacations", label: "退去管理", icon: <LogOut size={16} /> },
    ],
  },
  {
    label: "売買",
    items: [
      { href: "/sale-properties", label: "売買物件", icon: <LandPlot size={16} /> },
      { href: "/sale-cases", label: "売買案件", icon: <Briefcase size={16} /> },
    ],
  },
  {
    label: "来店・分析",
    items: [
      { href: "/visits", label: "来店記録", icon: <FootprintsIcon size={16} /> },
      { href: "/analytics", label: "来店分析", icon: <TrendingUp size={16} /> },
      { href: "/ai/comeback", label: "切り返しAI", icon: <BrainCircuit size={16} /> },
    ],
  },
  {
    label: "連携ツール",
    items: [
      { href: "/properties/import", label: "物件取込", icon: <Upload size={16} /> },
      { href: "/posting", label: "媒体一括投稿", icon: <Send size={16} /> },
    ],
  },
];

// 設定は独立メニュー（グループ外）
const settingsItem: NavItem = {
  href: "/settings",
  label: "設定",
  icon: <Settings size={16} />,
};

function NavGroup({
  group,
  defaultOpen = true,
  onNavClick,
}: {
  group: NavGroup;
  defaultOpen?: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen);

  const hasActive = group.items.some((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
          hasActive ? "text-blue-300" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <span>{group.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="mt-0.5">
          {group.items.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={`flex items-center gap-2.5 px-4 py-2.5 mx-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-medium"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span className={isActive ? "text-white" : "text-slate-400"}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsLink({
  item,
  onNavClick,
}: {
  item: NavItem;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 mx-2 rounded-md text-sm transition-colors ${
        isActive
          ? "bg-blue-600 text-white font-medium"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
    >
      <span className={isActive ? "text-white" : "text-slate-400"}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar: always visible, static */}
      {/* Mobile sidebar: fixed overlay, controlled by isOpen */}
      <aside
        className={`
          bg-slate-800 text-white flex flex-col
          fixed inset-y-0 left-0 z-50 w-64
          transform transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0 lg:w-56 lg:z-auto lg:shrink-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="px-4 py-5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">不動産DX</h1>
              <p className="text-xs text-slate-400 leading-tight">管理コンソール</p>
            </div>
          </div>
          {/* Close button (mobile only) */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="メニューを閉じる"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navGroups.map((group, i) => (
            <NavGroup
              key={group.label}
              group={group}
              defaultOpen={i < 5}
              onNavClick={onClose}
            />
          ))}

          {/* 設定（独立メニュー） */}
          <div className="mt-2 pt-2 border-t border-slate-700">
            <SettingsLink item={settingsItem} onNavClick={onClose} />
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">v0.6.0</p>
        </div>
      </aside>
    </>
  );
}
