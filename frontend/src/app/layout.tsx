import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "不動産DX Platform",
  description: "不動産管理・仲介プラットフォーム",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
