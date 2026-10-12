// 大地图联机手感/性能：真实客户端（jsdom）连本地服务器
//  1) 点击行军 → 画面上自己部队开始移动要多久（输入延迟）
//  2) 行军时每帧位移是否平滑（卡顿帧 = 本该在走却几乎不动 / 突然跳一大步）
//  3) 每帧 CPU 耗时（update+render），并用 inspector 采样找热点
// 先启动服务器：rm -rf /tmp/wp1 && PORT=8091 DATA_DIR=/tmp/wp1 node dist-server/server.mjs
// 可选环境变量：LAG=毫秒（人为给每条服务器消息加延迟，模拟远程网络）
export default async function (c: any) {
  const { game, wait, GAME } = c;
  (globalThis as any).WebSocket ||= (window as any).WebSocket; (globalThis as any).location ||= window.location;
  const LAG = Number(process.env.LAG ?? 0);
  if (LAG) {
    // 模拟网络延迟：收到的消息推迟 LAG/2，发出的消息推迟 LAG/2
    const WS = (globalThis as any).WebSocket;
    const desc = Object.getOwnPropertyDescriptor(WS.prototype, 'onmessage')!;
    Object.defineProperty(WS.prototype, 'onmessage', { set(fn: any) { desc.set!.call(this, fn ? (ev: any) => { const d = { data: ev.data }; setTimeout(() => fn.call(this, d), LAG / 2); } : fn); }, get() { return desc.get!.call(this); } });
    const os = WS.prototype.send;
    WS.prototype.send = function (d: any) { setTimeout(() => { try { os.call(this, d); } catch { /* */ } }, LAG / 2); };
  }
  const mp = await import(GAME + 'src/ui/mp.ts');
  const { NET } = await import(GAME + 'src/net/client.ts');
  const G = await import(GAME + 'src/core/game.ts');
  const { setPlayerTarget, nav } = await import(GAME + 'src/core/sim.ts');
  const { closeAll } = await import(GAME + 'src/ui/dom.ts');
  const { passable } = await import(GAME + 'src/core/terrain.ts');
  mp.setMpHooks(() => { closeAll(); game.scene.stop('World'); game.scene.start('World'); }, () => {});
  const click = (txt: string) => { const b = [...document.querySelectorAll('button')].reverse().find((x: any) => x.textContent?.includes(txt)) as any; if (!b) throw new Error('no button ' + txt); b.click(); };
  mp.openMpLogin();
  const inputs = [...document.querySelectorAll('.mp-login input')] as HTMLInputElement[];
  inputs[0].value = process.env.MPNAME ?? ('测速' + Math.floor(Math.random() * 1000)); inputs[1].value = 'pass1234'; inputs[2].value = 'ws://127.0.0.1:8091/ws';
  click('注册新名号');
  await wait(1500);
  click('投效');
  await wait(2500);
  const S = G.S;
  const ws = game.scene.getScene('World');
  ws.cameras.main.setZoom(1.1);
  console.log('in world', NET.inWorld, 'parties', S.parties.length, 'lag', LAG);

  // ---- 文字贴图重绘次数（Phaser Text.updateText） ----
  const TP = c.Phaser.GameObjects.Text.prototype; let textRedraws = 0; const ou = TP.updateText; TP.updateText = function (...a: any[]) { textRedraws++; return ou.apply(this, a); };
  await wait(500); textRedraws = 0; const trT0 = performance.now();
  await wait(3000);
  console.log(`TEXT redraws/sec (idle) ${(textRedraws / ((performance.now() - trT0) / 1000)).toFixed(1)}`);
  // ---- 帧耗时 ----
  const frames: number[] = [];
  const origStep = game.loop.callback;
  game.loop.callback = (t: number, d: number) => { const a = performance.now(); origStep(t, d); frames.push(performance.now() - a); };

  // ---- 行军手感 ----
  const p = G.player();
  const res: { lat: number[]; stalls: number; jumps: number; moving: number; } = { lat: [], stalls: 0, jumps: 0, moving: 0 };
  for (let k = 0; k < 4; k++) {
    // 找一个可走的目标点
    let tx = 0, ty = 0;
    for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2; tx = p.x + Math.cos(a) * 90; ty = p.y + Math.sin(a) * 90; if (passable(tx, ty)) break; }
    const x0 = p.x, y0 = p.y, t0 = performance.now();
    setPlayerTarget({ kind: 'point', x: tx, y: ty } as any);
    let first = -1, lx = p.x, ly = p.y, lt = performance.now();
    const steps: number[] = []; let maxErr = 0;
    while (performance.now() - t0 < 5000) {
      await new Promise(r => setTimeout(r, 16));
      const now = performance.now();
      if (first < 0 && Math.hypot(p.x - x0, p.y - y0) > 0.3) first = now - t0;
      if (nav.path.length) { const { PRED } = await import(GAME + 'src/net/client.ts'); maxErr = Math.max(maxErr, Math.hypot(p.x - PRED.sx, p.y - PRED.sy)); }
      if (first >= 0 && nav.path.length) steps.push(Math.hypot(p.x - lx, p.y - ly) / Math.max(1, now - lt) * 16.7);
      lx = p.x; ly = p.y; lt = now;
    }
    res.lat.push(Math.round(first));
    if (steps.length > 10) {
      const s = [...steps].sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)];
      res.moving += steps.length;
      for (const v of steps) { if (v < med * 0.25) res.stalls++; if (v > med * 3) res.jumps++; }
      console.log(`  move ${k}: start latency ${Math.round(first)} ms, median step ${med.toFixed(2)} px/frame, frames ${steps.length}, max lead over server ${maxErr.toFixed(1)} px`);
    } else console.log(`  move ${k}: start latency ${Math.round(first)} ms (too few moving frames ${steps.length})`);
    setPlayerTarget(null);
    await wait(1500);
    const { PRED } = await import(GAME + 'src/net/client.ts');
    console.log(`    after stop: predicted vs server ${Math.hypot(p.x - PRED.sx, p.y - PRED.sy).toFixed(2)} px, corrections ${NET.corrections}, scale ${PRED.scale.toFixed(3)}, rtt ${Math.round(NET.rtt)}`);
  }
  console.log(`MOVE start latency avg ${Math.round(res.lat.reduce((a, b) => a + b, 0) / res.lat.length)} ms; stall frames ${res.stalls}/${res.moving} (${(res.stalls / Math.max(1, res.moving) * 100).toFixed(1)}%), jump frames ${res.jumps}`);

  // ---- 其它部队平滑度（看得见的 AI 部队） ----
  const watch = S.parties.filter((q: any) => q.id !== p.id && !q.inside);
  const hist = new Map<number, number[]>();
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 16));
    for (const q of watch) { let h = hist.get(q.id); if (!h) hist.set(q.id, h = []); h.push(q.x, q.y); }
  }
  let oStall = 0, oMove = 0;
  for (const h of hist.values()) {
    if (Math.hypot(h[h.length - 2] - h[0], h[h.length - 1] - h[1]) < 2) continue; // 这段时间基本没动的不算
    for (let i = 2; i < h.length; i += 2) { oMove++; if (Math.hypot(h[i] - h[i - 2], h[i + 1] - h[i - 1]) < 0.001) oStall++; }
  }
  console.log(`OTHERS frozen frames ${oStall}/${oMove} (${(oStall / Math.max(1, oMove) * 100).toFixed(1)}%)`);

  // ---- CPU 热点 ----
  frames.splice(0);
  const inspector = await import('node:inspector');
  const sess = new inspector.Session(); sess.connect();
  const post = (m: string, a?: any) => new Promise<any>((r, j) => sess.post(m, a ?? {}, (e: any, x: any) => e ? j(e) : r(x)));
  await post('Profiler.enable'); await post('Profiler.start');
  setPlayerTarget({ kind: 'point', x: p.x + 80, y: p.y } as any);
  await wait(8000);
  const { profile } = await post('Profiler.stop');
  const s = [...frames].sort((a, b) => a - b);
  console.log(`FRAME cpu avg ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)} ms p95 ${s[Math.floor(s.length * 0.95)].toFixed(2)} max ${s[s.length - 1].toFixed(1)} (n=${s.length}); frames >33ms: ${s.filter(x => x > 33).length}`);
  const self = new Map<string, number>();
  const dtAll = profile.timeDeltas as number[];
  const byId = new Map<number, any>(); for (const n of profile.nodes) byId.set(n.id, n);
  const hits = new Map<number, number>();
  profile.samples.forEach((id: number, i: number) => hits.set(id, (hits.get(id) ?? 0) + (dtAll[i] ?? 0)));
  for (const [id, us] of hits) { const n = byId.get(id); const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${String(cf.url).split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + us); }
  const tot = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('HOT (self time):');
  for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${(us / tot * 100).toFixed(1)}%  ${k}`);
}
