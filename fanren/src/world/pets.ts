// 第十八步：灵宠
// - 灵卵/幼崽得自兽巢、潭底、遗府、藏宝；放进储物袋即自动温养，数十日后破壳
// - 至多四只，一只随行：跟着你走、跟你一起飞、替你出手；会循着气味替你找到神识外的机缘
// - 斩妖、喂妖丹可升级（1–10 级）；亲密度高了会叼东西回来送你
import type { Game } from './game';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { REALMS } from '../data/realms';
import type { DNode, DOpt } from './modal';
import type { PetState } from './worldstate';
import { drawBeast, type BeastLook } from '../gfx/beast';
import { dirName, type SiteKind } from './sites';
import type { Enemy } from './combat';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

interface PetKind { name: string; egg: string; look?: BeastLook; flying?: boolean; hatch: number; dmg: number; cd: number; color: string; scout: number; prefer: SiteKind[]; names: string[]; desc: string; ranged?: boolean }
export const PET_KINDS: Record<string, PetKind> = {
  yunchi: { name: '云翅鸟', egg: 'egg_yunchi', look: { body: 'eagle', color: [214, 178, 70], belly: [250, 236, 190], size: 0.62, tail: 'streamer', accent: [250, 230, 160] } as any, flying: true, hatch: 40, dmg: 0.28, cd: 1.0, color: '255,230,150', scout: 2.6, prefer: [], names: ['小云', '金羽', '追风', '阿翎'], desc: '目力极佳，常盘旋高空，替你发现神识之外的机缘。' },
  huli: { name: '灵狐', egg: 'egg_huli', look: { body: 'fox', color: [236, 226, 214], belly: [255, 250, 244], size: 0.75, tails: 1, glow: '255,220,180' } as any, hatch: 60, dmg: 0.34, cd: 1.2, color: '255,190,140', scout: 2.0, prefer: ['herbking', 'pool', 'corpse'], names: ['阿狸', '小白', '雪团', '胡九'], desc: '鼻子灵得出奇，嗅得出灵药与埋在地下的宝物。等级越高，尾巴越多。', ranged: true },
  wolf: { name: '灵狼', egg: 'egg_wolf', look: { body: 'wolf', color: [70, 80, 96], belly: [190, 196, 206], size: 0.9, eye: 'rgba(120,200,255,0.95)', glow: '150,200,255' } as any, hatch: 60, dmg: 0.5, cd: 1.1, color: '170,210,255', scout: 1.4, prefer: ['nest', 'bones'], names: ['啸月', '阿苍', '黑风', '铁牙'], desc: '扑咬凌厉，是护主的好手。能嗅出妖兽巢穴。' },
  jiao: { name: '墨蛟', egg: 'egg_jiao', look: { body: 'jiao', color: [50, 64, 80], belly: [150, 170, 180], accent: [220, 200, 150], size: 0.7, eye: 'rgba(255,220,60,0.95)' } as any, hatch: 150, dmg: 0.75, cd: 1.5, color: '120,200,255', scout: 1.6, prefer: ['pool', 'vein'], names: ['墨鳞', '小黑', '沧澜', '玄角'], desc: '蛟龙之属，吐水成箭，长成后威势惊人。', ranged: true },
  shijin: { name: '噬金虫', egg: 'egg_shijin', hatch: 200, dmg: 1.05, cd: 0.8, color: '255,210,90', scout: 1.3, prefer: ['ruin'], names: ['金甲', '吞天', '小金', '万噬'], desc: '奇虫榜第三。成群而出，啃噬法宝与护体灵光，几乎无物可挡。' },
};
export const EGG_TO_KIND: Record<string, string> = Object.fromEntries(Object.entries(PET_KINDS).map(([k, v]) => [v.egg, k]));
const MAX_PETS = 4;

class PetEnt { x = 0; y = 0; facing = 1; cd = 1; alert = 0; phase = 0; move = 0; atk = 0; t = Math.random() * 10; dots = Array.from({ length: 26 }, () => ({ a: Math.random() * TAU, r: rand(8, 40), s: rand(2, 6) })); }

export class PetSys {
  game: Game;
  ent: PetEnt | null = null;
  focus = false; focusD = 1e9;
  private scoutT = rand(25, 40);
  private chk = 0;
  constructor(g: Game) { this.game = g; }
  get active(): PetState | null { const ws = this.game.ws; return ws.pets?.[ws.petActive] ?? null; }
  need(lv: number) { return Math.round(12 * Math.pow(lv, 1.6)); }

  /** 获得一枚灵卵：若当前没在温养，立刻开始 */
  onEgg(id: string) {
    const g = this.game, ws = g.ws;
    if (!EGG_TO_KIND[id]) return;
    if (ws.incubate) { g.toast(`${itemDef(id).name}收进储物袋——等手头这枚孵出来，再接着温养。`, 'info'); return; }
    this.startNext(id);
  }
  private startNext(prefer?: string) {
    const g = this.game, ws = g.ws, h = g.hero;
    if (ws.incubate) return;
    if ((ws.pets?.length ?? 0) >= MAX_PETS) return;
    const id = prefer && C.bagCount(h, prefer) > 0 ? prefer : Object.keys(EGG_TO_KIND).find((e) => C.bagCount(h, e) > 0);
    if (!id) return;
    C.removeItem(h, id, 1);
    const k = PET_KINDS[EGG_TO_KIND[id]];
    ws.incubate = { id, days: g.day, need: k.hatch };
    g.toast(`你以灵力包裹${itemDef(id).name}，开始温养（约 ${k.hatch} 日破壳）。`, 'good');
    g.hint('pet', '灵卵会自动温养，打坐时光阴更快。破壳后的灵宠会跟着你、替你出手，还能嗅出神识外的机缘。');
  }

  update(dt: number) {
    const g = this.game, ws = g.ws, P = g.player;
    ws.pets ??= [];
    this.chk -= dt;
    if (this.chk <= 0) {
      this.chk = 1;
      if (ws.incubate && g.day >= ws.incubate.days + ws.incubate.need) this.hatch();
      else if (!ws.incubate) this.startNext();
    }
    const pet = this.active;
    if (!pet || g.hero.dead) { this.ent = null; this.focus = false; return; }
    const k = PET_KINDS[pet.kind]; if (!k) return;
    if (!this.ent) { this.ent = new PetEnt(); this.ent.x = P.x - 80; this.ent.y = P.y + 30; }
    const e = this.ent; e.t += dt; e.alert = Math.max(0, e.alert - dt); e.atk = Math.max(0, e.atk - dt * 3);
    // 目标
    let tgt: Enemy | null = null, bd = 700;
    for (const en of g.combat.enemies) { if (en.dead || en.spar || (!en.aggro && g.combat.lock !== en)) continue; const d = Math.hypot(en.x - P.x, en.y - P.y); if (d < bd) { bd = d; tgt = en; } }
    let tx: number, ty: number;
    if (tgt) {
      const ang = Math.atan2(e.y - tgt.y, e.x - tgt.x);
      const keep = k.ranged || pet.kind === 'shijin' ? 260 : 80;
      tx = tgt.x + Math.cos(ang) * keep; ty = tgt.y + Math.sin(ang) * keep * 0.7;
    } else {
      const side = P.st ? (Math.sin(P.st.yaw) >= 0 ? -1 : 1) : -1;
      tx = P.x + side * 90 + Math.sin(e.t * 0.6) * 20; ty = P.y + 26 + Math.cos(e.t * 0.5) * 10;
    }
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d > 2600) { e.x = P.x - 80; e.y = P.y + 30; }
    else if (d > 6) { const sp = Math.min(d * 3.2, 1800 + (P.flying ? 900 : 0)); e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; if (Math.abs(dx) > 4) e.facing = dx > 0 ? 1 : -1; e.move += (Math.min(1, sp / 300) - e.move) * Math.min(1, dt * 6); e.phase += dt * sp / 18 * e.move; }
    else e.move *= 0.9;
    // 出手
    e.cd -= dt;
    if (tgt && e.cd <= 0 && Math.hypot(tgt.x - e.x, tgt.y - e.y) < (k.ranged || pet.kind === 'shijin' ? 420 : 160)) {
      e.cd = k.cd * rand(0.85, 1.15); e.atk = 1; e.facing = tgt.x > e.x ? 1 : -1;
      const R = REALMS[g.hero.realm]; const st = clamp(g.hero.stage, 0, R.atk.length - 1);
      const dmg = R.atk[st] * k.dmg * (1 + pet.lv * 0.12) * (pet.bond >= 50 ? 1.1 : 1);
      g.combat.allyStrike(e.x, e.y - (k.flying || P.flying ? 70 : 10), tgt, dmg, k.color, g.hero.realm);
    }
    // 互动焦点
    const pd = Math.hypot(e.x - P.x, e.y - P.y); this.focus = pd < 150 && !tgt; this.focusD = pd + 40;
    // 寻宝
    this.scoutT -= dt;
    if (this.scoutT <= 0 && !g.combat.inCombat) {
      this.scoutT = rand(30, 50) / (1 + pet.lv * 0.04);
      const s = g.sites.sniff(g.senseRadius * k.scout * (1 + pet.lv * 0.05), k.prefer);
      if (s) {
        g.sites.st(s).seen = 1; e.alert = 3; pet.xp += 2;
        g.toast(`${pet.name}朝${dirName(s.x - P.x, s.y - P.y)}方${k.flying ? '长鸣一声' : pet.kind === 'shijin' ? '嗡嗡作响' : '低低叫唤'}——它发现了「${g.sites.name(s)}」！（地图上已标出）`, 'good');
      }
      // 灵狐：残图藏宝的确切位置
      if (pet.kind === 'huli') for (const c of ws.caches ?? []) if (!c.done && Math.hypot(c.x - P.x, c.y - P.y) < g.senseRadius * 3 && !(c as any).sniffed) { (c as any).sniffed = 1; c.ox = c.x; c.oy = c.y; g.toast(`${pet.name}的鼻子抽动了几下——它闻到了藏宝的确切位置！`, 'good'); break; }
      // 亲密：叼东西回来
      if (pet.bond >= 70 && Math.random() < 0.18) {
        const gift = pick([['mat_lingshi', 10 + g.hero.realm * 25], ['herb_lingzhi', 1], ['herb_huangjing', 3], ['mat_yaodan' + clamp(g.hero.realm, 1, 9), 1]] as [string, number][]);
        C.addItem(g.hero, gift[0], gift[1], gift[0].startsWith('herb') ? 30 + Math.floor(Math.random() * 60) : undefined);
        e.alert = 2; g.toast(`${pet.name}叼来了${itemDef(gift[0]).name}${gift[1] > 1 ? '×' + gift[1] : ''}，邀功似地蹭你的手。`, 'good');
      }
      this.levelCheck(pet);
    }
  }
  onKill(en: Enemy) {
    const pet = this.active, e = this.ent; if (!pet || !e) return;
    if (Math.hypot(en.x - e.x, en.y - e.y) > 1400) return;
    pet.xp += 1 + (en.blv ?? 1) * 1.5 + (en.boss ? 4 : 0);
    this.levelCheck(pet);
  }
  private levelCheck(pet: PetState) {
    const g = this.game;
    while (pet.lv < 10 && pet.xp >= this.need(pet.lv)) {
      pet.xp -= this.need(pet.lv); pet.lv++;
      g.toast(`${pet.name}长大了！灵宠升至 ${pet.lv} 级。${pet.kind === 'huli' && pet.lv % 3 === 0 ? '——它又生出了一条尾巴！' : ''}`, 'good');
      if (pet.lv === 10) g.news(`韩立的灵宠「${pet.name}」已成长为一方妖王。`, 'personal');
    }
  }
  private hatch() {
    const g = this.game, ws = g.ws;
    const inc = ws.incubate!; const kind = EGG_TO_KIND[inc.id]; const k = PET_KINDS[kind];
    if (ws.pets.length >= MAX_PETS) { ws.incubate = null; C.addItem(g.hero, inc.id, 1); g.toast('灵宠已满四只，灵卵暂且收回储物袋。', 'warn'); return; }
    ws.incubate = null;
    const pet: PetState = { kind, name: k.name, lv: 1, xp: 0, bond: 20, born: g.day };
    ws.pets.push(pet); ws.petActive = ws.pets.length - 1; this.ent = null;
    g.news(`韩立温养的${itemDef(inc.id).name}破壳了。`, 'personal');
    g.juice(0.05, 0.3);
    g.openDialog({ speaker: k.name, title: '破壳', mood: 'mystic', text: `${kind === 'shijin' ? '一阵细密的「咔咔」声后，几十只米粒大小的金色甲虫爬了出来，在你掌心排成一团，触须齐齐朝向你。' : kind === 'yunchi' ? '蛋壳裂开，一只湿漉漉的雏鸟挣了出来，抖抖翅膀，冲你「啾」了一声。' : kind === 'jiao' ? '蛟卵裂开，一条筷子长的小蛟盘在你腕上，鳞片冰凉，金色竖瞳好奇地打量着你。' : '小家伙睁开眼，第一眼看见的就是你。它晃晃悠悠爬过来，用脑袋拱你的手心。'}\n\n${k.desc}\n\n给它取个名字吧：`, options: [...k.names.slice(0, 3).map((n) => ({ label: `「${n}」`, act: () => { pet.name = n; return null; } } as DOpt)), { label: `就叫「${k.name}」`, act: () => null }] });
    setTimeout(() => this.startNext(), 0);
  }

  interact(): boolean { const p = this.active; if (!p) return false; this.game.openDialog(this.petNode(this.game.ws.petActive)); return true; }
  petNode(i: number): DNode {
    const g = this.game, ws = g.ws, h = g.hero, pet = ws.pets[i]; const k = PET_KINDS[pet.kind];
    const today = Math.floor(g.day);
    const dans = h.bag.filter((b) => b.id.startsWith('mat_yaodan')).sort((a, b) => parseInt(a.id.slice(10)) - parseInt(b.id.slice(10)));
    const opts: DOpt[] = [
      { label: '摸摸它', disabled: (pet as any).pat === today, hint: (pet as any).pat === today ? '今天已经摸过了' : '亲密 +3', act: () => { (pet as any).pat = today; pet.bond = Math.min(100, pet.bond + 3); return { speaker: pet.name, text: pick([`${pet.name}眯起眼睛，喉咙里发出满足的呼噜声。`, `${pet.name}翻过身，露出肚皮。`, `${pet.name}蹭了蹭你的手，又扭头去追一只蝴蝶。`]), options: [{ label: '好', act: () => this.petNode(i) }] }; } },
    ];
    if (dans.length) { const d = dans[0]; const lv = parseInt(d.id.slice(10)); opts.push({ label: `喂一颗${itemDef(d.id).name}（经验 +${lv * 8}）`, act: () => { C.removeItem(h, d.id, 1); pet.xp += lv * 8; pet.bond = Math.min(100, pet.bond + 2); this.levelCheck(pet); return this.petNode(i); } }); }
    else opts.push({ label: '喂妖丹（储物袋里没有）', disabled: true, act: () => null });
    if (ws.petActive !== i) opts.push({ label: '让它随行', tone: 'gold', act: () => { ws.petActive = i; this.ent = null; return null; } });
    if (ws.pets.length > 1) opts.push({ label: '看看其它灵宠', act: () => this.menuNode() });
    opts.push({ label: '放归山林', tone: 'bad', act: () => ({ speaker: pet.name, text: `真的要放${pet.name}走吗？`, options: [{ label: '放它走', tone: 'bad', act: () => { ws.pets.splice(i, 1); ws.petActive = 0; this.ent = null; g.toast(`${pet.name}回头望了你好几眼，才消失在林子里。`, 'info'); return null; } }, { label: '舍不得', act: () => this.petNode(i) }] }) });
    opts.push({ label: '离开', act: () => null });
    const bondTxt = pet.bond >= 80 ? '形影不离' : pet.bond >= 50 ? '亲近' : pet.bond >= 30 ? '熟悉' : '还有些怕生';
    return { speaker: pet.name, title: `${k.name} · ${pet.lv}级 · ${bondTxt}（${pet.bond}）`, mood: 'mystic', text: `${k.desc}\n\n成长：${pet.lv >= 10 ? '已臻圆满' : `${Math.floor(pet.xp)}/${this.need(pet.lv)}`}　　出生于第 ${Math.floor(pet.born / 360) + 1} 年\n\n${pet.bond >= 70 ? '它时常叼些小玩意儿回来送你。' : '多陪陪它，亲密了它会更卖力。'}`, options: opts };
  }
  menuNode(): DNode {
    const g = this.game, ws = g.ws;
    const opts: DOpt[] = ws.pets.map((p, i) => ({ label: `${p.name}（${PET_KINDS[p.kind]?.name} ${p.lv}级）${ws.petActive === i ? ' · 随行中' : ''}`, act: () => this.petNode(i) }));
    if (ws.incubate) opts.push({ label: `温养中：${itemDef(ws.incubate.id).name}（还需约 ${Math.max(1, Math.ceil(ws.incubate.days + ws.incubate.need - g.day))} 日）`, disabled: true, act: () => null });
    opts.push({ label: '离开', act: () => null });
    return { speaker: '灵宠', text: ws.pets.length ? '你的灵宠们。' : '你还没有灵宠。', options: opts };
  }
  reset() { this.ent = null; }

  // ------------------------------------------------------------ 绘制
  collect(out: { y: number; draw: (g: G) => void }[]) {
    const pet = this.active, e = this.ent; if (!pet || !e) return;
    const k = PET_KINDS[pet.kind]; if (!k) return;
    const P = this.game.player;
    const flying = !!k.flying || P.flying;
    const sc = 0.55 + pet.lv * 0.05;
    out.push({ y: e.y, draw: (ctx) => {
      if (pet.kind === 'shijin') this.drawBugs(ctx, e, flying, pet.lv);
      else if (k.look) {
        const look = pet.kind === 'huli' ? { ...k.look, tails: 1 + Math.floor(pet.lv / 3) } as BeastLook : k.look;
        drawBeast(ctx, look, e.x, e.y, e.facing, { move: e.move, phase: e.phase, atk: e.atk, hit: 0, t: e.t, flying } as any, sc);
      }
      if (e.alert > 0) {
        const a = Math.min(1, e.alert); ctx.save(); ctx.globalAlpha *= a;
        ctx.font = 'bold 26px "Noto Serif SC",serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,20,10,0.7)';
        const yy = e.y - (flying ? 150 : 90) - Math.abs(Math.sin(e.t * 6)) * 8;
        ctx.strokeText('！', e.x, yy); ctx.fillStyle = '#ffd860'; ctx.fillText('！', e.x, yy); ctx.restore();
      }
      if (this.focus) { const z = this.game.cam.zoom, fs = Math.max(12, 13 / Math.max(0.5, z)); ctx.save(); ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)'; const s = `【T】${pet.name}`; ctx.strokeText(s, e.x, e.y + 34); ctx.fillStyle = '#ffe8c0'; ctx.fillText(s, e.x, e.y + 34); ctx.restore(); }
    } });
  }
  private drawBugs(ctx: G, e: PetEnt, flying: boolean, lv: number) {
    const n = 10 + lv * 2;
    const cy = e.y - (flying ? 70 : 34);
    ctx.save();
    ctx.fillStyle = 'rgba(30,30,24,0.14)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 30, 8, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < n && i < e.dots.length; i++) {
      const d = e.dots[i]; const a = d.a + e.t * d.s * (e.atk > 0 ? 2 : 1);
      const r = d.r * (1 + e.atk * 0.8);
      const x = e.x + Math.cos(a) * r, y = cy + Math.sin(a * 1.3) * r * 0.5;
      ctx.fillStyle = '#c89a28'; ctx.beginPath(); ctx.ellipse(x, y, 3.2, 2.2, a, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,170,0.9)'; ctx.beginPath(); ctx.arc(x - 0.8, y - 0.8, 1, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(e.x, cy, 0, e.x, cy, 50); gr.addColorStop(0, 'rgba(255,210,90,0.18)'); gr.addColorStop(1, 'rgba(255,210,90,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(e.x, cy, 50, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
