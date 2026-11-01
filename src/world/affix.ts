// 第三十五步：精英词缀 —— 野外的妖兽 / 修士随妖气（离新手村越远）越强，并有机会带上词缀。
// 词缀改写行为与数值：狂暴、灵盾、分裂、吸血、召唤、反伤、隐匿、焚身、爆裂、疾风、坚甲、雷殛。
// 精英：血量 ×1.6（每多一条 ×1.3）、攻击 ×1.15、名字前缀、掉落更好；地面有对应颜色的旋转法纹（elitegl.ts 绘制）。
import type { Combat, Enemy } from './combat';
import { giveWard } from './foemind';
import { isBoss } from './foeskills';
import { audio } from './audio';

export type AffixId = 'kuang' | 'dun' | 'fen' | 'xi' | 'zhao' | 'fan' | 'yin' | 'fen2' | 'bao' | 'ji' | 'jian' | 'lei';
export interface AffixDef { id: AffixId; name: string; col: string; desc: string; beastOnly?: boolean; humanOnly?: boolean }
export const AFFIX: Record<AffixId, AffixDef> = {
  kuang: { id: 'kuang', name: '狂暴', col: '255,70,50', desc: '血量过半后攻击 ×1.5、身法 ×1.3，出招更急' },
  dun: { id: 'dun', name: '灵盾', col: '120,190,255', desc: '护体灵光，被打碎后数息重凝' },
  fen: { id: 'fen', name: '分裂', col: '130,220,90', desc: '死后裂为两只', beastOnly: true },
  xi: { id: 'xi', name: '吸血', col: '220,30,60', desc: '伤你时回复伤害的四分之一' },
  zhao: { id: 'zhao', name: '召唤', col: '190,120,255', desc: '每隔十余息唤来同类' },
  fan: { id: 'fan', name: '反伤', col: '230,230,240', desc: '受击时反震一成半伤害' },
  yin: { id: 'yin', name: '隐匿', col: '150,150,170', desc: '时隐时现，现形后第一击加重' },
  fen2: { id: 'fen2', name: '焚身', col: '255,140,40', desc: '周身烈焰灼烧近身之敌' },
  bao: { id: 'bao', name: '爆裂', col: '255,200,80', desc: '临死自爆，须及时退开' },
  ji: { id: 'ji', name: '疾风', col: '140,240,220', desc: '身法 ×1.45，招式冷却更快' },
  jian: { id: 'jian', name: '坚甲', col: '200,170,110', desc: '防御 ×1.8，受击击退大减' },
  lei: { id: 'lei', name: '雷殛', col: '170,180,255', desc: '周期性招来天雷劈向你的落脚处' },
};
const IDS = Object.keys(AFFIX) as AffixId[];

/** 每只精英的运行状态 */
export interface AffixState { ids: AffixId[]; kuangOn?: boolean; zhaoT: number; yinT: number; yinOn: boolean; yinHit?: boolean; burnT: number; leiT: number; fanT: number; dunInit?: boolean }

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 生成时掷词缀：k 为妖气档（0–8），boss / 巢穴必带 1–2 条 */
export function rollAffix(e: Enemy, k: number, force = 0) {
  if (e.npcId || e.spar || e.pursuer || e.minion || e.def.kind === 'mortal' as any) return;
  const boss = isBoss(e);
  let n = force;
  if (!n) {
    const ch = 0.06 + k * 0.035 + (e.realm >= 3 ? 0.05 : 0);
    if (boss) n = Math.random() < 0.5 + k * 0.05 ? 2 : 1;
    else if (Math.random() < ch) n = Math.random() < 0.12 + k * 0.04 ? 2 : 1;
    if (n && k >= 6 && Math.random() < 0.25) n++;
  }
  if (!n) return;
  const human = e.def.kind === 'human';
  const pool = IDS.filter((id) => !(AFFIX[id].beastOnly && (human || boss)) && !(AFFIX[id].humanOnly && !human));
  const ids: AffixId[] = [];
  while (ids.length < n && pool.length) { const i = Math.floor(Math.random() * pool.length); ids.push(pool[i]); pool.splice(i, 1); }
  applyAffix(e, ids);
}

export function applyAffix(e: Enemy, ids: AffixId[]) {
  if (!ids.length) return;
  const A: AffixState = { ids, zhaoT: rand(5, 9), yinT: rand(3, 6), yinOn: false, burnT: 1, leiT: rand(4, 7), fanT: 0 };
  e.affix = A;
  const boss = isBoss(e);
  const hpK = (boss ? 1.25 : 1.6) * Math.pow(1.3, ids.length - 1);
  e.maxHp = e.hp = Math.round(e.maxHp * hpK);
  e.atk *= boss ? 1.08 : 1.15;
  if (ids.includes('ji')) { e.speed *= 1.45; }
  if (ids.includes('jian')) e.dfn *= 1.8;
  if (ids.includes('dun')) { e.wardFrac = 0.35; e.wardCol = AFFIX.dun.col; }
  if (!boss && !e.def.lair) e.name = `${AFFIX[ids[0]].name}·${e.name}`;
}

/** 每帧（仅在交战中调用） */
export function affixTick(c: Combat, e: Enemy, dt: number, dist: number) {
  const A = e.affix; if (!A) return;
  const g = c.game, p = g.player, has = (id: AffixId) => A.ids.includes(id);
  if (has('dun')) { if (!A.dunInit) { A.dunInit = true; giveWard(c, e, 0.35, AFFIX.dun.col, false); } else if (!e.ward && e.wardRe <= 0) e.wardRe = 7; }
  if (has('kuang') && !A.kuangOn && e.hp < e.maxHp * 0.5) {
    A.kuangOn = true; e.atk *= 1.5; e.speed *= 1.3; e.skT = Math.min(e.skT, 0.3);
    c.texts.push({ x: e.x, y: e.y - 150, s: '狂暴！', color: '#ff6a4a', t: 0, vy: -26, big: true });
    c.fxq.push({ k: 'roar', x: e.x, y: e.y - 50, color: AFFIX.kuang.col });
    g.juice(0.05, 0.3); audio.sfx('boom');
  }
  if (A.kuangOn || has('ji')) e.skT -= dt * (A.kuangOn && has('ji') ? 0.8 : 0.4);
  if (has('zhao')) {
    A.zhaoT -= dt;
    if (A.zhaoT <= 0 && dist < 1100) {
      A.zhaoT = rand(11, 15);
      let mine = 0; for (const o of c.enemies) if (!o.dead && o.minion && (o as any).owner === e) mine++;
      if (mine < 3) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2, x = e.x + Math.cos(a) * 120, y = e.y + Math.sin(a) * 80;
          const m = c.makeMinion(e.def, x, y, e); if (m) { (m as any).owner = e; c.fxq.push({ k: 'sumpop', x, y, color: AFFIX.zhao.col }); }
        }
        c.texts.push({ x: e.x, y: e.y - 140, s: e.def.kind === 'human' ? '出来！' : '召唤同类！', color: '#d0a0ff', t: 0, vy: -24 });
        audio.sfx('gather');
      }
    }
  }
  if (has('yin')) {
    A.yinT -= dt;
    if (A.yinT <= 0) {
      A.yinOn = !A.yinOn; A.yinT = A.yinOn ? rand(2.5, 3.5) : rand(5, 8);
      c.fxq.push({ k: 'dodge', x: e.x, y: e.y });
      if (A.yinOn) { A.yinHit = true; if (c.lock === e) c.lock = null; }
    }
  }
  if (has('fen2')) {
    A.burnT -= dt;
    if (A.burnT <= 0) {
      A.burnT = 1;
      if (dist < 150) c.hitPlayer(e.atk * 0.35, e.realm, { k: 'burn', dur: 3, ch: 0.5 }, e.x, e.y, e);
    }
  }
  if (has('lei') && dist < 900) {
    A.leiT -= dt;
    if (A.leiT <= 0) {
      A.leiT = rand(5, 7.5);
      const lt = 0.7, x = p.x + (p.st?.vx ?? 0) * lt * 0.6, y = p.y + (p.st?.vy ?? 0) * lt * 0.6;
      c.foe.zone(e, x, y, 120, 'thunder', 1.6, 0.9, { k: 'shock', dur: 1, ch: 0.7 });
    }
  }
  A.fanT = Math.max(0, A.fanT - dt);
}

/** 可见度系数（隐匿时几乎看不见） */
export function affixVis(e: Enemy) { return e.affix?.yinOn ? 0.18 : 1; }

/** 精英出手：隐匿后的偷袭 / 吸血 */
export function affixOutDmg(e: Enemy | undefined, raw: number) {
  const A = e?.affix; if (!A) return raw;
  if (A.yinHit && A.yinOn) { A.yinHit = false; A.yinOn = false; A.yinT = rand(5, 8); return raw * 1.6; }
  return raw;
}
export function affixDealt(c: Combat, e: Enemy | undefined, dealt: number) {
  const A = e?.affix; if (!A || !e || e.dead || dealt <= 0) return;
  if (A.ids.includes('xi')) {
    const heal = Math.min(e.maxHp - e.hp, dealt * 0.25);
    if (heal > 0) { e.hp += heal; c.texts.push({ x: e.x, y: e.y - 96, s: '+' + Math.round(heal), color: '#ff5a7a', t: 0, vy: -40 }); }
  }
}
/** 受击：反伤 / 坚甲减击退 */
export function affixOnHurt(c: Combat, e: Enemy, d: number) {
  const A = e.affix; if (!A) return;
  if (A.ids.includes('fan') && A.fanT <= 0 && d > 2) {
    A.fanT = 0.35;
    const p = c.game.player;
    if (Math.hypot(p.x - e.x, p.y - e.y) < 900) c.hitPlayer(d * 0.15 + c.pStats.def * 0.8, c.game.hero.realm, undefined, e.x, e.y);
  }
  if (A.ids.includes('jian')) { e.kx *= 0.3; e.ky *= 0.3; }
  if (A.yinOn) { A.yinOn = false; A.yinT = rand(4, 6); }
}
/** 死亡：分裂 / 爆裂 / 额外掉落 */
export function affixOnKill(c: Combat, e: Enemy) {
  const A = e.affix; if (!A) return;
  if (A.ids.includes('fen')) {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2, x = e.x + Math.cos(a) * 70, y = e.y + Math.sin(a) * 50;
      const m = c.makeMinion(e.def, x, y, e);
      if (m) { m.maxHp = m.hp = Math.round(e.maxHp / (1.6 * Math.pow(1.3, A.ids.length - 1)) * 0.35); m.realm = e.realm; m.stage = e.stage; m.atk = e.atk / 1.15 * 0.7; c.fxq.push({ k: 'sumpop', x, y, color: AFFIX.fen.col }); }
    }
    c.texts.push({ x: e.x, y: e.y - 120, s: '分裂！', color: '#a8f080', t: 0, vy: -26, big: true });
  }
  if (A.ids.includes('bao')) {
    c.foe.zone(e, e.x, e.y, 230, 'fire', 2.6, 0.95, { k: 'burn', dur: 4, ch: 0.8 });
    c.texts.push({ x: e.x, y: e.y - 120, s: '要自爆了！快退！', color: '#ffd060', t: 0, vy: -20, big: true });
  }
  // 掉落：灵石 + 一份额外材料 / 卷轴
  const n = A.ids.length;
  c.dropLoot(e.x, e.y, 'mat_lingshi', Math.round(12 * Math.pow(3, Math.max(0, e.realm - 1)) * n * rand(0.8, 1.4)));
  const drops = e.def.drops; if (drops.length) { const dr = drops[Math.floor(Math.random() * drops.length)]; c.dropLoot(e.x, e.y, dr.id, 1); }
  if (Math.random() < 0.18 * n) { const sk = c.randomScroll(Math.min(4, e.realm + 1)); if (sk) c.dropLoot(e.x, e.y, sk, 1); }
  if (e.blv && Math.random() < 0.5) c.dropLoot(e.x, e.y, 'mat_yaodan' + e.blv, 1);
}
