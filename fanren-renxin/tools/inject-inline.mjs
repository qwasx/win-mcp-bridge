// 把占位符换回 data URL；把 CSS / JS 引用的 dist/assets 文件内联，删掉文件——产物仍是“双击 index.html 即可玩”
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, rmSync } from 'fs';
import path from 'path';
const D = 'dist', A = path.join(D, 'assets');
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', svg: 'image/svg+xml' };
const durl = (f) => `data:${MIME[f.split('.').pop().toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(f).toString('base64')}`;
const map = JSON.parse(readFileSync(path.join(D, '.inl.json'), 'utf8')); unlinkSync(path.join(D, '.inl.json'));
const files = existsSync(A) ? readdirSync(A) : [];
const used = new Set();
for (const f of files.filter((f) => /\.(js|css)$/.test(f))) {
  const p = path.join(A, f); let s = readFileSync(p, 'utf8'); const parts = []; let last = 0;
  const re = /__INL(\d+)__|(?:\.\/)?(?:assets\/)?([\w.-]+\.(?:webp|png|jpe?g|gif|ogg|mp3|wav|m4a|woff2?|ttf|svg))(?=["')])/g; let m;
  while ((m = re.exec(s))) {
    let rep = null;
    if (m[1] !== undefined) rep = durl(map[+m[1]]);
    else if (files.includes(m[2])) { rep = durl(path.join(A, m[2])); used.add(m[2]); }
    if (rep === null) continue;
    parts.push(s.slice(last, m.index), rep); last = m.index + m[0].length;
  }
  parts.push(s.slice(last)); writeFileSync(p, parts.join('')); s = null;
}
for (const f of used) unlinkSync(path.join(A, f));
console.log('inlined', map.length, 'modules +', used.size, 'asset files; left:', readdirSync(A).join(' '));
