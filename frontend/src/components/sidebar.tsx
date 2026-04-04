"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/properties", label: "物件管理", icon: "🏠" },
  { href: "/customers", label: "顧客CRM", icon: "👥" },
  { href: "/tasks", label: "タスク管理", icon: "📋" },
  { href: "/followup", label: "追客自動化", icon: "🔄" },
  { href: "/properties/recommend", label: "物件提案", icon: "💡" },
  { href: "/applications", label: "申込管理", icon: "📝" },
  { href: "/contracts", label: "電子契約", icon: "📄" },
  { href: "/viewings", label: "内見予約", icon: "🗓" },
  { href: "/tenants", label: "入居者管理", icon: "🏡" },
  { href: "/rent", label: "家賃管理", icon: "💰" },
  { href: "/renewals", label: "契約更新", icon: "🔁" },
  { href: "/vacations", label: "退去管理", icon: "📦" },
  { href: "/properties/import", label: "物件取込", icon: "⬆" },
  { href: "/sale-properties", label: "売買物件", icon: "🏢" },
  { href: "/sale-cases", label: "売買案件", icon: "🤝" },
  { href: "/analytics", label: "来店分析", icon: "📈" },
  { href: "/visits", label: "来店記録", icon: "🚶" },
  { href: "/ai/comeback", label: "切り返しAI", icon: "🧠" },
  { href: "/settings/line", label: "LINE連携", icon: "💬" },
  { href: "/iimon", label: "iimon連携", icon: "🔗" },
  { href: "/suumo", label: "SUUMO自動投稿", icon: "📮" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-primary-900 text-white min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-primary-700">
        <h1 className="text-lg font-bold">不動産DX</h1>
        <p className="text-xs text-primary-300 mt-1">管理コンソール</p>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-primary-700 text-white font-medium"
                  : "text-primary-200 hover:bg-primary-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
