export default async function (c: any) {
  const { settlementVista } = await import('/home/user/win-mcp-bridge/games/ming-warband/src/art/vista.ts');
  const { createCanvas } = await import('@napi-rs/canvas');
  const cases: any[] = [
    { kind: 'town', hour: 10, season: 1, weather: { kind: 'clear', k: 0 }, color: 0xc0392b, capital: true, south: false },
    { kind: 'town', hour: 22, season: 3, weather: { kind: 'snow', k: 0.7 }, color: 0x2f6db5, capital: false, south: false },
    { kind: 'castle', hour: 18, season: 2, weather: { kind: 'clear', k: 0 }, color: 0xd88a1c, capital: false, south: false, siege: true },
    { kind: 'village', hour: 8, season: 0, weather: { kind: 'clear', k: 0 }, color: 0x7d4fa3, south: true },
    { kind: 'village', hour: 14, season: 1, weather: { kind: 'rain', k: 0.8 }, color: 0x2e9c6a, south: false, looted: true },
  ];
  const out = createCanvas(560, 150 * cases.length);
  const ctx = out.getContext('2d');
  cases.forEach((o, i) => { const cv = settlementVista({ seed: 1234 + i * 77, looted: false, siege: false, ...o }); ctx.drawImage((globalThis as any).__napiOf(cv) ?? cv, 0, i * 150); });
  (await import('fs')).writeFileSync('/tmp/t/shot_vista.png', out.toBuffer('image/png'));
  console.log('ok');
}
