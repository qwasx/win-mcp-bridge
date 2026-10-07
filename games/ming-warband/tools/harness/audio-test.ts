// 离线渲染全部音效与配乐，检查峰值/响度并输出频谱图与 WAV
// 运行：LD_LIBRARY_PATH=/tmp/t/stub npx tsx audio-test.ts
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { createCanvas } from '@napi-rs/canvas';
const req = createRequire(import.meta.url);
const WA = req('node-web-audio-api');
const GAME = process.env.GAME_DIR ?? '/home/user/win-mcp-bridge/games/ming-warband/';
const G: any = globalThis;
G.document = { addEventListener() {}, hidden: false };
G.window = G; G.localStorage = { getItem: () => null, setItem() {} };
const SR = 44100;
let DUR = 3;
G.AudioContext = class extends WA.OfflineAudioContext { constructor() { super(2, Math.floor(SR * DUR), SR); Object.defineProperty(this, 'state', { get: () => 'running' }); } };
const { engine } = await import(GAME + 'src/audio/engine.ts');
const { sfx } = await import(GAME + 'src/audio/sfx.ts');

function stats(buf: any) {
  let peak = 0, sum = 0, n = 0; const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
  for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (v > peak) peak = v; sum += L[i] * L[i]; n++; }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) };
}
function wav(buf: any, file: string) {
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1), n = L.length;
  const b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.max(-1, Math.min(1, L[i])) * 32767 | 0, 44 + i * 4); b.writeInt16LE(Math.max(-1, Math.min(1, Rr[i])) * 32767 | 0, 46 + i * 4); }
  writeFileSync(file, b);
}
function spectro(buf: any, file: string, title: string) {
  const d = buf.getChannelData(0); const W = 900, H = 260, N = 1024;
  const c = createCanvas(W, H + 20); const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H + 20);
  x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText(title, 4, H + 15);
  const hop = Math.max(1, Math.floor((d.length - N) / W));
  for (let col = 0; col < W; col++) {
    const off = col * hop; if (off + N > d.length) break;
    // 对数频率轴的简易 DFT（只算 H 个频点）
    for (let row = 0; row < H; row += 2) {
      const f = 40 * Math.pow(12000 / 40, 1 - row / H);
      let re = 0, im = 0; const w = 2 * Math.PI * f / SR;
      for (let i = 0; i < N; i += 2) { const win = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); const v = d[off + i] * win; re += v * Math.cos(w * i); im -= v * Math.sin(w * i); }
      const mag = Math.sqrt(re * re + im * im);
      const db = Math.max(0, Math.min(1, (20 * Math.log10(mag + 1e-9) + 50) / 60));
      x.fillStyle = `hsl(${240 - db * 240},100%,${db * 55}%)`; x.fillRect(col, row, 1, 2);
    }
  }
  writeFileSync(file, c.toBuffer('image/png'));
}

const mode = process.argv[2] ?? 'sfx';
if (mode === 'sfx') {
  const names = ['clash', 'armor', 'hit', 'block', 'swing', 'bow', 'xbow', 'arrowHit', 'arrowGround', 'gun', 'cannon', 'death', 'shout', 'crowd', 'horn', 'drum', 'drumRoll', 'smallDrum', 'gong', 'gongLow', 'click', 'woodblock', 'page', 'coin', 'bell', 'levelup', 'quest', 'victory', 'defeat', 'neigh', 'gallop', 'fall', 'error'];
  for (const n of names) {
    DUR = ['victory', 'defeat', 'gong', 'gongLow', 'bell'].includes(n) ? 6 : 3;
    engine.ctx = null; engine.failed = false;
    const c = engine.ensure()!;
    sfx(n as any, { vol: 1 });
    const buf = await c.startRendering();
    const s = stats(buf);
    console.log(n.padEnd(12), JSON.stringify(s), s.peak < 0.01 ? 'SILENT!' : s.peak > 0.99 ? 'CLIP?' : '');
    if (process.env.WAV) wav(buf, `/tmp/t/sfx_${n}.wav`);
  }
} else {
  DUR = Number(process.env.SEC ?? 30);
  engine.ctx = null; engine.failed = false;
  const c = engine.ensure()!;
  const { music } = await import(GAME + 'src/audio/music.ts');
  music.play(mode as any);
  const tr: any = (music as any).cur;
  tr.next = 0.2;
  while (tr.next < DUR - 1) { tr.render(tr.next); tr.next += tr.spb * 4; tr.bar++; }
  const buf = await c.startRendering();
  console.log(mode, JSON.stringify(stats(buf)), 'bars', tr.bar);
  wav(buf, `/tmp/t/music_${mode}.wav`);
  spectro(buf, `/tmp/t/spec_${mode}.png`, mode);
}
process.exit(0);
