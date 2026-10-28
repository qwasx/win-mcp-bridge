const { execFileSync } = require('child_process');
const fs = require('fs');
// 用法: node tools/key.cjs <源PNG目录> <输出webp目录> [默认最大边] [name=最大边 ...]
const path = require('path');
const [srcA, dstA, defA, ...ov] = process.argv.slice(2);
if (!srcA || !dstA) { console.log('usage: node tools/key.cjs <srcDir> <dstDir> [defaultMax] [name=max ...]'); process.exit(1); }
const src = path.resolve(srcA) + '/', dst = path.resolve(dstA) + '/';
fs.mkdirSync(dst, { recursive: true });
const MAXW = Object.fromEntries(ov.map((x) => { const [k, v] = x.split('='); return [k, +v]; }));
const DEF = +(defA || 760);
const meta = {};
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.png'))) {
  const [W, H] = execFileSync('identify', ['-format', '%w %h', src + f]).toString().split(' ').map(Number);
  const buf = execFileSync('convert', [src + f, '-depth', '8', 'rgba:-'], { maxBuffer: 1 << 28 });
  // 键色：四角取样平均
  const at = (x, y) => { const i = (y * W + x) * 4; return [buf[i], buf[i + 1], buf[i + 2]]; };
  const cs = [at(4, 4), at(W - 5, 4), at(4, H - 5), at(W - 5, H - 5)];
  const K = [0, 1, 2].map((c) => cs.reduce((s, v) => s + v[c], 0) / 4);
  const green = K[1] > K[0] && K[1] > K[2];
  const out = Buffer.alloc(W * H * 4);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const m = green ? g - Math.max(r, b) : Math.min(r, b) - g;   // 键色占优程度
    const mK = green ? K[1] - Math.max(K[0], K[2]) : Math.min(K[0], K[2]) - K[1];
    let a = 1 - (m - mK * 0.18) / (mK * 0.62);
    a = Math.max(0, Math.min(1, a));
    if (a < 0.02) { out[i + 3] = 0; continue; }
    // 反混合：c = a·F + (1-a)·K
    const F = [r, g, b].map((c, k) => Math.max(0, Math.min(255, (c - (1 - a) * K[k]) / a)));
    // 残余溢色压制
    if (green) { const mx = Math.max(F[0], F[2]); if (F[1] > mx) F[1] = mx + (F[1] - mx) * 0.3; }
    else { const mn = Math.min(F[0], F[2]); if (mn > F[1]) { const s = (mn - F[1]) * 0.7; F[0] -= s; F[2] -= s; } }
    out[i] = F[0]; out[i + 1] = F[1]; out[i + 2] = F[2]; out[i + 3] = Math.round(a * 255);
    if (a > 0.3) { const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // 去掉孤立噪点：bbox 已按 a>0.3 统计
  const name = f.replace('.png', '');
  const tmp = require('os').tmpdir() + '/key_' + name + '.rgba';
  fs.writeFileSync(tmp, out);
  const cw = x1 - x0 + 3, ch = y1 - y0 + 3;
  const maxW = MAXW[name] ?? DEF;
  execFileSync('convert', ['-size', `${W}x${H}`, '-depth', '8', 'rgba:' + tmp, '-crop', `${cw}x${ch}+${x0 - 1}+${y0 - 1}`, '+repage',
    '-resize', `${maxW}x${maxW}>`, '-define', 'webp:alpha-quality=90', '-quality', '84', dst + name + '.webp']);
  const [w2, h2] = execFileSync('identify', ['-format', '%w %h', dst + name + '.webp']).toString().split(' ').map(Number);
  meta[name] = [w2, h2];
  console.log(name, green ? 'G' : 'M', K.map(Math.round).join(','), '->', w2 + 'x' + h2, fs.statSync(dst + name + '.webp').size);
}
fs.writeFileSync(dst + '_meta.json', JSON.stringify(meta));
