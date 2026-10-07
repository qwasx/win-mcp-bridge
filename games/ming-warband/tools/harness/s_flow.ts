export default async function (c: any) {
  const { game, wait, snap } = c;
  const { TROOPS } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/data/troops.ts');
  const { Ter } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/terrain.ts');
  const ids = Object.keys(TROOPS);
  const pick = (pre: string, n: number) => ids.filter(i => i.startsWith(pre)).slice(0, 3).map(id => ({ id, n, w: 0, xp: 0 }));
  let ended = false;
  const errs: string[] = []; const oe = console.error; console.error = (...a: any[]) => { errs.push(a.join(' ')); oe(...a); };
  for (let round = 0; round < 2; round++) {
    game.scene.sleep('World');
    game.scene.start('Battle', { ours: pick('ming_', 6), theirs: pick('jin_', 6), enemyName: '测试', enemyFaction: 'jin', terrain: Ter.Plain, siege: false, night: round === 1, heroFights: true,
      weather: { kind: 'rain', k: 0.6, storm: false }, snow: 0, season: 2,
      onEnd: () => { ended = true; game.scene.stop('Battle'); game.scene.wake('World'); } });
    await wait(1500);
    const bs = game.scene.getScene('Battle');
    bs.autoFinish();
    await wait(800);
    const b = [...document.querySelectorAll('button')].find((x: any) => x.textContent?.includes('返回大地图')) as any;
    b?.click();
    await wait(800);
    console.log('round', round, 'ended', ended, 'world active', game.scene.isActive('World'), 'minimap', (document.getElementById('minimap') as any)?.style.display);
  }
  await snap('/tmp/t/shot_flow.png');
  console.log('errors', errs.length);
}
