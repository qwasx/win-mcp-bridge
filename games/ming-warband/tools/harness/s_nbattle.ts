// 联机实时战斗：真实客户端（jsdom + Phaser.CANVAS）走完整流程
// 注册 → 认领天命（只为布置测试）→ 召出一支金军 → 追上去 → 遭遇菜单点“亲自上阵”→ 服务器开战 →
// NetBattleScene：帧到达、插值平滑、主角本地预测移动、下令冲锋 → 结束 → 战报 → 回到大地图
// 先启动服务器：rm -rf /tmp/nb1 && PORT=8091 DATA_DIR=/tmp/nb1 node dist-server/server.mjs
// 可选：LAG=毫秒（模拟网络往返延迟）
export default async function (c: any) {
  const { game, wait, GAME, snap } = c;
  (globalThis as any).WebSocket ||= (window as any).WebSocket; (globalThis as any).location ||= window.location;
  const LAG = Number(process.env.LAG ?? 0);
  if (LAG) {
    const WS = (globalThis as any).WebSocket;
    const desc = Object.getOwnPropertyDescriptor(WS.prototype, 'onmessage')!;
    Object.defineProperty(WS.prototype, 'onmessage', { set(fn: any) { desc.set!.call(this, fn ? (ev: any) => { const d = { data: ev.data }; setTimeout(() => fn.call(this, d), LAG / 2); } : fn); }, get() { return desc.get!.call(this); } });
    const os = WS.prototype.send;
    WS.prototype.send = function (d: any) { setTimeout(() => { try { os.call(this, d); } catch { /* */ } }, LAG / 2); };
  }
  let pass = 0, fail = 0;
  const check = (name: string, ok: boolean, info: unknown = '') => { if (ok) pass++; else fail++; console.log(`${ok ? '✔' : '✘'} ${name}${info !== '' ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''}`); };
  const errs: string[] = []; const oe = console.error; console.error = (...a: any[]) => { errs.push(a.join(' ')); oe(...a); };

  const { NetBattleScene, installNetBattle } = await import(GAME + 'src/net/nbattle.ts');
  game.scene.add('NetBattle', NetBattleScene, false); installNetBattle();
  const mp = await import(GAME + 'src/ui/mp.ts');
  const { NET, send } = await import(GAME + 'src/net/client.ts');
  const G = await import(GAME + 'src/core/game.ts');
  const { setPlayerTarget } = await import(GAME + 'src/core/sim.ts');
  const { closeAll } = await import(GAME + 'src/ui/dom.ts');
  mp.setMpHooks(() => { closeAll(); game.scene.stop('World'); game.scene.start('World'); }, () => {});
  const click = (txt: string) => { const b = [...document.querySelectorAll('button')].reverse().find((x: any) => x.textContent?.includes(txt)) as any; if (!b) throw new Error('no button ' + txt); b.click(); };
  const NAME = process.env.MPNAME ?? '卢象升';
  mp.openMpLogin();
  const inputs = [...document.querySelectorAll('.mp-login input')] as HTMLInputElement[];
  inputs[0].value = NAME; inputs[1].value = 'pass1234'; inputs[2].value = 'ws://127.0.0.1:8091/ws';
  click('注册新名号');
  await wait(1500);
  click('投效');
  await wait(2500);
  const S = G.S;
  check('进入天下', NET.inWorld && !!G.player(), `${S.parties.length} 部队`);

  // 认领天命（仅用来布置测试场景）
  const fs = await import('node:fs');
  const key = /([A-Z2-9]{4}(-[A-Z2-9]{4}){3})/.exec(fs.readFileSync((process.env.DATA_DIR ?? '/tmp/nb1') + '/GM_KEY.txt', 'utf8'))?.[1];
  await wait(900);
  send({ t: 'chat', ch: 'all', text: '/天命 ' + key });
  await wait(1200);
  check('认领天命（布置测试）', NET.gmLevel >= 1);
  const gm = async (line: string) => { const n = NET.gmLog.length; const [cmd, ...args] = line.split(' '); send({ t: 'gm', cmd, args } as any); for (let i = 0; i < 60 && NET.gmLog.length === n; i++) await wait(50); return NET.gmLog[NET.gmLog.length - 1] ?? ''; };
  await gm(`noprotect ${NAME}`);
  await gm(`settroops ${NAME} ming_spear 70`);
  const castle = Object.values(S.settlements as Record<string, any>).find((s: any) => s.kind === 'castle' && s.faction === G.player().faction && !s.isPass) as any;
  await gm(`tp ${NAME} ${castle.name}`);
  await wait(800);
  const sp = await gm(`spawn jin ${castle.name} 45 jin_recruit`);
  const pid = Number(/#(\d+)/.exec(sp)?.[1]);
  check('召出一支金军', pid > 0, sp);
  await wait(1200);

  // 追上去 → 遭遇菜单
  setPlayerTarget({ kind: 'party', id: pid } as any);
  let menuBtn: any = null;
  for (let i = 0; i < 160 && !menuBtn; i++) { await wait(100); menuBtn = [...document.querySelectorAll('button')].find((b: any) => b.textContent?.includes('亲自上阵')); }
  check('追上金军：弹出遭遇菜单', !!menuBtn);
  if (!menuBtn) { console.log(`==== ${pass} 通过，${fail} 失败 ====`); return; }
  const tClick = performance.now();
  menuBtn.click();
  let bs: any = null;
  for (let i = 0; i < 100; i++) { await wait(50); if (game.scene.isActive('NetBattle')) { bs = game.scene.getScene('NetBattle'); break; } }
  check('点“亲自上阵”后进入联机战场', !!bs, `${Math.round(performance.now() - tClick)} ms（含模拟延迟 ${LAG}ms）`);
  if (!bs) { console.log(`==== ${pass} 通过，${fail} 失败 ====`); return; }
  check('大地图休眠（不在后台空耗）', game.scene.isSleeping('World'));
  await wait(600);
  check('战场上有双方单位', bs.stat.a[0] > 0 && bs.stat.a[1] > 0, bs.stat.a);
  check('拿到自己的主角', !!bs.hero && !bs.hero.dead);
  check('战斗 HUD 已打开', !!document.querySelector('.b-top'));

  // ---- 计时 + 平滑度 ----
  const upd: number[] = [];
  const orig = bs.sys.sceneUpdate;
  bs.sys.sceneUpdate = (t: number, d: number) => { const a = performance.now(); orig.call(bs, t, d); upd.push(performance.now() - a); };
  let frames = 0; const fArr: number[] = [];
  const { onNet } = await import(GAME + 'src/net/client.ts');
  let lastF = 0; onNet('bframe', () => { const n = performance.now(); if (lastF) fArr.push(n - lastF); lastF = n; frames++; });
  let corr = 0; const oc = bs.onCorr.bind(bs); bs.onCorr = (m: any) => { corr++; return oc(m); };

  // 主角：本地预测——按下 D 键后，这一帧就应该开始动（不等服务器）
  const h0 = { x: bs.hero.x, y: bs.hero.y };
  const kb = bs.input.keyboard;
  const keyD = kb.addKey('D'); keyD.isDown = true; keyD.isUp = false;
  const keys = bs.keys ?? bs.cursors;
  if (keys?.D) { keys.D.isDown = true; keys.D.isUp = false; }
  await wait(60);
  const moved1 = Math.hypot(bs.hero.x - h0.x, bs.hero.y - h0.y);
  await wait(1000);
  const moved2 = Math.hypot(bs.hero.x - h0.x, bs.hero.y - h0.y);
  keyD.isDown = false; keyD.isUp = true; if (keys?.D) { keys.D.isDown = false; keys.D.isUp = true; }
  check('主角按键即动（本地预测，60ms 内）', moved1 > 0.5, `${moved1.toFixed(1)} px / 60ms, ${moved2.toFixed(0)} px / 1s`);
  await wait(800);
  check('合法移动没有被服务器纠正', corr === 0, `纠正 ${corr} 次`);

  // 下令冲锋
  bs.order('charge');
  // 记录敌军单位每帧位移，检验插值平滑（不卡顿、不瞬移）
  const watch = bs.units.filter((u: any) => u.side === 1 && !u.dead).slice(0, 30);
  const last = new Map<any, [number, number]>(); let still = 0, movingN = 0, jumps = 0;
  const tick = setInterval(() => {
    for (const u of watch) { if (u.dead) continue; const l = last.get(u); last.set(u, [u.x, u.y]); if (!l) continue; const d = Math.hypot(u.x - l[0], u.y - l[1]); movingN++; if (d < 0.01) still++; if (d > 40) jumps++; }
  }, 16);
  await wait(4000);
  clearInterval(tick);
  check('其他单位插值平滑（无瞬移）', jumps === 0, `静止帧 ${still}/${movingN}，跳变 ${jumps}`);
  await snap('/tmp/t/shot_nbattle.png');

  // 等战斗结束
  let ended = false;
  for (let i = 0; i < 1500 && !ended; i++) { await wait(100); ended = !!bs.finished; }
  check('战斗正常结束', ended, bs.ending ? bs.ending.lines : '');
  const s = [...upd].sort((a, b) => a - b);
  const fa = [...fArr].sort((a, b) => a - b);
  console.log(`  帧：收到 ${frames} 帧，间隔 avg ${(fa.reduce((a, b) => a + b, 0) / Math.max(1, fa.length)).toFixed(1)} p95 ${(fa[Math.floor(fa.length * 0.95)] ?? 0).toFixed(1)} max ${(fa[fa.length - 1] ?? 0).toFixed(0)} ms`);
  console.log(`  客户端每帧 update：avg ${(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)).toFixed(2)} ms p95 ${(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(2)} max ${(s[s.length - 1] ?? 0).toFixed(1)}`);
  check('收到 20Hz 帧', frames > 40);
  await wait(500);
  const endBtn = document.querySelector('.b-end button') as any;
  check('结束面板出现', !!endBtn);
  endBtn?.click();
  await wait(800);
  check('回到大地图', game.scene.isActive('World') && !game.scene.isActive('NetBattle'));
  const rep = ([...document.querySelectorAll('.panel')].pop() as any)?.textContent ?? '';
  check('显示战报', /阵亡|击倒|击败|战利品/.test(rep), rep.replace(/\s+/g, ' ').slice(0, 120));
  check('战后可以继续行动（busy 清除）', !G.player().busy);
  check('没有报错', errs.length === 0, errs.slice(0, 3));
  console.log(`==== ${pass} 通过，${fail} 失败 ====`);
}
