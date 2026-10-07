export default async function (c: any) {
  const cam = c.ws.cameras.main;
  const shots: [number, number, number, string][] = [[1.4, 0, 0, 'w1'], [2.6, 0, 0, 'w2'], [0.6, 0, 0, 'w3'], [1.6, 1880, 1880, 'w4'], [1.6, 1500, 600, 'w5'], [1.8, 2250, 1250, 'w6']];
  for (const [z, x, y, n] of shots) { cam.setZoom(z); if (x) cam.centerOn(x, y); else c.ws.centerOnPlayer(); await c.snap(`/tmp/t/shot_${n}.png`); }
}
