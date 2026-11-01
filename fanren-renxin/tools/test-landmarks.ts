// 第十九步「符合原著」冒烟测试：名地地貌、迷雾压神识、熔岩、裂缝、遗骸、妖王、本地妖物、瀑布花林
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createCanvas } = await import('./env');
const { Terrain, CHUNK } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { ACTIVE_MAP } = await import('../src/data/world');
const { LANDMARKS, SCENIC, lmCleared } = await import('../src/data/landmarks');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
let errs = 0, oks = 0;
const ok = (c: any, s: string, extra = '') => { if (c) { oks++; console.log('ok  ', s, extra); } else { errs++; console.log('FAIL', s, extra); } };
const tick = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { g.modal = null; g.update(dt); } };
const guard = (name: string, f: () => void) => { try { f(); } catch (e: any) { errs++; console.log('ERR ', name, e?.stack?.split('\n').slice(0, 5).join(' | ')); } };
const cv: any = createCanvas(400, 300); const ctx = cv.getContext('2d');
const view = () => ({ left: g.player.x - 1500, top: g.player.y - 1000, right: g.player.x + 1500, bottom: g.player.y + 1000 });
const clearFoes = () => { for (const e of g.combat.enemies) { e.dead = true; e.hp = 0; } g.combat.enemies = []; };
console.log('map', ACTIVE_MAP, 'landmarks', LANDMARKS.map((l: any) => l.id).join(','), 'scenic peaks', SCENIC.peaks.length, 'falls', SCENIC.falls.length, 'groves', SCENIC.groves.length);
ok(LANDMARKS.length >= 1, '本图有原著名地');
g.hero.realm = 2; g.hero.stage = 2;

// ---- 1. 装饰：名地山峰、清场、瀑布、花林
guard('decos', () => {
  let named = 0, generic = 0, falls = 0, blossom = 0;
  for (const L of LANDMARKS as any[]) {
    for (let cy = Math.floor((L.y - L.r) / CHUNK); cy <= Math.floor((L.y + L.r) / CHUNK); cy++) for (let cx = Math.floor((L.x - L.r) / CHUNK); cx <= Math.floor((L.x + L.r) / CHUNK); cx++) {
      for (const d of terrain.getDecos(cx, cy)) {
        if (d.kind === 'mtn') { if (d.id.startsWith(L.id + '_pk')) named++; else if (d.id.startsWith('wf_' + L.id) && d.id.endsWith('_bg')) { /* 名地瀑布的背山 */ } else if (lmCleared(d.x, d.y - 30)) generic++; }
      }
    }
  }
  ok(named > 0 || LANDMARKS.every((l: any) => !l.peaks.length), '名地山峰已生成', String(named));
  ok(generic === 0, '清场区内没有普通山', String(generic));
  const W = terrain.W * 300, H = terrain.H * 300;
  const allF = terrain.allFallsIn(0, 0, W, H);
  falls = allF.length;
  ok(falls >= 5, '全图瀑布数量', String(falls));
  for (const f of allF.slice(0, 3)) { const cx = Math.floor(f.x / CHUNK), cy = Math.floor(f.y / CHUNK); ok(terrain.getDecos(cx, cy).some((d: any) => d.kind === 'fall' && d.id === f.id), '瀑布进入装饰列表', f.id); }
  for (const gv of SCENIC.groves.slice(0, 3)) { const cx = Math.floor(gv.x / CHUNK), cy = Math.floor(gv.y / CHUNK); for (const d of terrain.getDecos(cx, cy)) if (d.kind === 'tree' && (d.sp === 'peach' || d.sp === 'apricot' || d.sp === 'plum')) blossom++; }
  ok(blossom > 10 || !SCENIC.groves.length, '花林里有桃杏', String(blossom));
  let pg = 0; for (let y = 0; y < H; y += 2600) for (let x = 0; x < W; x += 2600) pg += terrain.grovesNear(x, y, 0).length > 0 ? 1 : 0;
  console.log('     procedural grove cells ~', pg);
});

const L0: any = LANDMARKS[0];
const tp = (x: number, y: number) => { g.teleport(x, y); g.player.flying = false; tick(2); };
// ---- 2. 进入、迷雾压制神识
guard('enter', () => {
  const r0 = g.senseRadius;
  tp(L0.x, L0.y + 200);
  ok(g.landmarks.cur?.id === L0.id, '进入名地', L0.id);
  tick(150);
  console.log('     senseK', g.landmarks.senseK.toFixed(2), 'mist', g.landmarks.mist.toFixed(2), 'R', Math.round(r0), '→', Math.round(g.senseRadius));
  if (L0.mist === 'white') ok(g.senseRadius < r0 * 0.8, '迷雾压制神识');
});
// ---- 3. 绘制不抛错
guard('draw', () => {
  for (const L of LANDMARKS as any[]) {
    tp(L.x, L.y + 300);
    const list: any[] = [];
    g.landmarks.drawGround(ctx, view(), 0.6, 1, 1.2);
    g.landmarks.collect(list, view(), 1.2);
    for (const it of list) it.draw(ctx);
    g.landmarks.drawOver(ctx, view(), 1.2);
    ok(true, '名地绘制', `${L.id} stands=${list.length}`);
  }
});
// ---- 4. 熔岩灼烧
for (const L of LANDMARKS as any[]) {
  const lake = L.ground.find((q: any) => q.k === 'lavalake' || q.k === 'lavapath'); if (!lake) continue;
  guard('lava ' + L.id, () => {
    clearFoes(); tp(lake.x + lake.w * 0.3, lake.y); g.hero.hp = 1; tick(60);
    clearFoes(); if (process.env.DBG) console.log(L.id, g.player.x - lake.x, g.player.y - lake.y, g.player.flying, g.landmarks.cur?.id, (g.landmarks as any).groundAt(L, g.player.x, g.player.y), g.hero.dead, g.paused, g.modal && (g.modal.title || g.modal.kind || Object.keys(g.modal)), (g.landmarks as any).hazT);
    ok(g.hero.hp < 0.99, `熔岩灼身（${L.id}）`, (1 - g.hero.hp).toFixed(3));
    g.player.flying = true; g.hero.hp = 1; tick(30); ok(g.hero.hp > 0.999 || g.hero.hp >= 1, '御器飞过熔岩不受伤', g.hero.hp.toFixed(3));
    g.player.flying = false;
  });
}
// ---- 5. 空间裂缝
const rifts = (g.landmarks as any).rifts as any[];
if (rifts.length) guard('rift', () => {
  const r = rifts[0];
  // 找一个裂缝张开的时刻
  for (let k = 0; k < 400; k++) { g.time = k * 0.5; if (Math.sin(g.time * 0.22 + r.ph) > 0.6) break; }
  clearFoes(); g.hero.hp = 1; (g.landmarks as any).riftCd = 0;
  g.teleport(r.x + 40, r.y); g.player.flying = false;
  let hit = false; for (let i = 0; i < 30; i++) { g.modal = null; g.update(1 / 30); if (g.hero.hp < 1) { hit = true; break; } }
  ok(hit, '空间裂缝撕伤/乱传', `hp=${g.hero.hp.toFixed(2)} pos=${Math.round(g.player.x)},${Math.round(g.player.y)}`);
  g.hero.hp = 1;
});
// ---- 6. 遗骸、构件交互
for (const L of LANDMARKS as any[]) for (const k of ['remains', 'stoneplat', 'bloodgate', 'altar', 'gate', 'invtower', 'corpsepost', 'ruinhall', 'cave', 'obelisk']) {
  const s = L.stands.find((q: any) => q.k === k); if (!s) continue;
  guard('stand ' + k, () => {
    clearFoes(); g.teleport(s.x + 30, s.y + 60); g.player.flying = true; tick(2);
    (g.landmarks as any).scanT = 0; g.landmarks.update(1 / 30);
    let captured: any = null; const od = g.openDialog.bind(g); g.openDialog = (n: any) => { captured = n; };
    const r = g.landmarks.interact(); g.openDialog = od;
    ok(r && captured, `构件可交互：${L.id}/${k}`, captured ? `[${captured.options.map((o: any) => o.label.slice(0, 8)).join('|')}]` : String(g.landmarks.focus?.k));
    if (captured && k === 'remains') { const res = captured.options[0].act(); console.log('     遗骸：', (res?.text ?? '').slice(0, 40).replace(/\n/g, ' ')); }
    g.player.flying = false; g.hero.hp = 1;
  });
}
// ---- 7. 妖王
for (const L of LANDMARKS as any[]) for (const lr of L.lairs) guard('lair ' + lr.id, () => {
  clearFoes(); g.teleport(lr.x + 600, lr.y + 400); g.player.flying = true; tick(2);
  (g.landmarks as any).scanT = 0; g.landmarks.update(1 / 30);
  const e = g.combat.enemies.find((q: any) => q.lairId === lr.id);
  ok(!!e, `名地妖王现身：${lr.name}`, e ? `${e.name} realm ${e.realm}.${e.stage}` : '');
  g.player.flying = false;
});
// ---- 8. 本地妖物
for (const L of LANDMARKS as any[]) guard('natives ' + L.id, () => {
  clearFoes(); tp(L.x + 300, L.y + 500);
  const cnt: Record<string, number> = {};
  for (let i = 0; i < 160; i++) { (g.combat as any).spawnTick(); for (const e of g.combat.enemies) cnt[e.def.id] = (cnt[e.def.id] ?? 0) + 1; g.combat.enemies = []; }
  const nat = Object.entries(cnt).filter(([id]) => L.natives.includes(id)).reduce((a, [, n]) => a + n, 0), all = Object.values(cnt).reduce((a, b) => a + b, 0);
  ok(all === 0 || nat / all > 0.5, `本地妖物为主：${L.id}`, JSON.stringify(cnt));
});
// 本地妖物不在别处出没
guard('natives elsewhere', () => {
  clearFoes(); tp(L0.x + 30000 < terrain.W * 300 ? L0.x + 30000 : L0.x - 30000, L0.y);
  let bad = 0; for (let i = 0; i < 120; i++) { (g.combat as any).spawnTick(); for (const e of g.combat.enemies) if (e.def.lm) bad++; g.combat.enemies = []; }
  ok(bad === 0, '本地妖物不在名地外刷新', String(bad));
});
console.log(`\n${oks} ok, errs ${errs}`);
process.exit(errs ? 1 : 0);
