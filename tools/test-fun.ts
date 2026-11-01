// 第十八步「让游戏好玩起来」冒烟测试：机缘、洞府、灵宠、会动的奇遇、红颜书信与同游、心魔劫
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createCanvas } = await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { WORLD_W, WORLD_H, WORLD_SCALE, LOC_BY_ID } = await import('../src/data/world');
const C = await import('../src/world/cultivation');
const { BEAUTIES } = await import('../src/data/beauties');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
let errs = 0, oks = 0;
const ok = (c: any, s: string, extra = '') => { if (c) { oks++; console.log('ok  ', s, extra); } else { errs++; console.log('FAIL', s, extra); } };
const tick = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { g.modal = null; g.update(dt); } };
const guard = (name: string, f: () => void) => { try { f(); } catch (e: any) { errs++; console.log('ERR ', name, e?.stack?.split('\n').slice(0, 4).join(' | ')); } };
/** 依次点开对话：每层选第 pick 个可用选项，最多 depth 层 */
const walk = (node: any, depth = 4, pickF: (opts: any[]) => any = (o) => o[0]) => {
  const trail: string[] = [];
  for (let i = 0; i < depth && node; i++) {
    trail.push(`${node.title ?? node.speaker ?? '?'}[${(node.options ?? []).map((o: any) => o.label.slice(0, 10)).join('|')}]`);
    const opts = (node.options ?? []).filter((o: any) => !o.disabled && o.act);
    if (!opts.length) break;
    const o = pickF(opts); const r = o.act(); node = r ?? (g.modal?.kind === 'dialog' ? g.modal.node : null); g.modal = null;
  }
  return trail.join(' → ');
};
// 一个离屏画布，验证 collect 的绘制不抛错
const cv: any = createCanvas(400, 300); const ctx = cv.getContext('2d');
const drawAll = (list: any[]) => { for (const it of list) it.draw(ctx); return list.length; };
const view = () => ({ left: g.player.x - 1500, top: g.player.y - 1000, right: g.player.x + 1500, bottom: g.player.y + 1000 });

// ---------------------------------------------------------------- 1. 机缘密度
g.hero.realm = 2; g.hero.stage = 1;
const all = g.sites.inRect(0, 0, WORLD_W * WORLD_SCALE, WORLD_H * WORLD_SCALE);
const byKind: Record<string, number> = {}; const byTier: Record<number, number> = {};
for (const s of all) { byKind[s.kind] = (byKind[s.kind] ?? 0) + 1; byTier[s.tier] = (byTier[s.tier] ?? 0) + 1; }
console.log('sites', all.length, JSON.stringify(byKind), JSON.stringify(byTier));
ok(all.length > 300, '天南机缘数量充足', String(all.length));
ok(Object.keys(byKind).length >= 8, '机缘种类齐全', Object.keys(byKind).join(','));
const hf = LOC_BY_ID.get('huangfeng')!; const hx = hf.x * WORLD_SCALE, hy = hf.y * WORLD_SCALE;
const near = g.sites.inRect(hx - 4000, hy - 4000, hx + 4000, hy + 4000);
ok(near.length >= 6, '黄枫谷周边（8000px 见方）有足够机缘', String(near.length));

// ---------------------------------------------------------------- 2. 每种机缘都能交互
const tried = new Set<string>();
for (const s of all) {
  if (tried.has(s.kind) || s.tier > 2) continue;
  tried.add(s.kind);
  guard('site ' + s.kind, () => {
    g.teleport(s.x + 60, s.y + 40); tick(3);
    // 守卫先清掉
    for (const e of g.combat.enemies) if (!e.dead) { e.dead = true; e.hp = 0; }
    g.sites.scanT = 0; g.sites.update(0.03);
    const f = g.sites.focus;
    ok(f && f.key === s.key, `机缘可聚焦：${s.kind}`, g.sites.name(s));
    let captured: any = null; const od = g.openDialog.bind(g); g.openDialog = (n: any) => { captured = n; };
    g.sites.interact(); g.openDialog = od;
    if (captured) console.log('     ', walk(captured, 4));
    ok(!!captured || s.kind === 'vein', `机缘对话：${s.kind}`);
  });
}
ok(tried.size >= 8, '交互覆盖种类', [...tried].join(','));
// 绘制
guard('sites.collect', () => { const near0 = all.find((s: any) => s.kind === 'ruin')!; g.teleport(near0.x + 100, near0.y); tick(2); const l: any[] = []; g.sites.collect(l, view(), 1, 0.03); ok(drawAll(l) > 0, 'sites.collect 有绘制', String(l.length)); });

// ---------------------------------------------------------------- 3. 洞府
guard('home', () => {
  const v = all.find((s: any) => s.kind === 'vein' && s.tier <= 1)!;
  g.home.create(v);
  ok(!!g.ws.home, '开辟洞府', g.ws.home?.name);
  g.teleport(g.ws.home.x + 80, g.ws.home.y); tick(3);
  const pb = g.placeBonus(); ok(pb.mult > 1.2, '洞府灵气加成', `${pb.name} ×${pb.mult.toFixed(2)}`);
  console.log('     ', walk(g.home.mainNode(), 3));
  console.log('     ', walk(g.home.gardenNode(), 3));
  const l: any[] = []; g.home.collect(l, view(), 1); ok(drawAll(l) > 0, 'home.collect 有绘制', String(l.length));
  ok(g.mapMarks().some((m: any) => m.glyph === '府'), '地图标出洞府');
  // 回府符
  for (const e of g.combat.enemies) { e.dead = true; e.hp = 0; }
  g.teleport(hx, hy); tick(40); C.addItem(g.hero, 'tal_huifu', 1); g.home.recall(); tick(2);
  ok(Math.hypot(g.player.x - g.ws.home.x, g.player.y - g.ws.home.y) < 600 || C.bagCount(g.hero, 'tal_huifu') === 0, '回府符', `${Math.round(Math.hypot(g.player.x - g.ws.home.x, g.player.y - g.ws.home.y))}`);
});

// ---------------------------------------------------------------- 4. 灵宠
guard('pets', () => {
  g.teleport(hx + 300, hy + 300);
  C.addItem(g.hero, 'egg_wolf', 1); g.pets.onEgg('egg_wolf');
  ok(!!g.ws.incubate, '灵卵开始温养');
  g.day += 400; tick(60);
  ok((g.ws.pets?.length ?? 0) >= 1, '灵卵破壳', g.ws.pets?.[0]?.name);
  ok(!!g.pets.ent, '灵宠跟随实体');
  console.log('     ', walk(g.pets.petNode(0), 2));
  const l: any[] = []; g.pets.collect(l); ok(drawAll(l) > 0, 'pets.collect 有绘制');
});

// ---------------------------------------------------------------- 5. 会动的奇遇
guard('happen', () => {
  const kinds: Record<string, number> = {};
  g.teleport(hx + 2500, hy + 1500);
  for (let i = 0; i < 4000; i++) {
    g.modal = null; g.update(0.1);
    for (const h of g.happen.haps) kinds[h.kind] = (kinds[h.kind] ?? 0) + 1;
    if (i % 400 === 0) { g.happen.haps.forEach((h: any) => { h.done = true; }); for (const e of g.combat.enemies) { e.dead = true; e.hp = 0; } g.teleport(g.player.x + 1800, g.player.y + (i % 800 ? 900 : -900)); g.hero.hp = 1; g.hero.dead = false; }
  }
  const seen = Object.keys(kinds);
  ok(seen.length >= 3, '奇遇种类会自行出现', seen.join(','));
  const l: any[] = []; g.happen.collect(l, view(), 1, 0.03); drawAll(l);
  const bn = g.happen.boardNode('tainan', '太南小会');
  console.log('     ', walk(bn, 2));
  ok((g.ws.bounties ?? []).length >= 1, '揭下悬赏', g.ws.bounties?.[0]?.name);
});

// ---------------------------------------------------------------- 6. 红颜：书信、同游、双修、信物
guard('hearts', () => {
  const b = BEAUTIES[0];
  const s = g.ws.hearts[b.id] ?? (g.ws.hearts[b.id] = { met: true, favor: 0, chapter: 0, flags: {}, follow: false, gifts: 0, lastGift: -1, lastTalk: -1 } as any);
  s.met = true; s.favor = 85; s.flags.companion = true; s.chapter = 5;
  const kinds: Record<string, number> = {};
  for (let d = 0; d < 720; d += 2) { g.day += 2; g.heartx.chk = 0; g.heartx.update(0.03); }
  for (const l of g.ws.letters ?? []) kinds[l.kind] = (kinds[l.kind] ?? 0) + 1;
  ok((g.ws.letters ?? []).length >= 8, '两年里收到不少书信', JSON.stringify(kinds));
  ok(g.heartx.unread > 0, '未读角标', String(g.heartx.unread));
  for (const l of (g.ws.letters ?? []).slice(0, 4)) console.log('      信', l.kind, walk(g.heartx.letterNode(l), 2));
  (g.ws.flags as any).sos = null; console.log('      好感', s.favor); s.favor = 85;
  const opts = g.heartx.options(b);
  console.log('      选项', opts.map((o: any) => o.label).join(' | '));
  ok(opts.some((o: any) => /信物/.test(o.label) || /东西要给你/.test(o.label)), '好感 85 可得信物');
  for (let i = 0; i < 3; i++) { const k = g.heartx.options(b).find((o: any) => /东西要给你/.test(o.label)); if (k) walk(k.act(), 2); }
  ok(C.bagCount(g.hero, 'gift_sachet') > 0, '集齐三件信物（含香囊）');
  const date = g.heartx.options(b).find((o: any) => /同游/.test(o.label));
  ok(!!date, '可约她同游');
  if (date) console.log('     ', walk(date.act(), 3));
  ok(Object.keys(s.flags.mem ?? {}).length >= 1, '留下共同回忆', JSON.stringify(s.flags.mem));
  const main = g.hearts.mainNode(b); console.log('      主对话', main.options.map((o: any) => o.label.slice(0, 8)).join('|'));
  g.hearts.setFollow(b.id, true); tick(30);
  ok(g.hearts.bonus(b.bonus.kind) > b.bonus.v, '香囊让同行加成提升', `${g.hearts.bonus(b.bonus.kind)} vs ${b.bonus.v}`);
  const l: any[] = []; g.heartx.bubble = { id: b.id, text: '测试', t: 2 }; g.heartx.collect(l); drawAll(l);
});

// ---------------------------------------------------------------- 7. 心魔劫
guard('xinmo', () => {
  const h = g.hero; h.realm = 2; h.stage = 2; h.exp = C.need(h) + 10; h.kills = 80;
  ok(g.xinmo.needed(), '筑基圆满需渡心魔劫');
  const r0 = g.breakthrough(0); ok(r0.ok === false && g.modal?.kind === 'dialog', '心魔劫开启', g.modal?.node?.title);
  let node = g.modal.node; const trail: string[] = [];
  for (let i = 0; i < 12 && node; i++) {
    trail.push(node.title);
    const o = node.options.find((x: any) => !x.disabled); g.modal = null;
    const r = o.act(); node = r ?? (g.modal?.kind === 'dialog' ? g.modal.node : null);
  }
  console.log('     ', trail.join(' → '));
  ok(h.realm === 3 || h.stats.failed > 0, '冲关已结算', `realm ${h.realm} failed ${h.stats.failed}`);
});

// ---------------------------------------------------------------- 8. 长跑：主循环带全部新系统
guard('soak', () => {
  g.modal = null; g.teleport(hx + 1200, hy - 800);
  for (let i = 0; i < 1500; i++) { g.modal = null; g.update(1 / 20); if (g.hero.dead) { g.hero.dead = false; g.hero.hp = 1; } }
  ok(true, '主循环 75 秒无异常');
});

console.log(`\n${oks} ok, errs ${errs}`);
process.exit(errs ? 1 : 0);
