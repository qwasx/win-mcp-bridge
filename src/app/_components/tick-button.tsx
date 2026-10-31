"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function TickButton({ day }: { day: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = (days: number) => {
    setBusy(true);
    setMsg(`这边的日子正往前过（${days} 日）……`);
    fetch("/api/world/tick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ days }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; added?: { text: string }[]; day?: number }) => {
        const fresh = (j.added ?? []).filter((a) => a.text).slice(-3).map((a) => a.text).join("／");
        setMsg(`已过 ${days} 日，如今是第 ${j.day} 日。${fresh ? `新事：${fresh}` : "这几日风平浪静。"}`);
        start(() => router.refresh());
      })
      .catch(() => setMsg("世界没转过来（数据库没应答）。"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {[10, 60, 240].map((d) => (
        <button
          key={d}
          disabled={busy || pending}
          onClick={() => run(d)}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
        >
          过 {d} 日
        </button>
      ))}
      <span className="text-xs text-amber-100/50">{msg ?? `如今是第 ${day} 日。你不在的时候，他们也在过日子。`}</span>
    </div>
  );
}
