// 用法: run.sh s_perf.ts —— 千人大战逻辑耗时（N=每方人数）
export default async function (c: any) {
  const { game, snap, wait } = c;
  const { TROOPS } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/data/troops.ts');
  const { Ter } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/terrain.ts');
  const { settings } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/settings.ts');
  settings.fieldCap = 1000; settings.deploy = false;
  const N = Number(process.env.N ?? 500);
  const ids = Object.keys(TROOPS);
  const pick = (pre: string) => { const l = ids.filter(i => i.startsWith(pre) && TROOPS[i].tier >= 2).slice(0, 6); return l.map(id => ({ id, n: Math.round(N / l.length), w: 0, xp: 0 })); };
  const setup: any = {
    ours: pick('ming_'), theirs: pick('jin_'), enemyName: '八旗大军', enemyFaction: 'jin',
    terrain: Ter.Plain, siege: process.env.MODE === 'siege', night: false, heroFights: true,
    weather: { kind: 'clear', k: 0, storm: false }, snow: 0, season: 1, onEnd: () => {},
  };
  game.scene.sleep('World');
  game.scene.start('Battle', setup);
  await wait(1500);
  const bs = game.scene.getScene('Battle');
  console.log('field', bs.W, bs.H, 'units', bs.units.length, 'reserves', bs.reserves[0].length, bs.reserves[1].length);
  const orig = bs.sys.sceneUpdate;
  const times: number[] = [];
  bs.sys.sceneUpdate = (t: number, dt: number) => { const a = performance.now(); orig.call(bs, t, 16.7); times.push(performance.now() - a); };
  bs.order('charge');
  for (let k = 0; k < 6; k++) {
    await wait(3000);
    const s = times.splice(0); s.sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
    console.log(`t${k} frames ${s.length} upd avg ${avg.toFixed(2)}ms p95 ${(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(2)} max ${(s[s.length - 1] ?? 0).toFixed(1)} alive ${bs.units.filter((u: any) => !u.dead).length} parts ${bs.parts.length}`);
  }
  await snap('/tmp/t/shot_perf.png');
}
