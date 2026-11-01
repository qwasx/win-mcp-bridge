# 第四十五步补丁脚本（天道节奏 / 结婴天象 / 山河胜景）——逐处替换，找不到就报错
import re, sys, io
ROOT = '/home/user/sandbox/game/'
fails = []
def rd(p): return io.open(ROOT + p, encoding='utf-8').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8').write(s)
def rep(p, old, new, cnt=1):
    s = rd(p)
    if old not in s: fails.append((p, old[:70])); return
    wr(p, s.replace(old, new, cnt))
def rex(p, pat, new, flags=re.S):
    s = rd(p); s2, n = re.subn(pat, new, s, count=1, flags=flags)
    if not n: fails.append((p, 'RE:' + pat[:70])); return
    wr(p, s2)

# ---------- A. 天道节奏 ----------
P = 'src/data/realms.ts'
rep(P, "Math.round((36 + 11 * s) * 1.5)", "Math.round((36 + 11 * s) * 2.6)")
rep(P, "expDays: [2600, 3800, 5500]", "expDays: [7600, 10800, 14800]")
rep(P, "expDays: [8000, 11500, 16000]", "expDays: [22000, 31000, 43000]")
rep(P, "expDays: [26000, 39000, 57000]", "expDays: [70000, 100000, 140000]")
rep(P, "expDays: [100000, 150000, 210000]", "expDays: [260000, 380000, 520000]")

P = 'src/world/cultivation.ts'
rep(P, "export const INSIGHT = 0.3;", """export const INSIGHT = 0.12;
/** 第四十五步「天道」：单颗丹药的药力上限（占本小境界所需修为的比例）——高阶丹药虚不受补，一颗顶不了几十年 */
export const PILL_CAP = 0.07;
/** 第四十五步「天道」：奇遇、斗法、切磋、任务所得修为都从「感悟池」支取：池子每月回 0.4%，最多存 5%（占本小境界所需） */
export const WU_RATE = 0.004, WU_MAX = 0.05;
export function wuTake(h: Hero, amount: number) {
  const m = Math.floor(h.age * 12), nd = Math.max(1, need(h));
  if (h.wuP === undefined || h.wuM === undefined) { h.wuP = WU_MAX; h.wuM = m; }
  if (m > h.wuM) { h.wuP = Math.min(WU_MAX, h.wuP + (m - h.wuM) * WU_RATE); h.wuM = m; }
  const k = Math.max(0, Math.min(amount, h.wuP * nd));
  h.wuP = Math.max(0, h.wuP - k / nd);
  return k;
}
/** 人界灵气稀薄：修炼倍率超过两倍的部分减半 */
export function softRate(m: number) { return m <= 2 ? m : 2 + (m - 2) * 0.5; }""")
rep(P, "  pillN?: number;\n", "  pillN?: number;\n  /** 第四十五步「天道」：感悟池（占本小境界所需修为的比例）与上次结算的月份 */\n  wuP?: number; wuM?: number;\n")
rep(P, "return 10 * rootDef(h).rate * gf.rate * over * (1 + mod(h, 'exp')) * place;", "return 10 * softRate(rootDef(h).rate * gf.rate * over * (1 + mod(h, 'exp')) * place);")
rep(P, "export function gainExp(h: Hero, amount: number, out: Msg[]) {\n  let left = amount;", "export function gainExp(h: Hero, amount: number, out: Msg[], src: 'insight' | 'med' | 'pill' = 'insight') {\n  let left = src === 'insight' ? wuTake(h, amount) : amount;")
rep(P, "if (meditating) { gainExp(h, expPerDay(h, place) * days, out); h.stats.meditateDays += days; }", "if (meditating) { gainExp(h, expPerDay(h, place) * days, out, 'med'); h.stats.meditateDays += days; }")
rep(P, "    gainExp(h, e.exp * tierFit * fat * (gongfaDef(h).id === 'changchun' ? 1.1 : 1), out);", """    const raw = e.exp * tierFit * (gongfaDef(h).id === 'changchun' ? 1.1 : 1), cap = need(h) * PILL_CAP;
    gainExp(h, Math.min(raw, cap) * fat, out, 'pill');
    if (raw > cap * 2.5) out.push({ text: '药力过猛，虚不受补——大半药力化作燥火散去了。', kind: 'warn' });""")

P = 'src/world/combat.ts'
rex(P, r"const exp = expNeed\(e\.realm, e\.stage\) \* 0\.0045.*?vy: -40 \}\);", """// 第四十五步「天道」：斗法只得少许感悟（按自身境界折算，越阶斩杀略多），且从「感悟池」支取
    const want = C.need(h) * 0.0004 * Math.min(3, e.def.hp) * Math.max(0.15, Math.min(1.8, gapK)) * (e.boss || e.def.lair ? 5 : 1);
    const msgs: C.Msg[] = [];
    const e0 = h.exp, r0 = h.realm * 100 + h.stage;
    C.gainExp(h, want, msgs);
    const exp = h.realm * 100 + h.stage === r0 ? h.exp - e0 : want;
    if (exp >= 1) this.texts.push({ x: e.x, y: e.y - 60, s: `修为 +${Math.round(exp)}`, color: '#9fe8c0', t: 0, vy: -40 });""")

# ---------- B. 结婴天象 ----------
P = 'src/world/game.ts'
rep(P, "export const DAYS_PER_SEC = 0.5;", "/** 第四十五步：大境界突破过场（结丹 / 结婴 / 化神） */\nexport interface AscendInfo { kind: 'jiedan' | 'jieying' | 'huashen'; ok: boolean; name: string; age: number; realm: string; life: number; place: string }\n\nexport const DAYS_PER_SEC = 0.5;")
rep(P, "  onTravel?: (to: MapId, via: 'portal' | 'edge') => void;", "  onTravel?: (to: MapId, via: 'portal' | 'edge') => void;\n  /** 第四十五步：结丹 / 结婴 / 化神过场 */\n  onAscend?: (a: AscendInfo) => void;\n  private pendingAscend: AscendInfo['kind'] | null = null;")
rep(P, "    const r = C.tryBreak(this.hero, pills, bonus ?? 0);\n    this.flushMsgs(r.msgs);", """    const major = C.bottleneck(this.hero) === 'major', from = this.hero.realm;
    const r = C.tryBreak(this.hero, pills, bonus ?? 0);
    this.flushMsgs(r.msgs);
    if (major && from >= 2 && from <= 4) {
      const h = this.hero, where = this.nearbyLocation()?.name ?? this.placeBonus().name;
      const kind: AscendInfo['kind'] = from === 2 ? 'jiedan' : from === 3 ? 'jieying' : 'huashen';
      if (r.ok) this.news(`${h.name}于${where}${kind === 'jiedan' ? '凝结金丹，霞光冲霄' : kind === 'jieying' ? '碎丹成婴，天地异象，方圆数百里皆见' : '元婴化神，人界为之一震'}。`, 'rumor');
      if (this.onAscend) { if (r.ok) this.pendingAscend = kind; this.onAscend({ kind, ok: r.ok, name: h.name, age: Math.floor(h.age), realm: realmName(h.realm, h.stage), life: C.maxLife(h), place: where }); }
      else if (r.ok) this.ascendFx(kind);
    }""")
rep(P, "  usePill(id: string) {", """  /** 第四十五步：过场结束（界面回调） */
  ascendDone() { const k = this.pendingAscend; this.pendingAscend = null; if (k) this.ascendFx(k); }
  /** 突破后的天象余韵：在世界里继续的光柱、灵阵与金光 */
  private ascendFx(kind: AscendInfo['kind']) {
    const p = this.player, vfx = (this.combat as any).vfx as any[]; if (!vfx) return;
    const n = kind === 'jiedan' ? 3 : 6, col = kind === 'huashen' ? '255,200,240' : '255,236,170';
    for (let i = 0; i < n; i++) vfx.push({ kind: 'aura', x: p.x, y: p.y, r: 140 + i * 55, t: 0, dur: 2.4 + i * 0.7, color: col, fx: 'breakthrough' });
    for (let i = 0; i < n; i++) this.renderer?.burst(p.x + (Math.random() - 0.5) * 260, p.y - 60 - Math.random() * 160, i % 2 ? '#fff2b0' : '#e8c8ff', 40);
    this.toast(kind === 'jiedan' ? '金丹初成，丹田中一片温热。' : kind === 'jieying' ? '元婴初成——方圆百里的修士都看见了那道冲天霞光。' : '化神已成，天地元气为你所用。', 'good');
  }
  usePill(id: string) {""")

P = 'src/ui/GameView.tsx'
rep(P, "import { WardrobePanel } from './Wardrobe';", "import { WardrobePanel } from './Wardrobe';\nimport { Ascension } from './Ascension';")
rep(P, "  const [travelFx, setTravelFx] = useState", "  const [ascend, setAscend] = useState<import('../world/game').AscendInfo | null>(null);\n  const [travelFx, setTravelFx] = useState")
rep(P, "    game.onTravel = (to, via) => {", "    game.onAscend = (a) => { game.paused = true; setPanel(''); setAscend(a); };\n    game.onTravel = (to, via) => {")
rep(P, "game.onTravel = undefined;", "game.onTravel = undefined; game.onAscend = undefined;")
rep(P, "      {travelFx && <div className={'travel-fx ' + travelFx.via}>", "      {ascend && <Ascension info={ascend} onDone={() => { setAscend(null); game.paused = false; game.ascendDone(); }} />}\n      {travelFx && <div className={'travel-fx ' + travelFx.via}>")

P = 'src/ui/Ascension.tsx'
rep(P, "  const skipAt = useRef(-1);\n", "  const skipAt = useRef(-1);\n  const skipRef = useRef<() => void>(() => { /* */ });\n")
rep(P, "  const skipRef = useRef<() => void>(() => { /* */ });\n\n  const seal", "  const seal")
rep(P, "(skipRef as any).current = ", "skipRef.current = ")

# ---------- C. 山河：大湖、大江、湖心岛 ----------
P = 'src/data/world.ts'
rep(P, "function buildMap(id: MapId, seed: number, pre: string): MapData {", """// ---------- 第四十五步：大湖、大江、湖心岛（新图坐标，宏观单位；在 genMinor 之后加入，旧存档的小地点 id 不变） ----------
const NEW_LAKES: Partial<Record<MapId, { c: P; r: number; name?: string }[]>> = {
  tiannan: [
    { c: [585, 445], r: 24, name: '云梦泽' }, { c: [612, 430], r: 18 }, { c: [565, 463], r: 14 }, { c: [618, 458], r: 12 }, { c: [600, 470], r: 10 },
    { c: [745, 528], r: 12, name: '镜湖' }, { c: [733, 520], r: 8 }, { c: [757, 536], r: 8 },
    { c: [392, 450], r: 15, name: '黑水泽' }, { c: [402, 470], r: 10 },
    { c: [700, 275], r: 16, name: '碧落湖' }, { c: [684, 268], r: 10 }, { c: [716, 284], r: 9 },
    { c: [128, 270], r: 12, name: '翠竹湖' }, { c: [138, 282], r: 7 },
  ],
};
const NEW_RIVERS: Partial<Record<MapId, { pts: P[]; w: number; name?: string }[]>> = {
  tiannan: [
    // 沧澜江：出云梦泽，东南奔流入海——天南第一大江
    { pts: [[612, 470], [630, 500], [650, 540], [668, 578], [686, 606], [705, 638]], w: 3.4, name: '沧澜江' },
    // 白龙江：自北面大河分出，南注云梦泽
    { pts: [[574, 342], [584, 372], [592, 400], [598, 424]], w: 1.5, name: '白龙江' },
    // 碧落河：出碧落湖，东流入海
    { pts: [[716, 286], [760, 292], [810, 287], [860, 296], [922, 302]], w: 1.7, name: '碧落河' },
    // 翠竹溪：出翠竹湖，西流入海
    { pts: [[120, 272], [96, 262], [72, 258], [50, 250]], w: 1.1 },
  ],
};
const LAKE_ISLE_DATA: Partial<Record<MapId, { c: P; r: number }[]>> = {
  tiannan: [{ c: [592, 447], r: 4.2 }, { c: [745, 527], r: 2.2 }, { c: [698, 274], r: 2.4 }],
};
function addNewWater(M: MapData) {
  const nl = NEW_LAKES[M.id]; if (!nl) return;
  const nr = NEW_RIVERS[M.id] ?? [];
  M.lakes = M.lakes.concat(nl.map((l) => ({ c: l.c, r: l.r, name: l.name })));
  M.rivers = M.rivers.concat(nr.map((r) => ({ pts: r.pts, w: r.w })));
  for (const l of nl) if (l.name) M.labels.push({ name: l.name, at: [l.c[0], l.c[1] + 2], size: l.r >= 20 ? 2.1 : 1.4 });
  for (const r of nr) if (r.name) { const p = r.pts[Math.floor(r.pts.length / 2)]; M.labels.push({ name: r.name, at: [p[0] + 7, p[1]], size: r.w > 3 ? 1.6 : 1.1 }); }
  // 落入新湖的小地点挪到岸上（id、名字不变）
  const isl = LAKE_ISLE_DATA[M.id] ?? [];
  const wet = (x: number, y: number, pad: number) => nl.some((l) => Math.hypot(l.c[0] - x, l.c[1] - y) < l.r + pad) && !isl.some((q) => Math.hypot(q.c[0] - x, q.c[1] - y) < q.r - 1);
  for (const L of M.locations) {
    if (!wet(L.x, L.y, 3)) continue;
    let best: P | null = null;
    for (let d = 2; d < 70 && !best; d += 1) for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, x = L.x + Math.cos(a) * d, y = L.y + Math.sin(a) * d;
      if (!wet(x, y, 3.5) && M.mainland.length > 2 && pointInPoly(x, y, M.mainland)) { best = [x, y]; break; }
    }
    if (best) { L.x = best[0]; L.y = best[1]; const o = fromMap(M.id, L.x, L.y); L.ox = o[0]; L.oy = o[1]; }
  }
}

function buildMap(id: MapId, seed: number, pre: string): MapData {""")
rep(P, "  M.locations.push(...genMinor(M, seed, pre));\n  return M;", "  M.locations.push(...genMinor(M, seed, pre));\n  addNewWater(M);\n  return M;")
rep(P, "export const LAKES = M.lakes;", "export const LAKES = M.lakes;\n/** 第四十五步：湖心岛（在陆地掩码上补回的小块陆地） */\nexport const LAKE_ISLES: { c: P; r: number }[] = LAKE_ISLE_DATA[ACTIVE_MAP] ?? [];")

P = 'src/world/terrain.ts'
rep(P, "MAINLAND, LAKES, RANGES, RIVERS,", "MAINLAND, LAKES, LAKE_ISLES, RANGES, RIVERS,")
rep(P, "    for (const l of LAKES) { g.beginPath(); g.arc(l.c[0], l.c[1], l.r, 0, Math.PI * 2); g.fill(); }", "    for (const l of LAKES) { g.beginPath(); g.arc(l.c[0], l.c[1], l.r, 0, Math.PI * 2); g.fill(); }\n    // 第四十五步：湖心岛\n    g.fillStyle = '#f00'; for (const l of LAKE_ISLES) { g.beginPath(); g.arc(l.c[0], l.c[1], l.r, 0, Math.PI * 2); g.fill(); }\n    g.fillStyle = '#000';")
rep(P, "        if (this.land[(my | 0) * W + (mx | 0)] < 0.6) continue;", "        if (this.land[(my | 0) * W + (mx | 0)] < 0.6) continue;\n        // 第四十五步：路不穿湖\n        if ([0.15, 0.3, 0.42, 0.58, 0.7, 0.85].some((q) => this.land[((a.y + (b.y - a.y) * q) | 0) * W + ((a.x + (b.x - a.x) * q) | 0)] < 0.6)) continue;")

# ---------- C. 名胜古迹 ----------
P = 'src/data/landmarks.ts'
rep(P, "'pit' | 'taiji' | 'scree';", "'pit' | 'taiji' | 'scree' | 'lotus';")
rep(P, "tex?: string; sc?: number }", "tex?: string; sc?: number; lore?: string; snap?: 1 }")
rep(P, "  enter: string;\n}", "  enter: string;\n  /** 第四十五步：名胜古迹 */\n  scenic?: boolean; poem?: string;\n}")
rep(P, "import type { Species } from '../gfx/tree';", "import type { Species } from '../gfx/tree';\nimport { PROP2 } from '../gfx/propDims';\nimport { SJ_TN, SJ_DJ, type SJ } from './shengjing';")
rep(P, "export const LANDMARKS: Landmark[] = build();", """// 第四十五步：名胜古迹（湖、江、塔、桥、寺、崖、渡口、古战场），画材为 AI 淡彩
function buildShengjing(): Landmark[] {
  const list: SJ[] = ACTIVE_MAP === 'tiannan' ? SJ_TN : ACTIVE_MAP === 'dajin' ? SJ_DJ : [];
  const out: Landmark[] = [], lotus: Landmark[] = [];
  for (const s of list) {
    let X: number, Y: number;
    if (Array.isArray(s.at)) { X = s.at[0] * WORLD_SCALE; Y = s.at[1] * WORLD_SCALE; }
    else { const l = locHere(s.at.loc); if (!l) continue; X = l.x * WORLD_SCALE + s.at.dx; Y = l.y * WORLD_SCALE + s.at.dy; }
    const D = PROP2['p_' + s.tex] ?? { w: 800, h: 800 }, sc = s.sc ?? 1, w = D.w * sc, h = D.h * sc;
    out.push({
      id: 'sj_' + s.id, name: s.name, x: X, y: Y - h * 0.25, r: Math.max(1200, Math.max(w, h) * 0.9),
      ground: [], stands: [{ k: 'sprite', x: X, y: Y, w, h, seed: sd(), id: 'sjs_' + s.id, name: s.name, tex: 'p_' + s.tex, sc, flip: s.flip, lore: s.lore, snap: s.snap }],
      peaks: [], lairs: [], clear: [[X, Y - h * 0.3, Math.max(w, h) * 0.55]], mist: null, senseK: 1, natives: [],
      enter: `【胜景】${s.name}——${s.poem}`, scenic: true, poem: s.poem,
    });
    (s.lotus ?? []).forEach(([mx, my, r], i) => {
      const x = mx * WORLD_SCALE, y = my * WORLD_SCALE;
      lotus.push({ id: `sjl_${s.id}_${i}`, name: '', x, y, r: r * 0.5, ground: [{ k: 'lotus', x, y, w: r, h: r * 0.5, seed: sd() }], stands: [], peaks: [], lairs: [], clear: [], mist: null, senseK: 1, natives: [], enter: '' });
    });
  }
  return out.concat(lotus);
}
export const LANDMARKS: Landmark[] = [...build(), ...buildShengjing()];""")

P = 'src/world/landmarks.ts'
rep(P, "      if (L) {\n        const f = this.f; f.seen ??= {};\n        g.toast(L.enter, 'warn');\n        if (!f.seen[L.id]) { f.seen[L.id] = 1; g.news?.(`韩立踏入了${L.name}。`, 'personal'); }\n      }", """      if (L && L.enter) {
        const f = this.f; f.seen ??= {};
        g.toast(L.enter, L.scenic ? 'good' : 'warn');
        if (!f.seen[L.id]) { f.seen[L.id] = 1; g.news?.(`韩立${L.scenic ? '游历' : '踏入了'}${L.name}。`, 'personal'); if (L.scenic) this.scenicFirst(L); }
      }""")
rep(P, "  update(dt: number) {\n    const g = this.g, p = g.player, h = g.hero;", "  update(dt: number) {\n    if (!this.snapped) this.snapBridges();\n    const g = this.g, p = g.player, h = g.hero;")
rep(P, "        if (s.k === 'wall' || s.k === 'crystal' || s.k === 'sprite') continue;", "        if (s.k === 'wall' || s.k === 'crystal' || (s.k === 'sprite' && !s.lore)) continue;")
rep(P, "    const text = LORE[s.k]; if (!text) return false;", "    const text = s.lore ?? LORE[s.k]; if (!text) return false;")
rep(P, "    opts.push({ label: '离开', act: () => null });\n    g.openDialog({ speaker: s.name || '古迹', text, options: opts });", """    if (s.lore && !f.once[s.id]) opts.push({ label: '凭栏远眺，静坐片刻', tone: 'good', act: () => {
      f.once![s.id] = 1; g.hero.hp = 1; g.hero.mp = 1;
      const m: C.Msg[] = []; C.gainExp(g.hero, C.need(g.hero) * C.INSIGHT * 0.05, m);
      const L = LANDMARKS.find((x) => x.stands.includes(s));
      return this.close(`「${L?.poem ?? ''}」\\n\\n山水入怀，胸中块垒尽消。你静坐了小半日，起身时只觉灵台一片清明。（气血、法力回满，修为微涨）`, s.name || '胜景', 'mystic');
    } });
    opts.push({ label: '离开', act: () => null });
    g.openDialog({ speaker: s.name || '古迹', text, options: opts });""")
rep(P, "  private close(text: string, title: string, mood?: DNode['mood']): DNode {", """  /** 第四十五步：初游名胜——心旷神怡；每游四处，胸中丘壑渐成，寿元 +3 */
  private scenicFirst(L: Landmark) {
    const g = this.g, h = g.hero, f = this.f;
    h.hp = 1; h.mp = 1;
    const all = LANDMARKS.filter((x) => x.scenic), n = all.filter((x) => f.seen?.[x.id]).length;
    if (n > 0 && n % 4 === 0) { h.lifeBonus += 3; g.toast(`名胜录 ${n}/${all.length}：胸中丘壑渐成——寿元 +3 载。`, 'good'); }
    else g.toast(`名胜录 ${n}/${all.length}：${L.name}`, 'info');
  }
  private snapped = false;
  /** 第四十五步：石桥按真实河道（含河曲扭曲）对正，按河宽缩放 */
  private snapBridges() {
    const geo = (this.g as any).terrain?.riverGeo; if (!geo) return;
    this.snapped = true;
    for (const L of LANDMARKS) for (const s of L.stands) {
      if (!s.snap) continue;
      let best: [number, number] | null = null;
      for (let dy = 0; dy <= 2000 && !best; dy += 250) for (const sy of dy ? [s.y - dy, s.y + dy] : [s.y]) {
        let x0 = NaN; const runs: [number, number][] = [];
        for (let x = s.x - 3600; x <= s.x + 3600; x += 30) { const wet = geo.edgeDist(x, sy) < 0; if (wet && isNaN(x0)) x0 = x; if (!wet && !isNaN(x0)) { runs.push([x0, x]); x0 = NaN; } }
        const r = runs.filter((q) => q[1] - q[0] > 100).sort((a, b) => Math.abs((a[0] + a[1]) / 2 - s.x) - Math.abs((b[0] + b[1]) / 2 - s.x))[0];
        if (r) { best = [(r[0] + r[1]) / 2, r[1] - r[0]]; s.y = sy; break; }
      }
      if (!best) continue;
      const sc0 = s.sc ?? 1, bw = s.w / sc0, bh = s.h / sc0, sc = Math.max(0.55, Math.min(1.8, (best[1] + 1000) / bw));
      s.x = best[0]; s.sc = sc; s.w = bw * sc; s.h = bh * sc;
    }
  }
  private close(text: string, title: string, mood?: DNode['mood']): DNode {""")

P = 'src/gfx/landmark.ts'
rep(P, "export function renderLmGround(k: GroundKind, w: number, h: number, seed: number, res: number): Spr {\n", """/** 第四十五步：荷花荡——湖面上的荷叶、荷花与花苞 */
function renderLotus(w: number, h: number, seed: number, res: number): Spr {
  const rnd = mulberry32(seed >>> 0), R = (a: number, b: number) => a + (b - a) * rnd();
  const c = makeCanvas(Math.max(1, Math.ceil(w * res)), Math.max(1, Math.ceil(h * res))); const g = c.getContext('2d')!;
  g.scale(res, res);
  const n = Math.max(8, Math.round((w * h) / 7000)), pads: [number, number, number][] = [];
  for (let i = 0; i < n * 4 && pads.length < n; i++) {
    const u = R(-1, 1), v = R(-1, 1), d = u * u + v * v; if (d > 1) continue;
    pads.push([w / 2 + u * w * 0.45, h / 2 + v * h * 0.42, R(20, 44) * (1 - Math.sqrt(d) * 0.45)]);
  }
  pads.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of pads) {
    const a0 = R(0, Math.PI * 2), notch = 0.34, hue = R(92, 128), li = R(30, 42);
    g.fillStyle = 'rgba(16,36,30,0.2)'; g.beginPath(); g.ellipse(x + 3, y + 3, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.2, r * 0.1, x, y, r);
    gr.addColorStop(0, `hsl(${hue},42%,${li + 15}%)`); gr.addColorStop(1, `hsl(${hue},38%,${li}%)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, r, r * 0.55, 0, a0 + notch / 2, a0 + Math.PI * 2 - notch / 2); g.closePath(); g.fill();
    g.strokeStyle = `hsla(${hue},35%,${li - 12}%,0.55)`; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = `hsla(${hue},40%,${li + 24}%,0.32)`; g.lineWidth = 0.8;
    for (let k = 0; k < 7; k++) { const a = a0 + notch / 2 + (Math.PI * 2 - notch) * (k + 0.5) / 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.5); g.stroke(); }
  }
  const nf = Math.max(3, Math.round(n * 0.22));
  for (let i = 0; i < nf; i++) {
    const p = pads[Math.floor(rnd() * pads.length)]; if (!p) break;
    const x = p[0] + R(-10, 10), y = p[1] - R(6, 16), s = R(9, 16), bud = rnd() < 0.3, np = bud ? 3 : 7;
    g.strokeStyle = 'rgba(60,92,52,0.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y + s * 0.6); g.lineTo(x + R(-3, 3), y + s * 1.5); g.stroke();
    for (let k = 0; k < np; k++) {
      const a = -Math.PI / 2 + (k - (np - 1) / 2) * (bud ? 0.35 : 0.42), px = x + Math.cos(a) * s * 0.45, py = y + Math.sin(a) * s * 0.45;
      const pg = g.createLinearGradient(px, py - s * 0.6, x, y + s * 0.3);
      pg.addColorStop(0, '#ff8fb4'); pg.addColorStop(0.55, '#ffd0de'); pg.addColorStop(1, '#fff4f6');
      g.fillStyle = pg; g.beginPath(); g.ellipse(px, py, s * 0.28, s * (bud ? 0.62 : 0.55), a + Math.PI / 2, 0, Math.PI * 2); g.fill();
    }
    if (!bud) { g.fillStyle = '#f2d26a'; g.beginPath(); g.arc(x, y + s * 0.05, s * 0.16, 0, Math.PI * 2); g.fill(); }
  }
  return { canvas: c, w, h, ax: w / 2, ay: h / 2 };
}

export function renderLmGround(k: GroundKind, w: number, h: number, seed: number, res: number): Spr {
  if (k === 'lotus') return renderLotus(w, h, seed, res);
""")

# 画材登记
P = 'src/gfx/propData.ts'
s = rd(P); names = ['s_tower', 's_bridge', 's_pagoda', 's_buddha', 's_temple', 's_ruins', 's_dock', 's_pavilion']
imps = ''.join(f"import ps{i} from '../assets/prop/{n}.webp?inline';\n" for i, n in enumerate(names))
last = s.rfind('?inline\';\n')
if last < 0: fails.append((P, 'imports'))
else:
    s = s[:last + len("?inline';\n")] + imps + s[last + len("?inline';\n"):]
    k = s.rfind('};')
    s = s[:k] + ''.join(f"  p_{n}: ps{i},\n" for i, n in enumerate(names)) + s[k:]
    wr(P, s)
P = 'src/gfx/propDims.ts'
s = rd(P); k = s.rfind('};')
dims = {'s_tower': (1350, 1377), 's_bridge': (2000, 307), 's_pagoda': (800, 1272), 's_buddha': (1150, 1875), 's_temple': (1600, 1078), 's_ruins': (1400, 1109), 's_dock': (900, 1026), 's_pavilion': (900, 976)}
wr(P, s[:k] + '  // 第四十五步：名胜古迹（AI 淡彩画材）\n' + ''.join(f"  p_{n}: {{ w: {w}, h: {h} }},\n" for n, (w, h) in dims.items()) + s[k:])

rep('index.html', '<title>凡人修仙传 · 人界篇</title>', '<title>凡人修仙传 · 人界篇 v0.45 · 天道 · 结婴天象 · 山河胜景</title>')
print('FAILS:', len(fails)); [print('  ', f) for f in fails]
