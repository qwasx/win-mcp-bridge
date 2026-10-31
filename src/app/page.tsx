import Link from "next/link";
import { TickButton } from "./_components/tick-button";
import { worldView } from "@/lib/world-store";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  death: "亡", kill: "杀", birth: "生", wed: "婚", grudge: "怨", revenge: "报",
  sect: "宗", trade: "市", art: "道", treasure: "宝", hero: "你", bond: "义", fell: "承",
};

export default async function Home() {
  let view: Awaited<ReturnType<typeof worldView>> | null = null;
  let error: string | null = null;
  try {
    view = await worldView();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8 border-b border-amber-500/20 pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-500/60">代号 · 活世界</p>
        <h1 className="mt-2 font-serif text-4xl text-amber-100">凡人修仙传 2D —— 活世界</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-amber-100/70">
          这次改的不是画面，是「人」。每个 NPC 有自己的<strong className="text-amber-200">储物袋</strong>（件件有来路）、
          自己的<strong className="text-amber-200">功法</strong>（会卡关、会求教、会传弟子）、自己的<strong className="text-amber-200">门派</strong>（有名册、差事、岁供、门派仇怨）、
          自己的<strong className="text-amber-200">家</strong>（父母子女道侣，死后遗物归亲族）、自己的<strong className="text-amber-200">仇恨</strong>（有缘由、会衰减、血仇追到亲族头上）、
          自己的<strong className="text-amber-200">社交</strong>（朋友、结拜、师徒、生意伙伴，传闻沿关系网传，越传越歪）。
          任何人来找你，都必须带着<strong className="text-amber-200">缘由</strong>——利益、代价、时限，一样不少；不再没头没脑地把你喊过去。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/game/index.html"
            className="rounded-md border border-amber-400/50 bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
          >
            进游戏试玩（原版引擎 + 活世界）↗
          </Link>
          <Link href="/api/world" className="rounded-md border border-amber-500/30 px-4 py-2 text-sm text-amber-100/80 transition hover:bg-amber-500/10">
            世界 JSON
          </Link>
          <Link href="/api/health" className="rounded-md border border-amber-500/30 px-4 py-2 text-sm text-amber-100/80 transition hover:bg-amber-500/10">
            健康检查
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          世界后台还没起来：{error}
        </div>
      )}

      {view && (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="第几日" value={view.day} hint={`你上次推日之后，世界照常在过`} />
            <Stat label="在世修士 / 凡人" value={view.summary.population} hint={`门派 ${view.summary.sects.length} 家 · 人家 ${view.summary.families.length} 户`} />
            <Stat label="众生储物总值" value={`${view.summary.bagWorth.toLocaleString()} 灵石`} hint="每件东西都有来路" />
            <Stat
              label="这些日子发生了"
              value={`${view.summary.stats.births} 生 / ${view.summary.stats.deaths} 亡`}
              hint={`婚 ${view.summary.stats.wed} · 命案 ${view.summary.stats.murders} · 寻仇 ${view.summary.stats.revenge} · 应约 ${view.summary.stats.contact} / 推约 ${view.summary.stats.refused}`}
            />
          </section>

          <section className="mb-8 rounded-lg border border-amber-500/25 bg-amber-500/5 p-5">
            <h2 className="mb-3 font-serif text-xl text-amber-100">有缘之邀（不莫名其妙）</h2>
            {view.contacts.length === 0 ? (
              <p className="text-sm text-amber-100/60">眼下没人来找你。这个世界的规矩是：没有缘由，不来打扰。</p>
            ) : (
              <ul className="space-y-3">
                {view.contacts.map((c) => (
                  <li key={c.id} className="rounded-md border border-amber-500/20 bg-black/20 p-4 text-sm">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <b className="text-amber-200">{c.fromName}</b>
                      <span className="text-xs text-amber-100/50">第 {c.day} 日 · {c.placeName ?? "不详"}</span>
                      <span className="ml-auto text-xs text-amber-100/40">{c.tone}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-amber-100/90">{c.line}</p>
                    <p className="mt-2 text-xs text-amber-100/60">
                      <b className="text-amber-200/80">缘由</b>：{c.reason}　<b className="text-emerald-300/80">事成之利</b>：{c.gain}　
                      <b className="text-rose-300/80">若推了</b>：{c.cost}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-xl text-amber-100">大事记</h2>
              <TickButton day={view.day} />
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-black/20 p-4 text-sm">
              {view.chron.length === 0 && <p className="text-amber-100/50">还没记下什么。</p>}
              <ul className="space-y-1.5">
                {view.chron.slice(0, 40).map((e, i) => (
                  <li key={i} className="flex gap-3 border-b border-white/5 pb-1.5 last:border-0">
                    <span className="w-16 shrink-0 text-xs text-amber-100/40">第{e.day}日</span>
                    <span className="w-8 shrink-0 text-center text-xs text-amber-500/80">{KIND_LABEL[e.kind] ?? "记"}</span>
                    <span className="text-amber-100/85">{e.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 font-serif text-xl text-amber-100">此刻众生（他们在忙什么）</h2>
            <div className="overflow-x-auto rounded-lg border border-amber-500/20 bg-black/20">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-amber-100/50">
                  <tr>
                    <th className="px-3 py-2 font-normal">人</th>
                    <th className="px-3 py-2 font-normal">境界</th>
                    <th className="px-3 py-2 font-normal">门派</th>
                    <th className="px-3 py-2 font-normal">居所</th>
                    <th className="px-3 py-2 font-normal">此刻在忙</th>
                    <th className="px-3 py-2 font-normal">袋 / 功 / 家</th>
                    <th className="px-3 py-2 font-normal">与你</th>
                  </tr>
                </thead>
                <tbody>
                  {view.npcs.map((n) => (
                    <tr key={n.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-amber-100">{n.name}</td>
                      <td className="px-3 py-1.5 text-amber-100/70">{n.realm}</td>
                      <td className="px-3 py-1.5 text-amber-100/70">{n.sect}</td>
                      <td className="px-3 py-1.5 text-amber-100/70">{n.at}</td>
                      <td className="px-3 py-1.5 text-amber-100/60">{n.agenda}</td>
                      <td className="px-3 py-1.5 text-amber-100/60">{n.bag}件 / {n.arts}功 / {n.kin}亲</td>
                      <td className="px-3 py-1.5">
                        {n.grudge > 0 ? <span className="text-rose-300">怨 {n.grudge}</span>
                          : n.favor > 0 ? <span className="text-emerald-300">好 {n.favor}</span>
                          : <span className="text-amber-100/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-10 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 font-serif text-xl text-amber-100">门派</h2>
              <ul className="space-y-1.5 text-sm">
                {view.summary.sects.filter((s) => s.members > 0).map((s) => (
                  <li key={s.id} className="flex gap-3 border-b border-white/5 pb-1.5">
                    <span className="w-28 shrink-0 text-amber-100">{s.name}</span>
                    <span className="text-amber-100/60">{s.members} 人 · 士气 {s.mood}{s.foes.length ? ` · 仇家 ${s.foes.join("、")}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 font-serif text-xl text-amber-100">人家</h2>
              <ul className="space-y-1.5 text-sm">
                {view.summary.families.slice(0, 14).map((f) => (
                  <li key={f.id} className="flex gap-3 border-b border-white/5 pb-1.5">
                    <span className="w-24 shrink-0 text-amber-100">{f.name}</span>
                    <span className="text-amber-100/60">{f.seat} · {f.members} 口 · 家声 {f.honor} · 「{f.creed}」{f.feuds ? ` · 世仇 ${f.feuds}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}

      <footer className="border-t border-amber-500/20 pt-5 text-xs leading-6 text-amber-100/40">
        活世界改动：新增共享引擎 <code>src/lib/alive/*</code>（浏览器与服务端共用同一份代码）；游戏侧桥接 <code>game/src/world/alive/alive.ts</code>、
        命册对话、活世界面板（游戏内按 <kbd>Y</kbd>）、劫道需有由头、杀人后储物袋真会易主、血仇追到亲族。
        游戏按 <kbd>Y</kbd> 打开「活世界」面板，可看每一个人的袋子、功法、门派、家人与恩怨。
      </footer>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-black/25 p-4">
      <div className="text-xs text-amber-100/45">{label}</div>
      <div className="mt-1 font-serif text-2xl text-amber-100">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-amber-100/40">{hint}</div>}
    </div>
  );
}
