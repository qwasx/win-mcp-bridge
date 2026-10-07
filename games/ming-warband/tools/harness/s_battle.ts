// 用法: run.sh s_battle.ts  —— 环境变量 MODE=snow|rain|night|siege|day
export default async function (c: any) {
  const { game, snap, wait } = c;
  const { TROOPS } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/data/troops.ts');
  const { Ter } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/terrain.ts');
  const ids = Object.keys(TROOPS);
  const pick = (pre: string, n: number) => ids.filter(i => i.startsWith(pre)).slice(0, 4).map(id => ({ id, n, w: 0, xp: 0 }));
  const mode = process.env.MODE ?? 'day';
  const setup: any = {
    ours: pick('ming_', 14), theirs: pick('jin_', 14), enemyName: '镶黄旗前锋', enemyFaction: 'jin',
    terrain: Ter.Plain, siege: mode === 'siege', night: mode === 'night' || mode === 'siege', heroFights: true,
    weather: mode === 'rain' ? { kind: 'rain', k: 0.9, storm: true } : mode === 'snow' ? { kind: 'snow', k: 0.8, storm: false } : { kind: 'clear', k: 0, storm: false },
    snow: mode === 'snow' ? 0.9 : 0, season: mode === 'snow' ? 3 : mode === 'day' ? 2 : 1,
    onEnd: () => console.log('battle end'),
  };
  game.scene.sleep('World');
  game.scene.start('Battle', setup);
  await wait(1500);
  const bs = game.scene.getScene('Battle');
  bs.order('charge');
  for (let i = 0; i < 4; i++) { await wait(2500); }
  await snap(`/tmp/t/shot_b_${mode}.png`);
  if (process.env.ZOOM) { bs.cameras.main.setZoom(Number(process.env.ZOOM)); const tr = bs.props.find((p: any) => p.tree); if (tr) bs.cameras.main.centerOn(tr.x, tr.y - 30); await snap(`/tmp/t/shot_b_${mode}_z.png`); }
  console.log('units alive', bs.units.filter((u: any) => !u.dead).length, 'parts', bs.parts.length, 'torches', bs.torches.length);
}
