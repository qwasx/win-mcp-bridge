// 长城截图：缺口、烽火、关隘
export default async function (c: any) {
  const { S, ws, snap } = c;
  const W = await import(c.GAME + 'src/core/wall.ts');
  const T = await import(c.GAME + 'src/core/terrain.ts');
  // 在居庸关与古北口之间拆一个缺口，点一处烽火
  const [gx, gy] = W.wallPointAtLon(116.6);
  let best = 0, bd = 1e9; W.SEGS.forEach((s: any, k: number) => { const d = Math.hypot(s.x - gx, s.y - gy); if (d < bd && s.gate < 0) { bd = d; best = k; } });
  W.breachWall(best);
  const cam = ws.cameras.main;
  cam.setZoom(1.6); cam.centerOn(gx, gy + 60);
  ws.staticDirty = true;
  await c.wait(400);
  await snap('/tmp/t/shot_wall1.png');
  const [sx, sy] = W.wallPointAtLon(119.75);
  cam.setZoom(2.2); cam.centerOn(sx, sy);
  await snap('/tmp/t/shot_wall2.png');
  cam.setZoom(0.6); cam.centerOn(1700, 700);
  await snap('/tmp/t/shot_wall3.png');
  // 通行测试
  console.log('jin->beijing', !!T.findPath(S.settlements.shengjing.x, S.settlements.shengjing.y, S.settlements.beijing.x, S.settlements.beijing.y, { f: 'jin', player: false, sneak: false }));
}
