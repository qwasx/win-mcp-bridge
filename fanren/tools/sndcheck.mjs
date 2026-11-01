// 第三十三步：声音自检（无头 Chromium）——解锁音频、逐个场景切换，录下总输出为 WAV 并统计响度 / 削波 / 报错
// 用法: LD_LIBRARY_PATH=/tmp/al/lib node tools/sndcheck.mjs
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], headless: true, defaultViewport: { width: 960, height: 600 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push('[' + m.type() + '] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 120000 });
await p.evaluate(() => {
  window.__FANREN_NORELOAD = true; window.__FANREN_DEV = true; const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.cinema = false;
  setInterval(() => { g.hero.hp = 1; g.hero.mp = 1; g.combat.invulnT = 5; }, 100);
  const a = window.__audio; a.unlock(); a.setMode('world');
  // 录音：总线 → ScriptProcessor
  const c = a.ctx; const sp = c.createScriptProcessor(4096, 2, 2); const rec = []; window.__rec = rec;
  a.master.connect(sp); sp.connect(c.destination);
  sp.onaudioprocess = (ev) => { if (!window.__recOn) return; rec.push([new Float32Array(ev.inputBuffer.getChannelData(0)), new Float32Array(ev.inputBuffer.getChannelData(1))]); };
});
await p.waitForFunction(() => window.__audio.ready, { timeout: 120000 });
console.log('samples', await p.evaluate(() => Object.keys(window.__audio.bufs).length));
const only = process.argv[2];
const scen0 = [
  ['day', `g.teleport(251520, 147800); g.weather.kind='clear'; g.weather.k=0;`],
  ['town', `g.teleport(251520, 139200);`],
  ['rain', `g.teleport(251520, 147800); g.weather.kind='rain'; g.weather.k=1;`],
  ['combat', `g.weather.kind='clear'; g.weather.k=0; g.teleport(251520, 147800); g.debugSpawn(['wolf','redwolf','boar','wolf'], g.hero.realm, 1, 420); for (const e of g.combat.enemies) { if (Math.hypot(e.x-g.player.x, e.y-g.player.y) < 1500) e.aggro = true; }`],
  ['pursuit', `g.combat.enemies.forEach(e => e.dead = true); g.pursuit.cd = 0; g.pursuit.start({ reason: 'snd', gap: 1, force: true });`],
];
const scen = only ? scen0.filter(([n]) => only.split(',').includes(n)) : scen0;
mkdirSync('tools/out/snd', { recursive: true });
for (const [name, code] of scen) {
  const info = await p.evaluate(async (code) => {
    const g = window.__game, a = window.__audio;
    const LOC = (id) => { const L = window.__fanrenLoc(id); return L ? { x: L.x * 240, y: L.y * 240 } : { x: 251520, y: 139200 }; };
    try { new Function('g', 'LOC', code)(g, LOC); } catch (e) { return 'ERR ' + e.message; }
    window.__rec.length = 0;
    await new Promise((r) => setTimeout(r, 2500));
    window.__recOn = true;
    // 场景里每秒随便放几个招式事件
    const iv = setInterval(() => {
      const px = g.player.x, py = g.player.y;
      if (g.combat.inCombat) { g.combat.fxq.push({ k: 'hit', x: px + 200, y: py, power: 1.5 }); g.combat.vfx.push({ kind: 'strike', x: px + 300, y: py, r: 160, t: 0, dur: 0.5, color: '255,200,120', fx: 'fireball' }); }
    }, 900);
    await new Promise((r) => setTimeout(r, 9000));
    clearInterval(iv); window.__recOn = false;
    return { music: a.music.state, voices: a.voices, inCombat: g.combat.inCombat, pursuit: !!g.pursuit.cur };
  }, code);
  const pcm = await p.evaluate(() => {
    const r = window.__rec; const n = r.reduce((s, x) => s + x[0].length, 0);
    const out = new Int16Array(n * 2); let i = 0, peak = 0, sum = 0, clip = 0, nan = 0;
    for (const [L, R] of r) for (let k = 0; k < L.length; k++) {
      for (const v of [L[k], R[k]]) { if (Number.isNaN(v)) nan++; const a = Math.abs(v); if (a > peak) peak = a; if (a >= 0.999) clip++; sum += v * v; out[i++] = Math.max(-32767, Math.min(32767, Math.round(v * 32767))); }
    }
    let s = ''; const u8 = new Uint8Array(out.buffer); for (let j = 0; j < u8.length; j += 8192) s += String.fromCharCode.apply(null, u8.subarray(j, j + 8192));
    return { b64: btoa(s), n, peak, rms: Math.sqrt(sum / Math.max(1, n * 2)), clip, nan, sr: window.__audio.ctx.sampleRate };
  });
  const data = Buffer.from(pcm.b64, 'base64');
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(pcm.sr, 24); hdr.writeUInt32LE(pcm.sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(`tools/out/snd/${name}.wav`, Buffer.concat([hdr, data]));
  console.log(name, JSON.stringify(info), 'secs', (pcm.n / pcm.sr).toFixed(1), 'peak', pcm.peak.toFixed(3), 'rms', pcm.rms.toFixed(4), 'clip', pcm.clip, 'nan', pcm.nan);
}
console.log(errs.filter((e) => !/WebGL|GPU|swiftshader|GL_|Automatic fallback/i.test(e)).slice(0, 20).join('\n'));
await b.close();
