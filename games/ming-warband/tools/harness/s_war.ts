// 用法: MODE=field|siege|defend|deploy N=每兵种人数 run.sh s_war.ts —— 大战场 / 攻城 / 守城测试
export default async function (c: any) {
  const { game, snap, wait } = c;
  const G = '/home/user/win-mcp-bridge/games/ming-warband/src/';
  const { TROOPS } = await import(G + 'data/troops.ts');
  const { Ter } = await import(G + 'core/terrain.ts');
  const ids = Object.keys(TROOPS);
  const N = Number(process.env.N ?? 30);
  const pick = (pre: string, n: number) => ids.filter(i => i.startsWith(pre)).slice(0, 5).map(id => ({ id, n, w: 0, xp: 0 }));
  const mode = process.env.MODE ?? 'field';
  const siege = mode === 'siege' || mode === 'defend';
  let ended: any = null;
  const setup: any = {
    ours: pick('ming_', N), theirs: pick('jin_', Number(process.env.NT ?? N)), enemyName: siege && mode === 'siege' ? '宁远守军' : '镶黄旗', enemyFaction: 'jin',
    terrain: Number(process.env.TER ?? Ter.Plain), siege, defend: mode === 'defend', town: true,
    kit: { ladders: 4, ram: true, cannons: 2, mine: true }, defGuns: 2,
    night: mode === 'night', heroFights: true, weather: { kind: 'clear', k: 0, storm: false }, snow: 0, season: 2,
    allies: process.env.ALLY ? [{ pid: '77', name: '友军', stacks: pick('ming_', 10) }] : undefined,
    onEnd: (o: any) => { ended = o; },
  };
  const t0 = Date.now();
  game.scene.sleep('World');
  game.scene.start('Battle', setup);
  await wait(800);
  const bs = game.scene.getScene('Battle');
  console.log('field', bs.W, bs.H, 'units', bs.units.length, 'create ms', Date.now() - t0, 'river', !!bs.F.river, 'hills', bs.F.hills.length, 'groves', bs.F.groves.length, 'boxes', bs.F.boxes.length);
  if (mode === 'deploy') { await snap('/tmp/t/shot_w_deploy.png'); return; }
  const tally: Record<string, number> = {};
  if (process.env.DBG) {
    const T = (k: string, v: number) => { tally[k] = (tally[k] || 0) + v; };
    const od = bs.damage.bind(bs), oh = bs.hurt.bind(bs), of = bs.fire.bind(bs), ok = bs.kill.bind(bs);
    bs.damage = (a: any, t: any, raw: number, hc: number, ha?: boolean, af?: number, src = 'melee') => { T(`dmgcall ${a.side}${a.onWall ? 'W' : 'G'}>${t.onWall ? 'W' : 'G'} ${src}`, 1); return od(a, t, raw, hc, ha, af, src); };
    bs.hurt = (t: any, d: number, by: any) => { T(`hurt ${by ? by.side : '-'}>${t.side}${t.onWall ? 'W' : t.trans ? 'T' : 'G'} ${Math.round(d)>40?'big':'sm'}`, 1); return oh(t, d, by); };
    bs.fire = (u: any, a: number, d?: number) => { T(`fire ${u.side}${u.onWall ? 'W' : 'G'} ${u.kind}`, 1); return of(u, a, d); };
    bs.kill = (u: any, by: any) => { T(`KILL ${by ? by.side + (by.onWall ? 'W' : 'G') + (by.trans?'T':'') : '-'}>${u.side}${u.onWall ? 'W' : u.trans ? 'T' : 'G'}`, 1); return ok(u, by); };
  }
  bs.startFight();
  if (mode !== 'defend') bs.order('charge');
  const secs = Number(process.env.T ?? 30);
  for (let i = 0; i < secs; i += 5) {
    await wait(5000);
    const a = bs.units.filter((u: any) => u.side === 0 && !u.dead && !u.fled).length, b = bs.units.filter((u: any) => u.side === 1 && !u.dead && !u.fled).length;
    const ctl = bs.siegeCtl;
    console.log(`t=${i + 5}s ours=${a} theirs=${b}`, ctl ? `gate=${Math.round(ctl.gate.hp)} ladders=${ctl.ladders.map((l: any) => l.state).join(',')} ram=${ctl.ram ? Math.round(ctl.ram.hp) : '-'} onWallAtt=${bs.units.filter((u: any) => u.side === bs.att && u.onWall && !u.dead).length} breaches=${bs.F.siege.sections.filter((s: any) => s.broken).length} mine=${ctl.mine ? Math.round(ctl.mine.t) : '-'}` : '', 'fps-ish', Math.round(game.loop.actualFps));
    if (process.env.DBG) for (const u of bs.units.filter((u: any) => u.side === (process.env.DSIDE ? Number(process.env.DSIDE) : bs.att) && u.rng > 0 && !u.dead).slice(0, 4)) console.log('  arc', Math.round(u.x), Math.round(u.y), 'ammo', u.ammo, 'rcd', u.rcd?.toFixed(1), 'task', u.task?.kind, 'tgt', u.target ? [Math.round(u.target.x), Math.round(u.target.y), u.target.onWall, Math.round(Math.hypot(u.target.x - u.x, u.target.y - u.y))] : null, 'range', u.range, 'order', bs.orderOf(u), 'wallX', bs.F.siege.wallX, 'tr', !!u.trans, 'onWall', u.onWall, 'hgt', u.hgt, 'tgtH', u.target?.hgt, 'aim', u.aiming);
    if (ended) break;
  }
  if (process.env.DBG) {
    const wx = bs.F.siege?.wallX ?? 0; const hist: Record<string, number> = {};
    for (const u of bs.units) if (!u.dead && !u.fled) { const k = `s${u.side} ${u.cls}${u.mounted ? 'M' : ''} ${u.onWall ? 'WALL' : u.trans ? 'TRANS:' + u.trans.kind : u.x < wx ? 'out' : 'in'} r${u.routed ? 1 : 0} task:${u.task?.kind ?? '-'} tgt:${u.target ? (u.target.dead ? 'dead' : u.target.onWall ? 'W' : 'G') : '-'} ord:${bs.orderOf(u)}`; hist[k] = (hist[k] || 0) + 1; }
    console.log(Object.entries(hist).sort().map(e => e.join(' = ')).join('\n'));
    const sm = bs.units.filter((u: any) => u.side === 1 && !u.dead && !u.fled).slice(0, 6).map((u: any) => [Math.round(u.x - wx), Math.round(u.y), u.onWall, Math.round(u.vx), u.target && Math.round(Math.hypot(u.target.x - u.x, u.target.y - u.y))]);
    console.log('def sample', JSON.stringify(sm), 'passages', bs.F.passages().length, 'passN', bs.passN);
  }
  if (process.env.DBG) console.log(Object.entries(tally).sort().map(e => e.join(': ')).join('\n'));
  const cam = bs.cameras.main;
  if (siege) { cam.setZoom(0.9); cam.centerOn(bs.F.siege.wallX - 100, bs.F.siege.gateMid); }
  await snap(`/tmp/t/shot_w_${mode}.png`);
  cam.setZoom(bs.minZoom()); cam.centerOn(bs.W / 2, bs.H / 2);
  await snap(`/tmp/t/shot_w_${mode}_all.png`);
  console.log('ended', ended ? JSON.stringify({ win: ended.win, ourDown: ended.ourDown, by: Object.keys(ended.downBy ?? {}) }) : 'no');
}
