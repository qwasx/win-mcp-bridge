export default async function (c: any) {
  const { ws, snap, wait } = c; const S = (await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/game.ts')).S;
  const cam = ws.cameras.main;
  // 长江下游白天
  cam.setZoom(1.8); cam.centerOn(2560, 1720); S.time = 24 * 5 + 7; await wait(600); await snap('/tmp/t/shot_l1.png');
  // 夜晚城镇
  S.time = 24 * 5 + 23; c.ws.centerOnPlayer(); cam.setZoom(1.6); await wait(600); await snap('/tmp/t/shot_l2.png');
  // 雨 / 雪：强制天气
  const fx = (await import('/home/user/win-mcp-bridge/games/ming-warband/src/art/weatherFx.ts')).weatherFx;
  const wmod = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/weather.ts');
  let found: any = null;
  for (let t = 0; t < 24 * 360 && !found; t += 6) { const w = wmod.weatherAt(c.player().x, c.player().y, t); if (w.kind === 'rain' && w.k > 0.7) found = t; }
  console.log('rain at', found);
  S.time = found + 1; await wait(3500); await snap('/tmp/t/shot_l3.png');
  let sn: any = null;
  for (let t = 0; t < 24 * 360 && sn === null; t += 6) { const w = wmod.weatherAt(1700, 900, t); if (w.kind === 'snow' && w.k > 0.6) sn = t; }
  console.log('snow at', sn);
  const pp = c.player(); pp.x = 1700; pp.y = 900; S.time = sn + 1; c.ws.centerOnPlayer(); await wait(4000); await snap('/tmp/t/shot_l4.png');
  // 统计
  const kinds: Record<string, number> = {};
  for (let t = 0; t < 24 * 360; t += 6) { const w = wmod.weatherAt(1900, 1700, t); const k = w.k < 0.08 ? 'clear' : w.kind; kinds[k] = (kinds[k] || 0) + 1; }
  console.log('central year', JSON.stringify(kinds));
}
