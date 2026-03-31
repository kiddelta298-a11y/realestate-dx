import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "不動産DX Platform",
  description: "不動産管理・仲介プラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
