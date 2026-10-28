// 第三阶段·活世界：世界地图上的众生（遁光往来）与新近传闻的地点
// · 已探明的地界里，能看到修士的遁光在各地来往（颜色 = 正在干嘛）；放大后标出名字与目的
// · 近两月听说的劫杀、夺宝，在地图上留个记号
// · 调试：window.__game.simDebug = true —— 全图所有人、连同去向连线（检查用）
import type { Game } from '../world/game';
import { WORLD_SCALE, ACTIVE_MAP } from '../data/world';
import type { AimK } from '../world/sim/world';

type G = CanvasRenderingContext2D;
const COL: Partial<Record<AimK | 'hunt0', string>> = {
  rob: '#d0302a', prowl: '#d0302a', hunt: '#9a2a7a', bounty: '#ff4a2a', probe: '#ff4a2a',
  trade: '#d8a020', secret: '#8a4fd0', grind: '#7a5ab0', task: '#2b6aa8', buy: '#2b8aa8',
  seclude: '#5a7a5a', home: '#6a7a6a', wander: '#4a8a6a',
};
const LEGEND: [string, string][] = [['#d0302a', '劫修拦路'], ['#9a2a7a', '追杀仇人'], ['#d8a020', '行商'], ['#8a4fd0', '寻宝猎妖'], ['#2b6aa8', '宗门差事'], ['#2b8aa8', '求购丹药'], ['#5a7a5a', '闭关 / 归家']];

export function drawSimOverlay(g: G, game: Game, X: (mx: number) => number, Y: (my: number) => number, k: number, on: (x: number, y: number, m?: number) => boolean, t: number) {
  const sim = game.npcs?.sim; if (!sim) return;
  const dbg = !!(game as any).simDebug;
  const zoomed = k > 2.2 || dbg;
  const labels: [number, number, string, string][] = [];
  for (const d of game.npcs.list) {
    if (!d.alive || (d.map ?? 'tiannan') !== ACTIVE_MAP || d.realm <= 0 || d.hidden) continue;
    if (!dbg && !game.isExplored(d.x, d.y)) continue;
    const x = X(d.x / WORLD_SCALE), y = Y(d.y / WORLD_SCALE); if (!on(x, y, 10)) continue;
    const a = d.aim, c = d.hunting || d.chasing ? '#ff4a2a' : (a ? COL[a.k] : undefined) ?? '#7a7a6a';
    const moving = a && a.at === undefined;
    if (dbg && a && moving) { g.strokeStyle = c; g.globalAlpha = 0.35; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(X(a.x / WORLD_SCALE), Y(a.y / WORLD_SCALE)); g.stroke(); g.globalAlpha = 1; }
    const r = (d.realm >= 3 ? 3.4 : d.realm >= 2 ? 2.9 : 2.3) * (zoomed ? 1.25 : 1);
    // 赶路的人：拖一道遁光尾巴（朝去向的反方向）
    if (moving && a) { const ax = X(a.x / WORLD_SCALE) - x, ay = Y(a.y / WORLD_SCALE) - y, al = Math.hypot(ax, ay) || 1, L = Math.min(al, d.realm >= 2 ? 16 : 9);
      const gr = g.createLinearGradient(x, y, x - ax / al * L, y - ay / al * L); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr; g.lineWidth = r * 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - ax / al * L, y - ay / al * L); g.stroke(); }
    if (moving && d.realm >= 2) { g.fillStyle = c; g.globalAlpha = 0.22; g.beginPath(); g.arc(x, y, r * 2.2 + Math.sin(t / 260 + d.seed) * 0.8, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    g.fillStyle = c; g.strokeStyle = 'rgba(255,250,235,0.95)'; g.lineWidth = 1.1; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    if (zoomed && (dbg || (d.realm >= 2 && moving) || d.met || d.canon)) labels.push([x, y, `${d.name}·${sim.doing(d)}`, c]);
  }
  // 新近听说的劫杀、夺宝
  const day = game.day;
  for (const e of sim.heard(60)) {
    if (e.map !== ACTIVE_MAP || day - e.day > 60 || !(e.k === 'rob' || e.k === 'kill' || e.k === 'feud' || e.k === 'treasure' || e.k === 'omen')) continue;
    const x = X(e.x / WORLD_SCALE), y = Y(e.y / WORLD_SCALE); if (!on(x, y)) continue;
    const c = e.k === 'treasure' ? '#b8802a' : e.k === 'omen' ? '#7a3a9a' : '#8a1a1a', s = 3.5;
    g.strokeStyle = c; g.lineWidth = 2; g.globalAlpha = 0.85;
    if (e.k === 'treasure' || e.k === 'omen') { g.beginPath(); g.arc(x, y, s + 1, 0, Math.PI * 2); g.stroke(); }
    else { g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke(); }
    g.globalAlpha = 1;
  }
  if (labels.length && labels.length < 260) {
    g.font = `11px 'Noto Serif SC', serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
    const placed: [number, number, number][] = [];
    for (const [x, y, s, c] of labels) {
      const w = g.measureText(s).width; if (placed.some(([px, py, pw]) => Math.abs(py - y) < 12 && x + 5 < px + pw && x + 5 + w > px)) continue;
      placed.push([x + 5, y, w]);
      g.fillStyle = 'rgba(246,239,222,0.82)'; g.fillRect(x + 4, y - 7, w + 4, 14);
      g.fillStyle = c; g.fillText(s, x + 6, y);
    }
  }
  // 图例
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `12px 'Noto Serif SC', serif`;
  const H = g.canvas.height / (g.getTransform().d || 1);
  let ly = H - LEGEND.length * 17 - 30; const lx = 12;
  g.fillStyle = 'rgba(246,239,222,0.85)'; g.fillRect(lx - 6, ly - 12, 112, LEGEND.length * 17 + 26);
  g.fillStyle = '#2b2620'; g.fillText('众生往来', lx, ly); ly += 17;
  for (const [c, n] of LEGEND) { g.fillStyle = c; g.beginPath(); g.arc(lx + 4, ly, 3.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2b2620'; g.fillText(n, lx + 14, ly); ly += 17; }
  g.strokeStyle = '#8a1a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx + 1, ly - 3); g.lineTo(lx + 7, ly + 3); g.moveTo(lx + 7, ly - 3); g.lineTo(lx + 1, ly + 3); g.stroke(); g.fillStyle = '#2b2620'; g.fillText('新近劫杀', lx + 14, ly);
}
