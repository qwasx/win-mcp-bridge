import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: '活世界 · 凡人修仙传',
  description: '一人一念，一世因果。基于凡人修仙传 v0.42 源码的自主 NPC 世界：储物、功法、门派、亲缘、社交与仇恨。',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
