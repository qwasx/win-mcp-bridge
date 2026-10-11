// 用法: run.sh s_god.ts —— 天命之主的金身军团：20 个民壮 vs 300 八旗巴牙喇，我方应零阵亡（含主将）
export default async function (c: any) {
  const { game, snap, wait } = c;
  const { GOD, setGod, GOD_DEFAULT } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/god.ts');
  const { Ter } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/terrain.ts');
  let out: any = null;
  setGod({ ...GOD_DEFAULT, on: true, oneHit: process.env.ONEHIT === '1' });
  console.log('GOD', JSON.stringify(GOD));
  const setup: any = {
    ours: [{ id: process.env.OURS ?? 'ming_recruit', n: 20, w: 0, xp: 0 }], theirs: [{ id: 'jin_bayara', n: +(process.env.EN ?? 150), w: 0, xp: 0 }, { id: 'jin_hca', n: +(process.env.EN ?? 150), w: 0, xp: 0 }],
    enemyName: '正黄旗巴牙喇', enemyFaction: 'jin', terrain: Ter.Plain, siege: false, night: false, heroFights: true,
    weather: { kind: 'clear', k: 0, storm: false }, snow: 0, season: 2,
    onEnd: (r: any) => { out = r; console.log('battle end', JSON.stringify(r).slice(0, 300)); },
  };
  game.scene.sleep('World');
  game.scene.start('Battle', setup);
  await wait(1500);
  const bs = game.scene.getScene('Battle');
  if (bs.phase === 'deploy') bs.startFight();
  bs.order('charge');
  const stat = () => { const a = bs.units.filter((u: any) => u.side === 0), b = bs.units.filter((u: any) => u.side === 1); return { ours: a.length, oursDead: a.filter((u: any) => u.dead).length, oursHurt: a.filter((u: any) => !u.dead && u.hp < u.maxHp).length, enemy: b.length, enemyDead: b.filter((u: any) => u.dead).length, enemyRouted: b.filter((u: any) => u.routed).length, ax: Math.round(a.reduce((n: number, u: any) => n + u.x, 0) / a.length), bx: Math.round(b.reduce((n: number, u: any) => n + u.x, 0) / b.length), phase: bs.phase, over: bs.over ?? bs.ended }; };
  for (let i = 0; i < +(process.env.STEPS ?? 8); i++) { await wait(2500); console.log('t', (i + 1) * 2.5, JSON.stringify(stat())); }
  await snap('/tmp/t/shot_god.png');
  if (!bs.finished) { console.log('autoFinish…'); bs.autoFinish(); }
  await wait(500);
  const btn = document.querySelector('.b-end button') as any;
  console.log('end panel button:', btn?.textContent); btn?.click(); await wait(300);
  const lost = out ? Object.values(out.ourDown).reduce((n: number, k: any) => n + k, 0) : -1, killed = out ? Object.values(out.enemyDown).reduce((n: number, k: any) => n + k, 0) : 0;
  console.log(out?.win ? 'PASS 胜利' : 'FAIL 未胜', lost === 0 && !out?.heroDown ? 'PASS 我方零伤亡' : 'FAIL 我方伤亡 ' + lost, killed > 0 ? `PASS 歼敌 ${killed}` : 'FAIL 敌军无伤亡');

  setGod(null);
}
