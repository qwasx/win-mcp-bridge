// 第十九步：原著名地的玩法与绘制
// - 进入提示、神识压制（迷雾）、空间裂缝（牵引、撕伤、乱传）、熔岩灼烧、冰道减速、阴风耗法
// - 古修遗骸（联动禁制：机缘 / 陷阱 / 空无）、名地构件的掌故（T 查看）
// - 名地妖王（墨蛟、古魔血焰、银翅夜叉）与本地特有妖物
// - 绘制：地面贴花（含熔岩辉光、血潭涟漪）、立体构件、裂缝、雾团与雾幕、天罡罩、名字
import type { Game } from './game';
import { LANDMARKS, SCENIC, landmarkAt, mistDepth, type Landmark, type LmStand, type LmGround } from '../data/landmarks';
import { renderLmGround, renderLmStand, drawRift, drawWhirl, mistPuff } from '../gfx/landmark';
import { drawBld } from '../gfx/bldTex2';
import { bldTex } from '../gfx/bldTex';
import { sprites, resBucket, type Spr } from '../gfx/sprites';
import { ENEMIES, lvRealm, lvWeight, type EnemyDef } from '../data/enemies';
import { Enemy } from './combat';
import { rollAffix } from './affix';
import { loot } from './sites';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { mulberry32, hash2 } from '../core/rng';
import { makeCanvas } from '../core/canvas';
import type { Drawable } from './life';
import type { DNode } from './modal';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
interface View { left: number; top: number; right: number; bottom: number }
interface Rift { x: number; y: number; seed: number; ph: number; L: Landmark; open: number }

const LORE: Partial<Record<LmStand['k'], string>> = {
  stoneplat: '熔岩湖正中，一座八角古石台岿然不动，台面阵纹仍透着暗红火光。台上斜插着一柄锈迹斑斑的断剑——不知是哪位前辈在此与火蟾兽群死战。',
  bloodgate: '水潭边半没着一扇巨大的石门，门上浮雕一颗独角鬼头，双目殷红。门缝间渗出丝丝血光——「血咒之门」，传说门后通往上古魔修陨落之地。',
  altar: '白石祭坛高达数十丈，三层台基层层收窄，顶上一座血纹法阵。石阶上满是干涸的暗红痕迹，四角石灯里的火苗竟是血色的。',
  gate: '一座白玉牌楼高耸入云，匾额上「万修之门」四个古篆铁画银钩。传说上古时万千修士自此门入昆吾，同心镇魔。',
  invtower: '那座宝塔竟是倒悬着的——塔尖朝下，悬在深不见底的坑洞之上，数道粗如儿臂的铁链将它锁在半空。塔身符文暗红，隐隐有魔气透出：塔中镇着元刹圣祖的魔魂。',
  corpsepost: '石柱上用铁链缚着一具炼尸，皮肉青灰，周身缠着煞魂丝。它的头低垂着，你却总觉得那双闭着的眼睛在看你。',
  obelisk: '冰火道入口的古碑：一面刻着玄晶冰纹，一面刻着熔岩火纹。碑文道：「冰火二道，择一而行；心有不定者，冰火俱焚。」',
  cave: '山壁上一个黑黝黝的洞口，腥风扑面，洞口散落着兽骨与蜕下的黑鳞——墨蛟洞。',
  ruinhall: '一座上古石殿，殿顶塌了一角，藤蔓爬满石柱。殿中供台早已空空，只有积了不知多少年的尘土。',
  whirl: '乌龙潭——潭水漆黑如墨，潭心一个缓缓旋转的漩涡，深不见底。',
  wall: '',
};

export class LandmarkSys {
  g: Game;
  cur: Landmark | null = null;
  senseK = 1; mist = 0; private mistT = 0;
  focus: LmStand | null = null; focusD = 1e9;
  private rifts: Rift[] = [];
  private riftCd = 0; private hazT = 0; private scanT = 0;
  private lairs = new Map<string, Enemy>();
  private wallPts = new Map<string, [number, number][]>();
  private puffTint = new Map<string, HTMLCanvasElement>();
  constructor(g: Game) {
    this.g = g;
    for (const L of LANDMARKS) {
      const rnd = mulberry32(hash2(L.x | 0, L.y | 0, 77) * 1e9 >>> 0);
      for (let i = 0; i < (L.rifts ?? 0); i++) {
        const a = rnd() * TAU, r = L.r * (0.2 + rnd() * 0.55);
        this.rifts.push({ x: L.x + Math.cos(a) * r, y: L.y + Math.sin(a) * r * 0.8, seed: (rnd() * 1e9) | 0, ph: rnd() * TAU, L, open: 0 });
      }
    }
  }
  reset() { this.lairs.clear(); this.cur = null; this.senseK = 1; this.mist = 0; }
  private get f() { const fl = this.g.ws.flags as any; fl.lm ??= {}; return fl.lm as { seen?: Record<string, 1>; rem?: Record<string, number>; once?: Record<string, 1>; lore?: Record<string, 1> }; }

  // ================================================================ 刷怪
  /** 名地里按本地妖物挑一头（band：危险度给出的妖兽等阶） */
  pick(x: number, y: number, band: number): EnemyDef | null {
    const L = landmarkAt(x, y); if (!L || !L.natives.length) return null;
    const defs = L.natives.map((id) => ENEMIES[id]).filter(Boolean) as EnemyDef[];
    if (!defs.length) return null;
    const w = defs.map((d) => (d.lv ? Math.max(0.35, lvWeight(d, band, true)) : 0.5) * (d.pack ? 0.8 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < defs.length; i++) { r -= w[i]; if (r <= 0) return defs[i]; }
    return defs[0];
  }

  // ================================================================ 每帧
  update(dt: number) {
    const g = this.g, p = g.player, h = g.hero;
    const t = g.time;
    const L = landmarkAt(p.x, p.y);
    if (L !== this.cur) {
      if (L) {
        const f = this.f; f.seen ??= {};
        g.toast(L.enter, 'warn');
        if (!f.seen[L.id]) { f.seen[L.id] = 1; g.news?.(`韩立踏入了${L.name}。`, 'personal'); }
      }
      this.cur = L;
    }
    // 迷雾与神识压制
    const md = L ? mistDepth(L, p.x, p.y) : 0;
    this.mist += (md - this.mist) * Math.min(1, dt * 1.5);
    const want = L ? 1 - (1 - L.senseK) * this.mist : 1;
    this.senseK += (want - this.senseK) * Math.min(1, dt * 1.2);
    if (L && md > 0.5) { this.mistT += dt; if (this.mistT > 2 && !(g.ws.flags as any).lmMistHint) { (g.ws.flags as any).lmMistHint = 1; g.hint('lmmist', '迷雾压制神识：神识范围随雾的浓淡而缩小，看得见的、打得到的都更少了。'); } }
    // 裂缝开合
    for (const r of this.rifts) {
      if (Math.abs(r.x - p.x) > 4000 || Math.abs(r.y - p.y) > 4000) { r.open = 0; continue; }
      r.open = clamp(Math.sin(t * 0.22 + r.ph) * 1.6 + 0.35, 0, 1);
    }
    if (h.dead || g.paused || g.modal) return;
    this.riftCd = Math.max(0, this.riftCd - dt);
    // ---- 裂缝：牵引、撕伤、乱传
    for (const r of this.rifts) {
      if (r.open < 0.3) continue;
      const dx = r.x - p.x, dy = r.y - p.y, d = Math.hypot(dx, dy);
      if (d > 340 || d < 1) continue;
      const pull = (1 - d / 340) * 150 * r.open * (p.flying ? 0.7 : 1);
      p.x += dx / d * pull * dt; p.y += dy / d * pull * dt;
      if (d < 70 && this.riftCd <= 0) {
        this.riftCd = 4;
        h.hp -= 0.08;
        g.combat.texts.push({ x: p.x, y: p.y - 110, s: '空间撕裂！', color: '#d8c0ff', t: 0, vy: -40 });
        g.juice(0.08, 0.6);
        if (h.hp <= 0) { (g.combat as any).playerDown(); return; }
        if (Math.random() < 0.45) {
          const others = this.rifts.filter((o) => o.L === r.L && o !== r);
          const a = Math.random() * TAU, rr = rand(0.3, 0.8) * r.L.r;
          let nx = r.L.x + Math.cos(a) * rr, ny = r.L.y + Math.sin(a) * rr * 0.8;
          if (others.length && Math.random() < 0.5) { const o = pick(others); nx = o.x + rand(-260, 260); ny = o.y + rand(160, 300); }
          if (g.terrain.walkFactor(nx, ny) > 0 || p.flying) {
            g.teleport(nx, ny);
            g.toast('一阵天旋地转——你被空间裂缝卷了进去，再睁眼时已到了谷中另一处！', 'warn');
          }
        } else g.toast('空间裂缝的边缘擦过身体，护体灵光被撕开一道口子！', 'warn');
      }
    }
    // ---- 地面危害（每 0.25 秒结算）
    this.hazT -= dt;
    if (this.hazT <= 0 && L) {
      const step = 0.25; this.hazT = step;
      const gk = this.groundAt(L, p.x, p.y);
      let burn = 0;
      if (!p.flying) {
        if (gk === 'lavalake') burn = 0.1; else if (gk === 'lavapath') burn = 0.05;
        if (gk === 'icepath') g.combat.pst.slow = { t: 0.5, dps: 0 };
      }
      if (burn) {
        h.hp -= burn * step; (g.combat as any).combatT = 0; // 灼烧中不自然回血
        if (Math.random() < 0.5) g.combat.texts.push({ x: p.x + rand(-20, 20), y: p.y - 100, s: '灼', color: '#ff9050', t: 0, vy: -50 });
        if (!(g.ws.flags as any).lmLavaHint) { (g.ws.flags as any).lmLavaHint = 1; g.toast(gk === 'lavalake' ? '熔岩灼身！快离开——或者御器飞过去。' : '熔岩路烫得脚底生烟，法力护体也挡不住多久。', 'warn'); }
        if (h.hp <= 0) { (g.combat as any).playerDown(); return; }
      }
      if (L.mist === 'yin' && this.mist > 0.2) {
        h.mp = Math.max(0, h.mp - 0.006 * step * this.mist * 4);
        if (!(g.ws.flags as any).lmYinHint) { (g.ws.flags as any).lmYinHint = 1; g.toast('阴风刺骨，体内法力被一丝丝吹散……', 'warn'); }
      }
    }
    // ---- 构件焦点、妖王（每 0.2 秒）
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.2;
      this.focus = null; this.focusD = 1e9;
      if (L) for (const s of L.stands) {
        if (s.k === 'wall' || s.k === 'crystal' || s.k === 'sprite') continue;
        const d = Math.hypot(s.x - p.x, s.y - p.y) - Math.min(120, s.w * 0.3);
        if (d < 200 && d < this.focusD) { this.focus = s; this.focusD = Math.max(0, d); }
      }
      this.lairTick();
    }
  }
  private groundAt(L: Landmark, x: number, y: number): LmGround['k'] | null {
    let best: LmGround['k'] | null = null;
    for (const gd of L.ground) {
      const dx = (x - gd.x) / (gd.w * 0.5), dy = (y - gd.y) / (gd.h * 0.5);
      const rect = gd.k === 'icepath' || gd.k === 'lavapath' || gd.k === 'jadeplaza';
      const inside = rect ? Math.abs(dx) < 0.62 && Math.abs(dy) < 0.95 : dx * dx + dy * dy < 0.8;
      if (inside) best = gd.k;
    }
    // 熔岩湖中央的石台是安全的
    if (best === 'lavalake') for (const s of L.stands) if (s.k === 'stoneplat' && Math.hypot((x - s.x) / s.w, (y - s.y) / (s.h * 0.6)) < 0.55) return null;
    return best;
  }
  private lairTick() {
    const g = this.g, p = g.player;
    const fl = g.ws.flags as any; fl.lairs ??= {}; fl.lairSeen ??= {};
    for (const L of LANDMARKS) for (const lr of L.lairs) {
      const d = Math.hypot(lr.x - p.x, lr.y - p.y);
      const e0 = this.lairs.get(lr.id);
      if (e0 && (e0.dead || !g.combat.enemies.includes(e0))) this.lairs.delete(lr.id);
      if (e0 && !e0.dead && d > 5200 && !e0.aggro) { g.combat.enemies = g.combat.enemies.filter((e) => e !== e0); this.lairs.delete(lr.id); continue; }
      if (d > 2400) continue;
      if (!fl.lairSeen[lr.id]) { fl.lairSeen[lr.id] = 1; g.toast(`「${lr.name}」——${lr.desc}`, 'warn'); }
      if (this.lairs.has(lr.id)) continue;
      if (fl.lairs[lr.id] && g.day - fl.lairs[lr.id] < 1080) continue;
      const def = ENEMIES[lr.enemy]; if (!def?.lv) continue;
      if (g.combat.enemies.some((e) => !e.dead && e.def.id === def.id)) continue;   // 剧情事件里已有一头
      const rs = lvRealm(def.lv[0]);
      const e = new Enemy(def, lr.x, lr.y, rs.realm, rs.stage);
      e.boss = true; e.lairId = lr.id; e.hx = lr.x; e.hy = lr.y; e.name = def.name;
      rollAffix(e, g.combat.dangerAt(lr.x, lr.y).k, Math.random() < 0.5 ? 2 : 1);
      g.combat.enemies.push(e);
      this.lairs.set(lr.id, e);
    }
  }

  // ================================================================ 交互
  interact(): boolean {
    const s = this.focus; if (!s) return false;
    const g = this.g;
    if (s.k === 'remains') { g.openDialog(this.remainsNode(s)); return true; }
    const text = LORE[s.k]; if (!text) return false;
    const opts: DNode['options'] = [];
    const f = this.f; f.once ??= {};
    if (s.k === 'stoneplat' && !f.once[s.id]) opts.push({ label: '查看台上的断剑', tone: 'good', act: () => { f.once![s.id] = 1; C.addItem(g.hero, 'mat_gubaocan', 1); C.addItem(g.hero, 'mat_huochan', 2); g.juice(0.06, 0.4); return this.close('断剑剑柄下压着一只早已被火烤得焦黑的储物袋。袋中尚存：古宝残片、火蟾兽内丹两枚。\n\n——这位前辈至死守住了它们。', '古石台', 'mystic'); } });
    if (s.k === 'ruinhall' && !f.once[s.id]) opts.push({ label: '在废墟中翻检', act: () => { f.once![s.id] = 1; const got = loot(g, 1, 0.8, { scroll: 0.3 }); return this.close(`你拨开瓦砾，在供台下的暗格里找到了些前人遗物：\n\n${got.join('、')}`, '上古石殿', 'mystic'); } });
    if (s.k === 'bloodgate') opts.push({ label: '以精血试探门上的鬼头', tone: 'bad', hint: '损失两成气血', act: () => { g.hero.hp = Math.max(0.05, g.hero.hp - 0.2); g.juice(0.08, 0.5); return this.close('精血滴落，鬼头双目血光大盛——旋即又黯淡下去。门纹纹丝不动。\n\n似乎还缺了什么。也许要等某个特定的时机，或者……某种特定的血脉。', '血咒之门', 'danger'); } });
    if (s.k === 'corpsepost' && !f.once[s.id]) opts.push({ label: '斩断锁链，取它身上的煞魂丝', tone: 'bad', hint: '会惊醒炼尸', act: () => { f.once![s.id] = 1; this.wake(s); C.addItem(g.hero, 'mat_shisha', 1); return this.close('链断的一瞬，炼尸猛地抬起头——', '锁尸柱', 'danger'); } });
    opts.push({ label: '离开', act: () => null });
    g.openDialog({ speaker: s.name || '古迹', text, options: opts });
    return true;
  }
  private close(text: string, title: string, mood?: DNode['mood']): DNode { return { speaker: title, text, options: [{ label: '好', act: () => null }], mood }; }
  private wake(s: LmStand) {
    const g = this.g, def = ENEMIES.lianshi; if (!def?.lv) return;
    const rs = lvRealm(def.lv[0]);
    const e = new Enemy(def, s.x + 50, s.y + 30, rs.realm, rs.stage); e.aggro = true; e.name = '挣脱锁链的炼尸';
    g.combat.enemies.push(e);
  }
  private remainsNode(s: LmStand): DNode {
    const g = this.g, f = this.f; f.rem ??= {};
    const done = f.rem[s.id] !== undefined && g.day - f.rem[s.id] < 3650;
    const intro = '一具古修士的遗骸盘膝而坐，袍服早已朽烂，周围一圈淡紫色的阵纹仍在缓缓流转——是「联动禁制」，一处被触动，附近的禁制都会跟着发作。';
    if (done) return { speaker: '古修遗骸', text: intro + '\n\n（你已搜检过这里，阵纹黯淡，什么也不剩了。）', options: [{ label: '离开', act: () => null }] };
    return {
      speaker: '古修遗骸', text: intro, options: [
        { label: '小心破开禁制，搜检遗物', tone: 'bad', hint: '可能触发联动禁制', act: () => this.searchRemains(s) },
        { label: '拜一拜，离开', act: () => { g.toast('你对着遗骸拜了三拜。阵纹微微一闪，像是回应。', 'info'); return null; } },
      ],
    };
  }
  private searchRemains(s: LmStand): DNode {
    const g = this.g, h = g.hero, f = this.f; f.rem![s.id] = g.day;
    const r = Math.random() + ((g as any).stats?.luck ?? 0) * 0.05;
    if (r < 0.35) {
      // 陷阱：禁制反噬 + 残魂
      h.hp -= 0.15; g.juice(0.1, 0.8);
      const def = ENEMIES.canhun;
      if (def?.lv) for (let i = 0; i < 2; i++) { const rs = lvRealm(def.lv[0]); const a = Math.random() * TAU; const e = new Enemy(def, s.x + Math.cos(a) * 160, s.y + Math.sin(a) * 100, rs.realm, rs.stage); e.aggro = true; g.combat.enemies.push(e); }
      if (h.hp <= 0) { h.hp = 0.01; }
      return this.close('指尖刚触到阵纹，四面八方的禁制同时亮起！一道紫光劈在你身上——\n\n遗骸中飘出两缕残魂，尖啸着扑了过来！', '联动禁制', 'danger');
    }
    if (r < 0.55) return this.close('禁制破开了。遗骸一碰便化作飞灰，储物袋也早已朽烂成泥——什么都没留下。', '古修遗骸');
    const got = loot(g, 3, 1, { scroll: 0.35, art: 0.18 });
    if (Math.random() < 0.3) { C.addItem(h, 'mat_gubaocan', 1); got.push(itemDef('mat_gubaocan').name); }
    g.juice(0.05, 0.3);
    return this.close(`禁制一层层解开，遗骸手中紧握的储物袋终于松脱。\n\n获得：${got.join('、')}`, '古修遗骸', 'mystic');
  }

  /** 地图标记 */
  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const f = this.f; const out: { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] = [];
    for (const L of LANDMARKS) if (f.seen?.[L.id]) {
      for (const lr of L.lairs) out.push({ x: lr.x, y: lr.y, glyph: '王', color: '#ff7a6a', name: lr.name });
    }
    return out;
  }

  // ================================================================ 绘制
  private near(L: Landmark, v: View, pad = 600) { return L.x + L.r + pad > v.left && L.x - L.r - pad < v.right && L.y + L.r + pad > v.top && L.y - L.r - pad < v.bottom; }

  /** 地面贴花：草之前、排序物之前 */
  drawGround(ctx: G, v: View, z: number, dpr: number, t: number) {
    const night = this.g.night;
    for (const L of LANDMARKS) {
      if (!this.near(L, v)) continue;
      L.ground.forEach((gd, i) => {
        if (gd.x + gd.w / 2 < v.left || gd.x - gd.w / 2 > v.right || gd.y + gd.h / 2 < v.top || gd.y - gd.h / 2 > v.bottom) return;
        const res = Math.round(Math.min(resBucket(z * dpr, 1), Math.sqrt(4.5e6 / (gd.w * gd.h))) * 100) / 100;
        const s = sprites.get(`LG:${L.id}:${i}`, res, (r) => renderLmGround(gd.k, gd.w, gd.h, gd.seed, r));
        if (s) ctx.drawImage(s.canvas, gd.x - s.ax, gd.y - s.ay, s.w, s.h);
        // 动态：熔岩辉光、血潭涟漪
        if (gd.k === 'lavalake' || gd.k === 'lavafield' || gd.k === 'lavapath') {
          const k = gd.k === 'lavalake' ? 1 : gd.k === 'lavapath' ? 0.5 : 0.35;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const pulse = 0.75 + 0.25 * Math.sin(t * 1.3 + i);
          const gr = ctx.createRadialGradient(gd.x, gd.y, 0, gd.x, gd.y, Math.max(gd.w, gd.h) * 0.55);
          gr.addColorStop(0, `rgba(255,110,30,${(0.16 + night * 0.25) * k * pulse})`); gr.addColorStop(1, 'rgba(255,60,10,0)');
          ctx.fillStyle = gr; ctx.save(); ctx.translate(gd.x, gd.y); ctx.scale(1, gd.h / gd.w); ctx.translate(-gd.x, -gd.y); ctx.beginPath(); ctx.arc(gd.x, gd.y, gd.w * 0.55, 0, TAU); ctx.fill(); ctx.restore();
          if (gd.k === 'lavalake' && z > 0.3) {
            for (let b = 0; b < 14; b++) {
              const ph = (t * 0.5 + b * 0.37) % 1, a = hash2(b, i, 9) * TAU, rr = Math.sqrt(hash2(b, i, 10)) * 0.75;
              const bx = gd.x + Math.cos(a) * gd.w * 0.5 * rr, by = gd.y + Math.sin(a) * gd.h * 0.5 * rr;
              ctx.fillStyle = `rgba(255,${200 - ph * 80},90,${Math.sin(ph * Math.PI) * 0.7})`;
              ctx.beginPath(); ctx.ellipse(bx, by, 4 + ph * 10, (4 + ph * 10) * 0.5, 0, 0, TAU); ctx.fill();
            }
          }
          ctx.restore();
        } else if ((gd.k === 'bloodpool' || gd.k === 'blackpond') && z > 0.3) {
          ctx.save(); ctx.strokeStyle = gd.k === 'bloodpool' ? 'rgba(230,120,120,0.35)' : 'rgba(170,200,220,0.3)'; ctx.lineWidth = 1.5;
          for (let k = 0; k < 4; k++) {
            const ph = (t * 0.25 + k / 4) % 1, cx = gd.x + (hash2(k, i, 3) - 0.5) * gd.w * 0.5, cy = gd.y + (hash2(k, i, 4) - 0.5) * gd.h * 0.4;
            ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(cx, cy, 10 + ph * 90, (10 + ph * 90) * 0.4, 0, 0, TAU); ctx.stroke();
          }
          ctx.restore();
        }
      });
    }
  }

  private wallOf(s: LmStand, L: Landmark): [number, number][] {
    let pts = this.wallPts.get(s.id);
    if (pts) return pts;
    const dx = s.x - L.x, dy = (s.y - L.y) / 0.78, wr = Math.hypot(dx, dy);
    pts = [];
    const a0 = s.a0 ?? 0, a1 = s.a1 ?? 0.2, n = 10;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([L.x + Math.cos(a) * wr - s.x, L.y + Math.sin(a) * wr * 0.78 - s.y]); }
    this.wallPts.set(s.id, pts);
    return pts;
  }

  /** 立体构件、裂缝：参与前后排序 */
  collect(list: Drawable[], v: View, t: number) {
    const g = this.g, z = g.cam.zoom, dpr = (g as any).renderer?.dpr ?? 1;
    const ctxRes = (w: number, h: number) => Math.round(Math.min(resBucket(z * dpr, 1.2), Math.sqrt(3e6 / Math.max(1, w * h))) * 100) / 100;
    for (const L of LANDMARKS) {
      if (!this.near(L, v, 1200)) continue;
      for (const s of L.stands) {
        if (s.x + 800 < v.left || s.x - 800 > v.right || s.y - 1200 > v.bottom || s.y + 300 < v.top) continue;
        if (s.k === 'whirl') { list.push({ y: s.y - 200, draw: (c) => drawWhirl(c, s.x, s.y, t, s.w) }); continue; }
        // 第二十三步：贴图构件（画材未就绪时：纯贴图件先不画，有代码版的退回代码版）
        if (s.tex) {
          const tex = s.tex;
          list.push({ y: s.y, draw: (c) => {
            if (!drawBld(c, tex, s.x, s.y, t, s.sc ?? 1, !!s.flip)) {
              if (s.k === 'sprite') return;
              const sp = sprites.get(`LS:${s.id}`, ctxRes(s.w + 80, s.h + 80), (r) => renderLmStand({ k: s.k, w: s.w, h: s.h, seed: s.seed, flip: s.flip, name: s.name }, r) as Spr); if (sp) c.drawImage(sp.canvas, s.x - sp.ax, s.y - sp.ay, sp.w, sp.h);
            }
            if (s.k === 'remains' && z > 0.35 && this.f.rem?.[s.id] === undefined) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(180,150,255,${0.3 + 0.25 * Math.sin(t * 2 + s.seed)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(s.x, s.y - 2, 64, 22, 0, 0, TAU); c.stroke(); c.restore(); }
            if (tex === 'p_e_firemouth') { c.save(); c.globalCompositeOperation = 'lighter'; const k = 0.5 + 0.5 * Math.sin(t * 3 + s.seed); const gr = c.createRadialGradient(s.x, s.y - 60, 0, s.x, s.y - 60, 160); gr.addColorStop(0, `rgba(255,120,40,${0.18 + 0.14 * k})`); gr.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = gr; c.beginPath(); c.arc(s.x, s.y - 60, 160, 0, TAU); c.fill(); c.restore(); }
            if (s.name && this.focus === s && this.focusD < 200) this.label(c, s.x, s.y - Math.min(s.h, 260) - 20, `【T】${s.name}`);
          } });
          continue;
        }
        const tex = s.k === 'ruinhall' ? 'hall_grey' : s.k === 'gate' ? 'paifang' : s.k === 'invtower' ? 'pagoda' : null;
        if (tex && !bldTex(tex)) continue;
        let def: Parameters<typeof renderLmStand>[0] = { k: s.k, w: s.w, h: s.h, seed: s.seed, flip: s.flip, name: s.name };
        if (s.k === 'wall') def = { ...def, pts: this.wallOf(s, L) };
        const key = `LS:${s.id}`;
        const res = ctxRes(s.k === 'wall' ? 900 : s.w + 80, s.k === 'wall' ? 400 : s.h + 80);
        if (s.k === 'invtower') {
          const ty = s.y - s.h - 120;
          list.push({ y: s.y + 60, draw: (c) => {
            const sp = sprites.get(key, res, (r) => renderLmStand(def, r) as Spr); if (!sp) return;
            const bob = Math.sin(t * 0.6) * 8;
            // 坑中红光
            c.save(); c.globalCompositeOperation = 'lighter';
            const gr = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 360); gr.addColorStop(0, `rgba(255,60,50,${0.12 + 0.06 * Math.sin(t * 2)})`); gr.addColorStop(1, 'rgba(255,40,40,0)');
            c.fillStyle = gr; c.beginPath(); c.ellipse(s.x, s.y, 360, 180, 0, 0, TAU); c.fill(); c.restore();
            // 铁链
            c.strokeStyle = 'rgba(70,66,64,0.95)'; c.lineWidth = 5;
            for (const [ax, ay] of [[-1.5, -0.2], [1.5, -0.2], [-1.1, 0.5], [1.1, 0.5]] as const) {
              const ex = s.x + ax * s.w, ey = s.y + ay * 180, sx = s.x + Math.sign(ax) * s.w * 0.18, sy = ty + s.h * 0.35 + bob;
              c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo((sx + ex) / 2, Math.max(sy, ey) + 50, ex, ey); c.stroke();
              c.fillStyle = '#4a4644'; c.fillRect(ex - 10, ey - 30, 20, 34);
            }
            c.drawImage(sp.canvas, s.x - sp.ax, ty + bob - sp.ay, sp.w, sp.h);
          } });
          continue;
        }
        list.push({ y: s.y, draw: (c) => {
          const sp = sprites.get(key, res, (r) => renderLmStand(def, r) as Spr); if (!sp) return;
          c.drawImage(sp.canvas, s.x - sp.ax, s.y - sp.ay, sp.w, sp.h);
          if (s.k === 'altar' && z > 0.3) {
            c.save(); c.globalCompositeOperation = 'lighter';
            const ay = s.y - s.h * 0.82, gr = c.createRadialGradient(s.x, ay, 0, s.x, ay, 200);
            gr.addColorStop(0, `rgba(255,60,50,${0.22 + 0.12 * Math.sin(t * 1.7)})`); gr.addColorStop(1, 'rgba(255,40,40,0)');
            c.fillStyle = gr; c.beginPath(); c.arc(s.x, ay, 200, 0, TAU); c.fill(); c.restore();
          }
          if (s.k === 'remains' && z > 0.35) {
            const done = this.f.rem?.[s.id] !== undefined;
            if (!done) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(180,150,255,${0.3 + 0.25 * Math.sin(t * 2 + s.seed)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(s.x, s.y - 2, 64, 22, 0, 0, TAU); c.stroke(); c.restore(); }
          }
          if (this.focus === s && this.focusD < 200) this.label(c, s.x, s.y - Math.min(s.h, 260) - 20, `【T】${s.name || '查看'}`);
        } });
      }
    }
    // 裂缝
    for (const r of this.rifts) {
      if (r.open <= 0.02 || r.x < v.left - 300 || r.x > v.right + 300 || r.y < v.top - 100 || r.y > v.bottom + 400) continue;
      const p = g.player, d = Math.hypot(r.x - p.x, r.y - p.y), R = g.senseRadius;
      const a = clamp((R * 1.05 - d) / 200, 0, 1);   // 只在神识中显现
      if (a <= 0) continue;
      list.push({ y: r.y, draw: (c) => drawRift(c, r.x, r.y, t, r.open, r.seed, a) });
    }
  }

  private tinted(col: string): HTMLCanvasElement {
    let c = this.puffTint.get(col); if (c) return c;
    const src = mistPuff(); c = makeCanvas(src.width, src.height) as HTMLCanvasElement;
    const g = c.getContext('2d')!; g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    this.puffTint.set(col, c); return c;
  }

  /** 排序物之后：雾团、雾幕、天罡罩、熔岩余烬、名字 */
  drawOver(ctx: G, v: View, t: number) {
    const g = this.g, z = g.cam.zoom, p = g.player;
    const wind = g.weather?.wind ?? 0.3;
    for (const L of LANDMARKS) {
      if (!this.near(L, v, 800)) continue;
      // ---- 雾团（世界锚定，缓缓漂移）
      if (L.mist) {
        const img = L.mist === 'yin' ? this.tinted('rgb(70,92,84)') : this.tinted('rgb(244,244,240)');
        const CELL = 460;
        const x0 = Math.max(v.left - 400, L.x - L.r), x1 = Math.min(v.right + 400, L.x + L.r);
        const y0 = Math.max(v.top - 300, L.y - L.r), y1 = Math.min(v.bottom + 300, L.y + L.r);
        const nAll = ((x1 - x0) / CELL) * ((y1 - y0) / CELL);
        const step = nAll > 260 ? 2 : 1;
        for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy += step) for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx += step) {
          for (let k = 0; k < 2; k++) {
            const h1 = hash2(gx, gy, 51 + k), h2 = hash2(gx, gy, 53 + k), h3 = hash2(gx, gy, 55 + k);
            const drift = ((t * (12 + wind * 30) + h3 * 900) % 900) - 450;
            const x = (gx + h1) * CELL + drift, y = (gy + h2) * CELL + Math.sin(t * 0.2 + h3 * 6) * 30;
            const md = mistDepth(L, x, y); if (md < 0.08) continue;
            // 玩家身边雾薄一些（神识撑开的一小圈）
            const dp = Math.hypot(x - p.x, y - p.y), clear = clamp(dp / 260, 0.25, 1);
            const w = (560 + h3 * 420) * step, hgt = w * 0.42;
            ctx.globalAlpha = md * clear * (L.mist === 'yin' ? 0.3 : 0.3) * (0.6 + 0.4 * Math.sin(t * 0.3 + h1 * 9));
            ctx.drawImage(img, x - w / 2, y - hgt / 2 - 60, w, hgt);
          }
        }
        ctx.globalAlpha = 1;
      }
      // ---- 天罡罩（虚天殿）
      if (L.id === 'xutian') {
        const rx = L.r * 0.82, ry = rx * 0.62, cx = L.x, cy = L.y + 200;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(cx, cy - ry * 0.4, rx * 0.2, cx, cy, rx);
        gr.addColorStop(0, 'rgba(120,180,255,0)'); gr.addColorStop(0.85, 'rgba(120,180,255,0.05)'); gr.addColorStop(1, `rgba(170,215,255,${0.18 + 0.05 * Math.sin(t)})`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(200,230,255,${0.35 + 0.1 * Math.sin(t * 1.3)})`; ctx.lineWidth = 3 / Math.max(0.3, z); ctx.stroke();
        // 光罩上流转的符纹
        ctx.lineWidth = 1.5 / Math.max(0.3, z);
        for (let k = 0; k < 7; k++) { const a = t * 0.08 + k / 7 * TAU; ctx.strokeStyle = `rgba(220,240,255,${0.18 + 0.1 * Math.sin(t * 2 + k)})`; ctx.beginPath(); ctx.ellipse(cx, cy, rx * Math.abs(Math.cos(a)), ry, 0, 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
      // ---- 熔岩余烬
      if (z > 0.3) for (const gd of L.ground) {
        if (gd.k !== 'lavafield' && gd.k !== 'lavalake') continue;
        if (gd.x + gd.w / 2 < v.left || gd.x - gd.w / 2 > v.right || gd.y + gd.h / 2 < v.top || gd.y - gd.h / 2 > v.bottom) continue;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const n = gd.k === 'lavalake' ? 26 : 40;
        for (let i = 0; i < n; i++) {
          const ph = (t * (0.12 + hash2(i, gd.seed & 255, 1) * 0.1) + hash2(i, 3, gd.seed & 255)) % 1;
          const a = hash2(i, 5, gd.seed & 255) * TAU, rr = Math.sqrt(hash2(i, 7, gd.seed & 255)) * 0.85;
          const x = gd.x + Math.cos(a) * gd.w * 0.5 * rr + Math.sin(ph * 6 + i) * 20, y = gd.y + Math.sin(a) * gd.h * 0.5 * rr - ph * 260;
          ctx.fillStyle = `rgba(255,${150 + ph * 80},70,${Math.sin(ph * Math.PI) * 0.8})`;
          ctx.beginPath(); ctx.arc(x, y, 1.6 + (1 - ph) * 1.6, 0, TAU); ctx.fill();
        }
        ctx.restore();
        // 灰烬随热风飘散（坠魔谷）
        ctx.fillStyle = 'rgba(90,84,80,0.5)';
        for (let i = 0; i < 30; i++) { const ph = (t * 0.07 + hash2(i, 11, gd.seed & 255)) % 1; const x = gd.x + (hash2(i, 13, gd.seed & 255) - 0.5) * gd.w * 1.2 + ph * 300; const y = gd.y + (hash2(i, 17, gd.seed & 255) - 0.5) * gd.h - ph * 200; ctx.fillRect(x, y, 2.4, 2.4); }
      }
    }
    // ---- 屏幕雾幕：以玩家为心，圈外渐浓
    if (this.mist > 0.03 && this.cur) {
      const R = g.senseRadius;
      const col = this.cur.mist === 'yin' ? '60,80,74' : '238,238,232';
      const gr = ctx.createRadialGradient(p.x, p.y - 40, R * 0.35, p.x, p.y - 40, R * 1.25);
      gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(1, `rgba(${col},${0.42 * this.mist})`);
      ctx.fillStyle = gr; ctx.fillRect(v.left - 50, v.top - 50, v.right - v.left + 100, v.bottom - v.top + 100);
    }
    // ---- 名字（名地构件、名山、瀑布、花林）
    if (z > 0.22) {
      const lab = (x: number, y: number, s: string) => { if (!s) return; const d = Math.hypot(x - p.x, y - p.y); if (d > 1800) return; ctx.globalAlpha = clamp((1800 - d) / 500, 0, 1) * 0.9; this.label(ctx, x, y, s, true); ctx.globalAlpha = 1; };
      for (const L of LANDMARKS) {
        if (!this.near(L, v, 600)) continue;
        for (const s of L.stands) if (s.name && s.k !== 'remains' && s.k !== 'corpsepost' && s.k !== 'crystal' && this.focus !== s) lab(s.x, s.y + 40, s.name);
      }
      for (const pk of SCENIC.peaks) if (pk.name) lab(pk.x, pk.y + 50, pk.name);
      for (const f of SCENIC.falls) if (f.name) lab(f.x, f.y + f.w * 0.2, f.name);
      for (const gv of SCENIC.groves) if (gv.name) lab(gv.x, gv.y, gv.name);
      for (const p of SCENIC.props) if (p.name) lab(p.x, p.y - p.h - 32, p.name);
    }
  }

  private label(ctx: G, x: number, y: number, s: string, soft = false) {
    const z = this.g.cam.zoom, fs = Math.max(12, (soft ? 15 : 14) / Math.max(0.5, z));
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 3 / Math.max(0.5, z); ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.strokeText(s, x, y); ctx.fillStyle = soft ? '#f4ead0' : '#fff0c8'; ctx.fillText(s, x, y); ctx.restore();
  }
}
