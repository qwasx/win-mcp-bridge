import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "活世界 · 凡人修仙传 2D",
  description: "让 NPC 活起来：储物袋、功法、门派、家庭、仇恨与社交，人人有缘由。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#0b0c10] text-amber-50 antialiased">{children}</body>
    </html>
  );
}
