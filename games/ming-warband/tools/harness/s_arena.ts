// 用法: run.sh s_arena.ts —— 武举校场第 3 轮
export default async function (c: any) {
  const { game, snap, wait } = c;
  const A = await import('/home/user/win-mcp-bridge/games/ming-warband/src/ui/arena.ts');
  const G = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/game.ts');
  const S = (G as any).S;
  const st = S.settlements.beijing;
  A.openArena(st);
  await wait(300);
  const btns = [...document.querySelectorAll('button')].map(b => b.textContent);
  console.log('arena buttons', btns.filter(Boolean).join(' | '));
  const fightBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('上场比武')) as HTMLButtonElement;
  fightBtn.click();
  await wait(2500);
  const bs = game.scene.getScene('Battle');
  console.log('units', bs.units.map((u: any) => `${u.side}:${u.name}`).join(' '), 'phase', bs.phase, 'W', bs.W, bs.H);
  await snap('/tmp/t/shot_arena.png');
  for (let i = 0; i < 12 && !bs.finished; i++) await wait(2500);
  console.log('finished', bs.finished, 'alive', bs.units.filter((u: any) => !u.dead).map((u: any) => u.side + ':' + Math.round(u.hp)).join(' '));
}
