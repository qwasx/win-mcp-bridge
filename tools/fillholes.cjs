// 填补部件内部的透明小孔（从边界泛洪不可达的透明像素 → 用邻近不透明像素颜色填）
// 用法: node tools/fillholes.cjs a.webp [b.webp ...]
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os');
for (const f of process.argv.slice(2)) {
  const [W, H] = execFileSync('identify', ['-format', '%w %h', f]).toString().split(' ').map(Number);
  const b = execFileSync('convert', [f, '-depth', '8', 'rgba:-'], { maxBuffer: 1 << 28 });
  const seen = new Uint8Array(W * H), st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const p = st.pop(); if (seen[p] || b[p * 4 + 3] > 140) continue; seen[p] = 1; const x = p % W, y = (p / W) | 0;
    if (x > 0) st.push(p - 1); if (x < W - 1) st.push(p + 1); if (y > 0) st.push(p - W); if (y < H - 1) st.push(p + W); }
  let n = 0;
  for (let pass = 0; pass < 40; pass++) {
    let changed = 0;
    for (let p = 0; p < W * H; p++) {
      if (seen[p] || b[p * 4 + 3] > 140) continue;
      const x = p % W, y = (p / W) | 0; let r = 0, g = 0, bl = 0, c = 0;
      for (const q of [p - 1, p + 1, p - W, p + W]) { const qx = q % W; if (q < 0 || q >= W * H || Math.abs(qx - x) > 1) continue; if (b[q * 4 + 3] > 140) { r += b[q * 4]; g += b[q * 4 + 1]; bl += b[q * 4 + 2]; c++; } }
      if (c) { b[p * 4] = r / c; b[p * 4 + 1] = g / c; b[p * 4 + 2] = bl / c; b[p * 4 + 3] = 255; changed++; n++; }
    }
    if (!changed) break;
  }
  const tmp = os.tmpdir() + '/fh.rgba'; fs.writeFileSync(tmp, b);
  execFileSync('convert', ['-size', `${W}x${H}`, '-depth', '8', 'rgba:' + tmp, '-define', 'webp:alpha-quality=90', '-quality', '84', f]);
  console.log(f, 'filled', n);
}
