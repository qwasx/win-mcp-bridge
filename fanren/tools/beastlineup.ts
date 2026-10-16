// 贴图妖兽体型校准：每格 = 主角（1.12）｜原程序妖兽（淡）｜贴图妖兽。用法：npx tsx tools/beastlineup.ts [过滤前缀] [输出名]
import { createCanvas, save } from './env';
import { loadImage } from '@napi-rs/canvas';
import { readdirSync } from 'fs';
import { CharState, drawCharacter, HANLI_LOOK } from '../src/gfx/character';
import { drawBeast } from '../src/gfx/beast';
import { BEAST_SPR, drawBeastSprite, __injectBeastImages, warmBeastTex, pumpBeastTex } from '../src/gfx/beastTex';
import { ENEMIES } from '../src/data/enemies';

(async () => {
  const dir = new URL('../src/assets/beasts/', import.meta.url);
  const m: any = {};
  for (const f of readdirSync(dir)) m[f.replace('.webp', '')] = await loadImage(new URL(f, dir).pathname);
  __injectBeastImages(m);
  const pre = process.argv[2] || '';
  const keys = Object.keys(BEAST_SPR).filter((k) => k.startsWith(pre));
  warmBeastTex(keys); for (let i = 0; i < keys.length + 2; i++) pumpBeastTex();
  const K = +(process.env.K || 0.5), cw = 560, ch = 440, cols = +(process.env.COLS || 6);
  const rows = Math.ceil(keys.length / cols);
  const c = createCanvas(cw * cols * K, ch * rows * K);
  const g = c.getContext('2d') as any;
  g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
  g.scale(K, K);
  keys.forEach((k, i) => {
    const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch, base = oy + ch - 40;
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.strokeRect(ox, oy, cw, ch);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(ox, base); g.lineTo(ox + cw, base); g.stroke();
    const st = new CharState(ox + 50, base); st.yaw = st.targetYaw = Math.PI / 2; st.setAction('idle'); st.blend = 1;
    for (let j = 0; j < 30; j++) { st.update(1 / 60); drawCharacter(g, HANLI_LOOK, st, 1.12, 1 / 60); }
    g.fillStyle = '#e9dfc6'; g.fillRect(ox + 1, oy + 1, 110, ch - 2);
    drawCharacter(g, HANLI_LOOK, st, 1.12, 0);
    const id = k.slice(2), def = k[0] === 'e' ? ENEMIES[id] : null;
    const A = { move: +(process.env.MOVE || 0), phase: 0.8, atk: +(process.env.ATK || 0), hit: +(process.env.HIT || 0), t: 0.3, flying: !!def?.flying };
    if (def?.look) { g.save(); g.globalAlpha = 0.35; drawBeast(g, def.look, ox + 190, base, -1, A as any, 1); g.restore(); }
    drawBeastSprite(g, k, ox + 420, base, -1, A as any, 1);
    g.fillStyle = '#000'; g.font = '22px sans-serif'; g.fillText(k, ox + 8, oy + 24);
  });
  save(c, process.argv[3] || 'lineup.png');
})();
