// 关外截图：蒙古包营地与新城堡
export default async function (c: any) {
  const { ws, snap } = c;
  const S = (await import(c.GAME + 'src/core/game.ts')).S;
  const cam = ws.cameras.main;
  const a = S.settlements.c_ongniud, b = S.settlements.harqin;
  cam.setZoom(2.4); cam.centerOn(a.x, a.y);
  ws.staticDirty = true;
  await c.wait(400);
  await snap('/tmp/t/shot_camp1.png');
  cam.setZoom(0.9); cam.centerOn((a.x + b.x) / 2 + 150, b.y - 120);
  await c.wait(200);
  await snap('/tmp/t/shot_camp2.png');
}
