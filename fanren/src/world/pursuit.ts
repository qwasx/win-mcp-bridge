// 第十四步：追杀（“韩跑跑”）
// 被更强的修士以神识锁定：对方御器紧追、远远祭出飞剑逼你闪躲；
// 你要靠遁光、遁术、敛息、遁入宗门/坊市，才能把对方甩出神识之外。
// 追杀者平时不在战斗名单里（太远），靠近后作为一名强敌加入战斗；被追上就是一场越阶死战。
import type { Game } from './game';
import { Enemy } from './combat';
import { ENEMY_LIST, EnemyDef } from '../data/enemies';
import { REALMS, realmName, expNeed } from '../data/realms';
import { itemDef } from '../data/items';
import * as C from './cultivation';
import { audio } from './audio';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

interface Faction { id: string; name: string; robe: string; evil: boolean; color: string; fx: 'sword' | 'blood' | 'fireball' | 'ghost' }
const FACTIONS: Faction[] = [
  { id: 'guiling', name: '鬼灵门', robe: '#2a1f34', evil: true, color: '170,90,230', fx: 'ghost' },
  { id: 'hehuan', name: '合欢宗', robe: '#7a2a48', evil: true, color: '255,120,170', fx: 'blood' },
  { id: 'yuling', name: '御灵宗', robe: '#3a3424', evil: true, color: '200,170,90', fx: 'fireball' },
  { id: 'tiansha', name: '天煞宗', robe: '#3a0a14', evil: true, color: '230,40,50', fx: 'blood' },
  { id: 'sanxiu', name: '散修', robe: '#3c3c44', evil: false, color: '200,230,240', fx: 'sword' },
  { id: 'jiexiu', name: '劫修', robe: '#2a3440', evil: false, color: '220,220,200', fx: 'sword' },
];
const SURN = '王张刘陈杨赵周吴徐孙马朱胡郭何高罗郑梁谢宋唐许冯邓曹彭曾萧田董潘袁蔡蒋余叶程苏魏吕丁沈任姚卢钟陆秦尹孟温柳';
const MN = ['冥', '烈', '寒', '枭', '厉', '玄', '啸', '铁', '幽', '血', '鹤', '岳', '霄', '鸿', '沧', '峥', '戾', '魁'];
const TAUNT = ['小辈，交出东西，饶你不死！', '哪里逃！', '跑得了一时，跑不了一世。', '你的遁光，比你的修为有意思多了。', '老夫倒要看看，你还有几张遁符。', '束手就擒，留你全尸！'];

export interface PursuitInit { reason: string; gap?: number; faction?: string; name?: string; delay?: number }

export interface Pursuer {
  e: Enemy; name: string; faction: Faction; reason: string;
  realm: number; stage: number;
  lockR: number; chase: number;
  t: number; outT: number; safeT: number; tauntT: number; longT: number;
  lastX: number; lastY: number; searching: boolean;
  lost: boolean;   // 失去踪迹（遁入地下/隐身）
}

export class PursuitSys {
  cur: Pursuer | null = null;
  pending: { init: PursuitInit; t: number } | null = null;
  /** 冷却：两次追杀之间至少隔这么多秒 */
  cd = 90;
  constructor(public g: Game) {}

  get active() { return !!this.cur; }
  reset() { if (this.cur) { const i = this.g.combat.enemies.indexOf(this.cur.e); if (i >= 0) this.g.combat.enemies.splice(i, 1); } this.cur = null; this.pending = null; this.cd = 90; }
  /** 本次追杀的“摆脱”所需秒数（敛息更快） */
  get needOut() { return this.g.concealed ? 3 : 5; }

  /** 稍后触发（取宝后被人尾随等） */
  schedule(init: PursuitInit) {
    if (this.cur || this.pending || this.cd > 0) return false;
    this.pending = { init, t: init.delay ?? rand(6, 14) };
    return true;
  }

  start(init: PursuitInit): boolean {
    const g = this.g, h = g.hero, p = g.player;
    if (this.cur || h.realm < 1 || h.dead) return false;
    const gap = init.gap ?? 1;
    const realm = Math.min(5, h.realm + gap);
    const stage = gap > 0 ? Math.floor(rand(0, REALMS[realm].stages.length)) : REALMS[realm].stages.length - 1;
    const fac = FACTIONS.find((f) => f.id === init.faction) ?? pick(FACTIONS);
    const name = init.name ?? (SURN[Math.floor(Math.random() * SURN.length)] + pick(MN) + (Math.random() < 0.5 ? pick(MN) : ''));
    const base = ENEMY_LIST.find((d) => d.id === (realm >= 3 ? 'jindan_mo' : 'zhujixiu')) ?? ENEMY_LIST[0];
    const r = base.ranged!;
    const def: EnemyDef = {
      ...base, id: 'pursuer', name, title: fac.name, robe: fac.robe, evil: fac.evil, flying: true, aggro: 1e6,
      hp: 1.35, atk: 1.1, def: 1.1, speed: 230,
      ranged: { ...r, fx: fac.fx === 'ghost' ? 'blood' : fac.fx, color: fac.color, range: 640, cd: 1.5, count: realm >= 3 ? 3 : 1 },
      drops: [{ id: 'mat_lingshi', ch: 1, n: [60 * realm * realm, 140 * realm * realm] }, { id: realm >= 3 ? 'pill_jiangchen' : 'pill_zhuji', ch: 0.25 }, { id: 'tal_tianleizi', ch: 0.35 }, { id: realm >= 3 ? 'art_zhuxie' : 'art_yinhui', ch: 0.3 }],
    };
    // 从身后、神识边缘之外出现
    const mv = p.st && Math.hypot(p.st.vx, p.st.vy) > 10;
    const back = mv ? Math.atan2(-p.st.vy, -p.st.vx) : Math.atan2(-(p.st ? Math.cos(p.st.yaw) : 1), -(p.st ? Math.sin(p.st.yaw) : 0));
    const d0 = rand(1500, 1900);
    const x = p.x + Math.cos(back + rand(-0.6, 0.6)) * d0, y = p.y + Math.sin(back + rand(-0.6, 0.6)) * d0 * 0.8;
    const e = new Enemy(def, x, y, realm, stage);
    e.name = name; e.aggro = false; e.boss = true;
    const lockR = realm >= 4 ? 5200 : realm >= 3 ? 3400 : 2400;
    const chase = REALMS[realm].speed * 1.8 * 0.92;
    this.cur = { e, name, faction: fac, reason: init.reason, realm, stage, lockR, chase, t: 0, outT: 0, safeT: 0, tauntT: rand(5, 9), longT: rand(4, 6), lastX: p.x, lastY: p.y, searching: false, lost: false };
    g.toast(`${init.reason}——${fac.name}${name}（${realmName(realm, stage)}）以神识锁定了你，御器追来！`, 'warn');
    audio.sfx('fail'); audio.sfx('thunder');
    g.hurtFlash = Math.max(g.hurtFlash, 0.5); g.juice(0.05, 0.4);
    if (g.renderer) g.renderer.sense.alarm = 1;
    g.hint('pursuit', '被追杀了！越阶硬拼几乎必死：Shift 催动遁光（飞行时）、用遁术或遁符、R 敛息，或逃进宗门/坊市。甩出对方神识范围数息即可脱身。');
    return true;
  }

  private end(kind: 'escaped' | 'safe' | 'killed' | 'timeout' | 'dead') {
    const g = this.g, P = this.cur!, h = g.hero, who = `${P.faction.name}${P.name}`;
    const e = P.e;
    if (!e.dead) { const i = g.combat.enemies.indexOf(e); if (i >= 0) g.combat.enemies.splice(i, 1); }
    this.cur = null; this.cd = 240;
    if (kind === 'dead') return;
    const secs = Math.round(P.t);
    if (kind === 'killed') {
      g.toast(`反杀！${who}陨落，储物袋落在一旁。`, 'good');
      g.news(`韩立被${who}（${realmName(P.realm, P.stage)}）追杀，竟越阶反杀之。`, 'personal');
      (h.stats as any).escapes = ((h.stats as any).escapes ?? 0) + 1;
      return;
    }
    const exp = expNeed(h.realm, h.stage) * (kind === 'escaped' ? 0.03 : 0.015);
    C.gainExp(h, exp, []);
    (h.stats as any).escapes = ((h.stats as any).escapes ?? 0) + 1;
    const line = kind === 'safe' ? `${who}不敢在此动手，在外盘旋良久，恨恨而去。` : kind === 'timeout' ? `${who}终究没能追上，悻悻收了遁光。` : `甩开了${who}的神识锁定！`;
    g.toast(`${line}（历练 修为 +${Math.round(exp)}）`, 'good');
    audio.sfx('chime');
    g.news(`韩立遭${who}（${realmName(P.realm, P.stage)}）追杀${secs > 60 ? '良久' : ''}，${kind === 'safe' ? '遁入城中才保住性命' : '凭遁术脱身'}。`, 'personal');
  }

  update(dt: number) {
    const g = this.g, h = g.hero, p = g.player;
    if (this.cd > 0) this.cd -= dt;
    if (this.pending && !this.cur) { this.pending.t -= dt; if (this.pending.t <= 0) { const it = this.pending.init; this.pending = null; this.start(it); } }
    const P = this.cur; if (!P) return;
    if (h.dead) { this.end('dead'); return; }
    const e = P.e;
    if (e.dead) { this.end('killed'); return; }
    P.t += dt;
    const c = g.combat;
    const stealth = (c.buffs.until.stealth ?? 0) > g.time;
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy);
    const safe = c.safeAt(p.x, p.y);
    // 敛息时，锁定范围大减（但近在咫尺仍逃不掉）
    const lockR = P.lockR * (g.concealed ? 0.6 : 1);
    // 失踪：遁地/隐身——追杀者扑向最后看到的位置
    if (stealth) { if (!P.lost) { P.lost = true; P.searching = true; } }
    else if (P.lost) {
      P.lost = false;
      if (dist > lockR * 0.55) { g.toast(`${P.name}失去了你的踪迹！`, 'good'); this.end('escaped'); return; }
    }
    if (!P.lost) { P.lastX = p.x; P.lastY = p.y; }
    // 追击（远距离由本系统驱动；近身后战斗 AI 也会接手攻击）
    const tx = P.lastX, ty = P.lastY, ddx = tx - e.x, ddy = ty - e.y, dd = Math.hypot(ddx, ddy);
    const stop = safe ? 520 : P.lost ? 20 : 420;
    if (dd > stop) {
      const sp = P.chase * (P.lost ? 0.8 : 1) * (e.st.slow ? 0.5 : 1) * (e.st.freeze || e.st.stun || e.st.root ? 0 : 1);
      const k = Math.min(1, sp * dt / dd);
      const nx = e.x + ddx * k, ny = e.y + ddy * k;
      if (!c.safeAt(nx, ny)) { e.x = nx; e.y = ny; }
      e.anim.move = 1; e.facing = ddx > 0 ? 1 : -1;
      if (e.cs) { e.cs.faceToward(ddx, ddy, false); }
    }
    e.hx = e.x; e.hy = e.y;   // 不受“离家太远”限制
    e.speed = dist > 700 ? 0 : 200;   // 远距离只由追击驱动（战斗 AI 不再叠加移动），近身才走位
    // 保持在战斗名单里（够近时）
    if (dist < 4200 && !c.enemies.includes(e)) c.enemies.push(e);
    // 远程飞剑：600–1500 之间每隔数息一记，逼你闪躲
    P.longT -= dt;
    if (!P.lost && !safe && P.longT <= 0 && dist > 560 && dist < 1500) {
      P.longT = rand(3.5, 5.5);
      const ang = Math.atan2(p.y - 40 - (e.y - 70), p.x - e.x), spd = 1150;
      const r = e.def.ranged!;
      c.projs.push({ fac: 'e', x: e.x, y: e.y - 70, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0, max: 1700 / spd, fx: P.faction.fx === 'sword' ? 'sword' : r.fx, color: P.faction.color, dmg: e.atk * 1.3, realm: e.realm, stCh: 0, pierce: false, homing: false, hit: new Set(), r: 30, aoe: 0, size: 1.3, trail: [], lv: 0 } as any);
      audio.sfx('sword');
    }
    // 喊话
    P.tauntT -= dt;
    if (P.tauntT <= 0 && !P.lost) { P.tauntT = rand(9, 15); if (dist < lockR) c.texts.push({ x: p.x, y: p.y - 150, s: `${P.name}：「${pick(TAUNT)}」`, color: '#ffb0a0', t: 0, vy: -16 } as any); }
    // 锁定期间神识圈泛红
    if (g.renderer && dist < lockR && !P.lost) g.renderer.sense.alarm = Math.max(g.renderer.sense.alarm, 0.45);
    // 摆脱判定
    if (safe) { P.safeT += dt; if (P.safeT > 15) { this.end('safe'); return; } }
    else P.safeT = Math.max(0, P.safeT - dt * 2);
    if (dist > lockR && !P.lost) { P.outT += dt; if (P.outT >= this.needOut) { this.end('escaped'); return; } }
    else P.outT = Math.max(0, P.outT - dt * 2);
    if (P.t > 300 && dist > 1500) this.end('timeout');
  }

  /** HUD 用 */
  info() {
    const P = this.cur; if (!P) return null;
    const p = this.g.player, e = P.e, dist = Math.hypot(p.x - e.x, p.y - e.y);
    const lockR = P.lockR * (this.g.concealed ? 0.6 : 1);
    return { name: P.name, faction: P.faction.name, evil: P.faction.evil, rank: realmName(P.realm, P.stage), dist, lockR, out: P.outT / this.needOut, safe: P.safeT / 15, lost: P.lost, x: e.x, y: e.y, hp: e.hp / e.maxHp, reason: P.reason };
  }
  /** 物品价值触发：取宝 / 拍卖 / 杀人之后 */
  maybe(reason: string, chance: number, gap = 1) {
    if (Math.random() < chance) return this.schedule({ reason, gap });
    return false;
  }
}

/** 物品是否值钱到会招人觊觎 */
export function covetValue(ids: string[]) { return ids.reduce((s, id) => s + (itemDef(id).price || 0), 0); }
