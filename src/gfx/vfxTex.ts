// 第二十四步：法术特效关键形态图（外部 AI 绘制）——弹头 head、拖尾 trail、爆发 burst、阵环/护盾 ring
// 画材懒加载；没加载好时返回 false，调用方退回原来的代码特效。动态（缩放、旋转、淡出、抖动）全部由代码驱动。
type G = CanvasRenderingContext2D;
let SRC: Record<string, string> | null = null, loading = false;
const IMG = new Map<string, HTMLImageElement>();

function load() {
  if (SRC || loading) return; loading = true;
  import('./vfxData').then((m) => { SRC = m.VFX_SRC; }).catch(() => { loading = false; });
}
/** 取一张特效图（已解码才返回） */
export function vfxImg(k: string): HTMLImageElement | null {
  if (!SRC) { load(); return null; }
  let im = IMG.get(k);
  if (!im) {
    const u = SRC[k]; if (!u || typeof Image === 'undefined') return null;
    im = new Image(); im.src = u; IMG.set(k, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
export function warmVfx(keys: string[]) { for (const k of keys) vfxImg(k); }

/** 投射物：拖尾（贴在弹头后方，沿速度方向拉长）+ 弹头。size = 弹头世界宽度 */
export function vfxProj(g: G, set: string, x: number, y: number, ang: number, size: number, trailLen: number, alpha = 1, t = 0): boolean {
  const head = vfxImg(set + '_head'); if (!head) return false;
  const trail = vfxImg(set + '_trail');
  g.save(); g.translate(x, y); g.rotate(ang);
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = 'source-over';
  if (trail && trailLen > 0) {
    // 拖尾：图右端最浓，接在弹头后
    g.globalAlpha = alpha * 0.85;
    const th = size * 0.9 * (1 + 0.06 * Math.sin(t * 30));
    g.drawImage(trail, -trailLen - size * 0.1, -th / 2, trailLen + size * 0.35, th);
  }
  g.globalAlpha = alpha;
  g.drawImage(head, -size * 0.6, -size / 2, size, size);
  g.globalCompositeOperation = prev;
  g.restore();
  return true;
}

/** 爆发：u 0→1，先迅速张开，后淡出；squash 压扁（贴地爆发） */
export function vfxBurst(g: G, k: string, x: number, y: number, r: number, u: number, rot = 0, squash = 1, alpha = 1): boolean {
  const im = vfxImg(k); if (!im) return false;
  const e = 1 - Math.pow(1 - Math.min(1, u * 1.6), 3);
  const sc = r * 2 * (0.45 + 0.65 * e), a = alpha * (u < 0.15 ? u / 0.15 : Math.pow(1 - (u - 0.15) / 0.85, 1.3));
  if (a <= 0.01) return true;
  g.save(); g.translate(x, y); g.scale(1, squash); g.rotate(rot + u * 0.25);
  const prev = g.globalCompositeOperation; g.globalCompositeOperation = 'source-over';
  g.globalAlpha = a; g.drawImage(im, -sc / 2, -sc / 2, sc, sc);
  g.globalCompositeOperation = prev;
  g.restore();
  return true;
}

/** 环 / 护盾：持续显示，rot 自转，squash 压扁成地面椭圆 */
export function vfxRing(g: G, k: string, x: number, y: number, r: number, alpha: number, rot = 0, squash = 1): boolean {
  const im = vfxImg(k); if (!im) return false;
  g.save(); g.translate(x, y); g.scale(1, squash); g.rotate(rot);
  const prev = g.globalCompositeOperation; g.globalCompositeOperation = 'source-over';
  g.globalAlpha = alpha; g.drawImage(im, -r, -r, r * 2, r * 2);
  g.globalCompositeOperation = prev;
  g.restore();
  return true;
}

/** 立式图（雷柱、突破光柱）：底边对齐 (x, y)，h 高 */
export function vfxColumn(g: G, k: string, x: number, y: number, h: number, alpha: number, flip = false): boolean {
  const im = vfxImg(k); if (!im) return false;
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  const prev = g.globalCompositeOperation; g.globalCompositeOperation = 'source-over';
  g.globalAlpha = alpha; g.drawImage(im, -h / 2, -h, h, h);
  g.globalCompositeOperation = prev;
  g.restore();
  return true;
}

// ------------------------------------------------------------ 按法术五行 / 颜色选图
const rgb = (col: string) => (col || '200,200,200').split(',').map(Number);
function hue(col: string) {
  const [r, g, b] = rgb(col).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.08) return -1;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
}
/** 剑气按颜色分青 / 金 / 赤 */
export function swordSet(col: string) { const h = hue(col); return h < 0 ? 'sword_qi_gold' : h < 25 || h > 320 ? 'sword_qi_red' : h < 65 ? 'sword_qi_gold' : 'sword_qi_green'; }

/** 投射物 fx → 特效图组（没有对应图的返回 null，走代码） */
export function projSet(fx: string, col: string): string | null {
  switch (fx) {
    case 'fireball': case 'flame': return 'fireball';
    case 'talisman': { const h = hue(col); return h >= 0 && (h < 45 || h > 330) ? 'fireball' : h > 170 && h < 260 ? 'ice_cone' : 'gold_arc'; }
    case 'icicle': case 'icefire': return 'ice_cone';
    case 'sword': return swordSet(col);
    case 'gold': case 'goldthunder': return 'gold_arc';
    case 'wind': case 'leaf': return 'wind_blade';
    case 'needle': { const h = hue(col); return h > 70 && h < 170 || (h > 260 && h < 320) ? 'poison_arrow' : null; }
    case 'crow': { const h = hue(col); return h >= 0 && (h < 50 || h > 330) ? 'fire_bird' : 'soul_wisp'; }
    case 'ghost': case 'mind': return 'soul_wisp';
    default: return null;
  }
}
/** 命中 / 爆发图 */
export function burstKey(fx: string | undefined, col: string, school?: string): string {
  switch (fx) {
    case 'fireball': case 'flame': case 'firesnake': case 'dragon': return 'fireball_burst';
    case 'talisman': { const p = projSet('talisman', col); return p === 'fireball' ? 'fireball_burst' : p === 'ice_cone' ? 'ice_cone_burst' : 'gold_arc_burst'; }
    case 'icicle': case 'icefire': return 'ice_cone_burst';
    case 'frost': return 'ice_freeze_burst';
    case 'sword': case 'bigsword': return swordSet(col) + '_burst';
    case 'gold': return 'gold_arc_burst';
    case 'goldthunder': return 'thunder_gold_burst';
    case 'lightning': return 'thunder_blue_burst';
    case 'wind': case 'leaf': case 'tornado': return 'wind_blade_burst';
    case 'needle': return projSet('needle', col) ? 'poison_arrow_burst' : 'hit_spark_burst';
    case 'crow': return projSet('crow', col) === 'fire_bird' ? 'fireball_burst' : 'soul_wisp_burst';
    case 'ghost': case 'mind': return 'soul_wisp_burst';
    case 'blood': return 'blood_burst_burst';
    case 'vine': return 'wood_vines_burst';
    case 'rock': return 'earth_spike_burst';
    default:
      if (school === '火') return 'fireball_burst';
      if (school === '冰') return 'ice_cone_burst';
      if (school === '雷') return 'thunder_blue_burst';
      if (school === '剑') return swordSet(col) + '_burst';
      return 'hit_spark_burst';
  }
}
/** 护盾图：金钟罩 / 水盾 / 五行 / 魔气 */
export function shieldKey(fx: string | undefined, col: string): string {
  if (fx === 'frost' || fx === 'water') return 'shield_blue_ring';
  if (fx === 'vine' || fx === 'leaf') return 'shield_five_ring';
  if (fx === 'blood' || fx === 'ghost' || fx === 'devil') return 'shield_black_ring';
  const h = hue(col);
  if (h < 0) return 'shield_five_ring';
  if (h > 170 && h < 250) return 'shield_blue_ring';
  if (h >= 250 || h < 15) return 'shield_black_ring';
  return 'shield_gold_ring';
}
