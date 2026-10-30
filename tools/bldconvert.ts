// 第二十二步：建筑画材转换 —— 外部 AI 交付的 PNG → 裁边、缩放的 webp + 尺寸登记表（src/gfx/bld2Data.ts）
// 用法：npx tsx tools/bldconvert.ts /tmp/af/fanren/art-incoming/full
// 世界尺寸 = 原图像素 × 0.502（画材中人物 215px ≈ 主角 108 世界像素）
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = process.argv[2] ?? '/tmp/af/fanren/art-incoming/full';
const OUT = new URL('../src/assets/bld2/', import.meta.url).pathname;
const OUTG = new URL('../src/assets/bldg/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true }); mkdirSync(OUTG, { recursive: true });
const STORE = 0.55;          // 存储缩放
const WORLD = 0.502;         // 原图像素 → 世界像素
const SKIP = new Set(['X12', 'X09a']);
// 墙段画材：中央是门楼，两侧是墙。截取左侧纯墙一段作可平铺墙（交替镜像以消接缝）
const WALLS = ['B13', 'B34', 'B36', 'B39', 'F9_wall', 'J03_wall', 'T06', 'X03_wall', 'X14'];

const man = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const items: any[] = ([] as any[]).concat(...Object.values(man).filter(Array.isArray) as any[]);
const byFile = new Map<string, any>(); for (const i of items) if (i?.file) byFile.set(i.file, i);

const entries: string[] = [];
const imports: string[] = [];
let total = 0, n = 0;

function alphaBox(d: Uint8ClampedArray, W: number, H: number, ignoreDark = false) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3] < 14) continue;
    if (ignoreDark && (y < 140 || (y < 175 && d[i] + d[i + 1] + d[i + 2] < 130))) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

async function writeWebp(c: any, path: string, q = 82) {
  const buf = await c.encode('webp', q);
  writeFileSync(path, buf); total += buf.length; return buf.length;
}

async function main() {
  const dir = join(SRC, 'buildings');
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  for (const f of files) {
    const meta = byFile.get('buildings/' + f);
    const id = meta?.id ?? f.replace(/\.png$/, '');
    if (SKIP.has(id)) continue;
    const key = (f.replace(/\.png$/, '').match(/^([A-Z]\d+[a-z]?(?:_wheel)?)/)?.[1] ?? id).toLowerCase();
    // 键名：B01_sect_hall → b01；F1_hall_b → f1_hall_b；J03_wall → j03_wall
    let k = key;
    if (/^[FJTX]/.test(id) && id.includes('_')) k = id.toLowerCase();
    if (/^B31_wheel/.test(f)) k = 'b31_wheel';
    const im = await loadImage(readFileSync(join(dir, f)));
    const W = im.width, H = im.height;
    const c0 = createCanvas(W, H); const g0 = c0.getContext('2d'); g0.drawImage(im, 0, 0);
    const d = g0.getImageData(0, 0, W, H).data;
    const dark = id === 'J03_wall';
    const b = alphaBox(d, W, H, dark);
    const tw = b.x1 - b.x0 + 1, th = b.y1 - b.y0 + 1;
    const ow = Math.round(tw * STORE), oh = Math.round(th * STORE);
    const c = createCanvas(ow, oh); const g = c.getContext('2d');
    (g as any).imageSmoothingQuality = 'high';
    if (dark) {
      // 去掉墙头上方的黑色杂块
      const cc = createCanvas(W, H); const gc = cc.getContext('2d'); const id2 = g0.getImageData(0, 0, W, H);
      for (let i = 0; i < id2.data.length; i += 4) { const yy = (i >> 2) / W | 0; if (yy < 140 || (yy < 175 && id2.data[i] + id2.data[i + 1] + id2.data[i + 2] < 130)) id2.data[i + 3] = 0; }
      gc.putImageData(id2, 0, 0); g.drawImage(cc, b.x0, b.y0, tw, th, 0, 0, ow, oh);
    } else g.drawImage(im, b.x0, b.y0, tw, th, 0, 0, ow, oh);
    const sz = await writeWebp(c, join(OUT, k + '.webp'));
    const e: string[] = [`w: ${(tw * WORLD).toFixed(0)}`, `h: ${(th * WORLD).toFixed(0)}`];
    // 底线：画材底边（台基最下沿）距裁边底的余量
    const base = meta?.baseline_y != null ? Math.max(0, b.y1 - meta.baseline_y) : 0;
    if (base > 2) e.push(`b: ${(base * WORLD).toFixed(0)}`);
    if (meta?.door) { const [dx, , dw] = meta.door; e.push(`door: ${(dw * WORLD).toFixed(0)}`, `dx: ${(((dx + dw / 2) - (b.x0 + tw / 2)) * WORLD).toFixed(0)}`); }
    entries.push(`  ${k}: { ${e.join(', ')} },`);
    imports.push(k);
    n++;
    console.log(k.padEnd(18), `${tw}x${th}`, '→', `${ow}x${oh}`, (sz / 1024).toFixed(0) + 'K');

    if (WALLS.includes(id)) {
      // 每列最上一个不透明像素；左缘若干列的高度即墙高，遇到明显更高（门楼）处截止
      const top = (x: number) => { for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; if (d[i + 3] >= 14 && !(dark && (y < 140 || (y < 175 && d[i] + d[i + 1] + d[i + 2] < 130)))) return y; } return H; };
      const xs = b.x0 + 6; const tops: number[] = []; for (let x = xs; x < xs + 20; x++) tops.push(top(x)); tops.sort((a, c2) => a - c2);
      const wt = tops[10];
      let xe = xs; while (xe < b.x1 && top(xe) > wt - 10) xe++;
      xe -= 8;
      const sw = xe - xs, sh = b.y1 - (wt - 4) + 1;
      if (sw < 40) { console.log('  墙段过窄，跳过', id, sw); continue; }
      const so = createCanvas(Math.round(sw * STORE), Math.round(sh * STORE)); const sg = so.getContext('2d');
      (sg as any).imageSmoothingQuality = 'high';
      if (dark) { const cc = createCanvas(W, H); const gc = cc.getContext('2d'); const id2 = g0.getImageData(0, 0, W, H); for (let i = 0; i < id2.data.length; i += 4) { const yy = (i >> 2) / W | 0; if (yy < 140 || (yy < 175 && id2.data[i] + id2.data[i + 1] + id2.data[i + 2] < 130)) id2.data[i + 3] = 0; } gc.putImageData(id2, 0, 0); sg.drawImage(cc, xs, wt - 4, sw, sh, 0, 0, so.width, so.height); }
      else sg.drawImage(im, xs, wt - 4, sw, sh, 0, 0, so.width, so.height);
      const ks = k + '_strip';
      const s2 = await writeWebp(so, join(OUT, ks + '.webp'));
      entries.push(`  ${ks}: { w: ${(sw * WORLD).toFixed(0)}, h: ${(sh * WORLD).toFixed(0)}${base > 2 ? `, b: ${(base * WORLD).toFixed(0)}` : ''} },`);
      imports.push(ks);
      console.log('  strip', ks, sw, 'x', sh, (s2 / 1024).toFixed(0) + 'K');
    }
  }
  // 地面铺装（可平铺）与圆形地饰
  const GT: [string, string, number][] = [
    ['G15b_flagstone', 'flag', 640], ['G15_flagstone', 'flag2', 640], ['G16_jadeplaza_a', 'slab', 640], ['G16_jadeplaza_b', 'jade', 640],
    ['G04_farmland_a', 'farm', 512], ['G14_road_a', 'road', 512], ['G14_road_b', 'road2', 512], ['G04_farmland_b', 'farm2', 512],
    ['L11_jade_plaza', 'd_jade', 1024], ['L13_taiji_plaza', 'd_taiji', 1024], ['L20_array_circle', 'd_array', 768],
    ['L16_spirit_field', 'd_field', 512], ['L06_flower_bed_a', 'd_flower', 512], ['L06_flower_bed_b', 'd_flower2', 512], ['D18_steps', 'd_steps', 384],
  ];
  const gEntries: string[] = [];
  for (const [f, k, s] of GT) {
    const im = await loadImage(readFileSync(join(SRC, 'ground', f + '.png')));
    const c = createCanvas(s, s); const g = c.getContext('2d'); (g as any).imageSmoothingQuality = 'high';
    g.drawImage(im, 0, 0, s, s);
    const sz = await writeWebp(c, join(OUTG, k + '.webp'), 80);
    gEntries.push(k);
    console.log('ground', k, (sz / 1024).toFixed(0) + 'K');
  }

  const ts = [
    '// 第二十二步：建筑画材（外部 AI 绘制；tools/bldconvert.ts 生成，勿手改）',
    '// w/h：裁边后在世界中的宽高（主角约 108）；b：台基底边在锚线下方的余量；door/dx：门洞宽与门心偏移（城门、山门可穿行）',
    'export interface BldDim { w: number; h: number; b?: number; door?: number; dx?: number }',
    'export const BLD2: Record<string, BldDim> = {', ...entries, '};', '',
  ].join('\n');
  writeFileSync(new URL('../src/gfx/bld2Dims.ts', import.meta.url), ts);
  const src = [
    '// 第二十二步：建筑与铺装画材（data URL 内联，按需解码）',
    ...imports.map((k, i) => `import a${i} from '../assets/bld2/${k}.webp?inline';`),
    ...gEntries.map((k, i) => `import g${i} from '../assets/bldg/${k}.webp?inline';`),
    'export const BLD2_SRC: Record<string, string> = {',
    ...imports.map((k, i) => `  ${k}: a${i},`), '};',
    'export const BLDG_SRC: Record<string, string> = {',
    ...gEntries.map((k, i) => `  ${k}: g${i},`), '};', '',
  ].join('\n');
  writeFileSync(new URL('../src/gfx/bld2Data.ts', import.meta.url), src);
  console.log('total', n, 'buildings', (total / 1048576).toFixed(2) + ' MB');
}
main();
