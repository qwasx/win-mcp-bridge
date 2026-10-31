// 第十九步：名地贴花 / 构件 / 瀑布 / 新妖兽 一览图
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createCanvas, save } = await import('./env');
const { renderLmGround, renderLmStand, drawRift, drawWhirl } = await import('../src/gfx/landmark');
const { makeFallCliff, fallGeometry, drawFallAnim } = await import('../src/gfx/waterfall');
const { drawBeast } = await import('../src/gfx/beast');
const { ENEMIES } = await import('../src/data/enemies');
const which = process.argv[2] || 'ground';
if (which === 'ground') {
  const kinds = ['ash', 'lavafield', 'lavalake', 'bloodpool', 'flowers', 'jadeplaza', 'icepath', 'lavapath', 'ghostland', 'blackpond', 'pit', 'taiji', 'scree'] as const;
  const c = createCanvas(2400, 1500); const g = c.getContext('2d') as any;
  g.fillStyle = '#8a9a6a'; g.fillRect(0, 0, c.width, c.height);
  kinds.forEach((k, i) => {
    const w = k === 'icepath' || k === 'lavapath' ? 300 : 900, h = k === 'icepath' || k === 'lavapath' ? 900 : 560;
    const s = renderLmGround(k as any, w, h, 1234 + i * 7, 0.5);
    const x = (i % 5) * 480 + 240, y = Math.floor(i / 5) * 500 + 250, kk = Math.min(460 / w, 460 / h);
    g.drawImage(s.canvas, x - s.ax * kk, y - s.ay * kk, s.w * kk, s.h * kk);
    g.fillStyle = '#000'; g.font = '20px sans-serif'; g.fillText(k, x - 200, y - 200);
  });
  save(c, 'lm19-ground.png');
} else if (which === 'stand') {
  const c = createCanvas(2400, 1400); const g = c.getContext('2d') as any;
  g.fillStyle = '#9aa078'; g.fillRect(0, 0, c.width, c.height);
  const list: any[] = [
    { k: 'stoneplat', w: 230, h: 120 }, { k: 'remains', w: 120, h: 60 }, { k: 'bloodgate', w: 300, h: 330 }, { k: 'altar', w: 560, h: 640 },
    { k: 'cave', w: 300, h: 190 }, { k: 'corpsepost', w: 60, h: 210 }, { k: 'crystal', w: 90, h: 160 }, { k: 'obelisk', w: 60, h: 200, name: '玄晶碑' }, { k: 'obelisk', w: 60, h: 200, name: '熔岩碑' },
  ];
  list.forEach((d, i) => {
    const s = renderLmStand({ ...d, seed: 77 + i * 13 }, 1)!;
    const x = (i % 5) * 470 + 240, y = Math.floor(i / 5) * 680 + 620, kk = Math.min(1, 440 / s.w, 600 / s.h);
    g.drawImage(s.canvas, x - s.ax * kk, y - s.ay * kk, s.w * kk, s.h * kk);
  });
  // wall arc
  const pts: [number, number][] = []; for (let i = 0; i <= 10; i++) { const a = -0.2 + i * 0.04; pts.push([Math.cos(a) * 3050 - 3050, Math.sin(a) * 3050 * 0.78]); }
  const ws = renderLmStand({ k: 'wall', w: 0, h: 0, seed: 5, pts } as any, 0.5)!;
  g.drawImage(ws.canvas, 2150 - ws.ax * 0.5, 1300 - ws.ay * 0.5, ws.w * 0.5, ws.h * 0.5);
  drawRift(g, 1900, 1350, 1.3, 1, 42, 1);
  drawWhirl(g, 1500, 1300, 2, 120);
  save(c, 'lm19-stand.png');
} else if (which === 'fall') {
  const c = createCanvas(2000, 1000); const g = c.getContext('2d') as any;
  g.fillStyle = '#9aa078'; g.fillRect(0, 0, c.width, c.height);
  [[520, 560, 2], [600, 680, 3], [460, 420, 1]].forEach(([w, h, tiers], i) => {
    const spec = { seed: 900 + i * 17, w, h, tiers };
    const s = makeFallCliff(spec, 1); const m = fallGeometry(spec);
    const x = 330 + i * 660, y = 860;
    g.drawImage(s.canvas, x - s.ax, y - s.ay, s.w, s.h);
    drawFallAnim(g, m, x, y, 1.7, 1, true);
  });
  save(c, 'lm19-fall.png');
} else {
  const ids = ['huochan', 'mangshou', 'canhun', 'tiehuo', 'heilin', 'yuanhun', 'shilang', 'lianshi', 'shixiong', 'shiqin', 'yinsha', 'mojiao', 'gumo_xueyan', 'yinchi'];
  const c = createCanvas(2100, 900); const g = c.getContext('2d') as any;
  g.fillStyle = '#c8c0a0'; g.fillRect(0, 0, c.width, c.height);
  ids.forEach((id, i) => {
    const d = ENEMIES[id]; if (!d?.look) { console.log('no look', id); return; }
    const x = (i % 7) * 290 + 150, y = Math.floor(i / 7) * 420 + 330;
    drawBeast(g, d.look, x, y, 1, { move: 0.5, phase: 1.2, atk: 0, hit: 0, t: 1.3, flying: d.flying }, 1.3);
    g.fillStyle = '#000'; g.font = '18px sans-serif'; g.fillText(id, x - 50, y + 60);
  });
  save(c, 'lm19-beast.png');
}
