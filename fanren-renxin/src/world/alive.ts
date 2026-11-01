// 第四十六步「众生」：让人真的活起来——
//  · 作息：晨起练剑、午后赶集、黄昏归家、夜里打坐；下雨躲雨、落雪跺脚、起风拢衣
//  · 看得见的营生：扫地、挑水、浣衣、劈柴、练剑、对练、吹笛、作画、焚香礼佛、看榜、下棋、醉汉、说书与听书、迎亲队伍
//  · 心声：走近的人头顶会冒出"心里话"（云朵泡），和他眼下的打算、天气、你的境界、他对你的观感有关
//  · 反应：你御剑飞过时凡人抬头指点、你境界远高时行礼让路、你受伤时好心人上前、你突破时众人驻足跪拜
import type { NpcData } from './npc';
import type { Game } from './game';
import { PLAN_NAME } from './living';
import { locsOf, ACTIVE_MAP, WORLD_SCALE } from '../data/world';
import { LANDMARKS } from '../data/landmarks';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const pk = <T,>(x: T[]) => x[Math.floor(Math.random() * x.length)];

export type AliveK = 'sword' | 'spar' | 'sweep' | 'carry' | 'wash' | 'chop' | 'flute' | 'paint' | 'pray' | 'tea' | 'chess' | 'drunk' | 'tell' | 'listen' | 'parade' | 'shelter' | 'kneel' | 'bow' | 'gaze' | 'herb' | 'stretch';
export const ALIVE_NAME: Record<AliveK, string> = { sword: '练剑', spar: '对练', sweep: '扫地', carry: '挑水', wash: '浣衣', chop: '劈柴', flute: '吹笛', paint: '写生', pray: '礼佛', tea: '吃茶', chess: '对弈', drunk: '醉酒', tell: '说书', listen: '听书', parade: '迎亲', shelter: '躲雨', kneel: '跪拜', bow: '行礼', gaze: '仰望', herb: '晒药', stretch: '舒展筋骨' };

/** 活跃 NPC 需要的最小接口（避免循环引用） */
export interface AliveActor {
  d: NpcData; st: any; act: string; wait: number;
  life?: { k: string; dir: number; with?: AliveActor; lines?: string[]; li?: number; lt?: number; cx?: number; cy?: number; ware?: number; ph?: number; n?: number };
  bubble?: { text: string; t: number; mind?: boolean; mindReal?: boolean };
  /** 心声计时、上一次心声 */
  mindT?: number; mindLast?: string; mindReal?: boolean;
  /** 反应冷却 */
  reactCd?: number;
}

const isWet = (g: Game) => g.weather.kind === 'rain' || g.weather.kind === 'storm';
const hourOf = (g: Game) => (g.dayPhase * 24 + 6) % 24;   // 游戏里 dayPhase 0 = 日出前；近似成时辰
function nearLoc(_g: Game, x: number, y: number, types: string[], r = 1500) {
  for (const l of locsOf(ACTIVE_MAP)) if (types.includes(l.type) && Math.hypot(l.x * WORLD_SCALE - x, l.y * WORLD_SCALE - y) < r) return l;
  return null;
}
function nearScenic(x: number, y: number, r: number) {
  for (const L of LANDMARKS) if ((L as any).scenic && Math.hypot(L.x - x, L.y - y) < r + L.r) return L;
  return null;
}
function nearWater(g: Game, x: number, y: number, R = 220) {
  const T = g.terrain;
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, wx = x + Math.cos(a) * R, wy = y + Math.sin(a) * R * 0.75; if (!T.isLand(wx, wy) || T.riverEdge(wx, wy) < 0) return a; }
  return null;
}

/** 到达一处落脚点时：按作息、天气、身份挑一件"看得见的事"做（加权随机，几乎人人有事故） */
export function pickAlive(g: Game, a: AliveActor, others: AliveActor[]): boolean {
  const d = a.d, st = a.st, h = hourOf(g), night = g.night, wet = isWet(g);
  const mortal = d.faction === 'mortal';
  const sectP = nearLoc(g, st.x, st.y, ['sect'], 2400);
  const townP = nearLoc(g, st.x, st.y, ['town', 'city', 'isle'], 1800);
  const wat = nearWater(g, st.x, st.y, 280);
  const scenic = nearScenic(st.x, st.y, 1200);
  const set = (k: AliveK, wait: number, extra: Partial<NonNullable<AliveActor['life']>> = {}) => { a.life = { k, dir: Math.random() * TAU, ...extra }; a.wait = wait; a.act = 'idle'; return true; };
  const sit = (wait: number) => { a.life = undefined; a.act = 'sit'; a.wait = wait; return true; };
  // 可选活动（按条件收集，再按权重挑一个）
  const opt: [AliveK, number, number, Partial<NonNullable<AliveActor['life']>>?][] = [];   // [活动, 权重, 时长]
  const morning = h >= 5 && h < 11 && night < 0.35, evening = h >= 16 && h < 19;

  // —— 先看有没有同伴能一起做事
  const near = others.filter((o) => o !== a && o.d.alive && !o.life && !(o as any).enemy && !(o as any).duel && o.act !== 'follow' && o.act !== 'flee' && o.act !== 'approach');
  const mate = (pred: (o: AliveActor) => boolean, r: number) => near.filter((o) => pred(o) && Math.hypot(o.st.x - st.x, o.st.y - st.y) < r);
  const pair = (k: AliveK, b: AliveActor, dur: number, face = true) => {
    a.life = { k, dir: 0, with: b, lt: 0.5 }; b.life = { k, dir: 0, with: a, lt: 2.2 };
    a.wait = b.wait = dur; a.act = b.act = k === 'chess' || k === 'tea' ? 'sit' : 'idle';
    if (face) { st.faceToward(b.st.x - st.x, b.st.y - st.y); b.st.faceToward(st.x - b.st.x, st.y - b.st.y); }
    return true;
  };

  if (mortal) {
    // 晨起：挑水、劈柴、扫地
    if (morning) { opt.push(['carry', 3, 14 + Math.random() * 10], ['chop', 2.4, 12 + Math.random() * 10, { lt: 0 }], ['sweep', townP ? 2 : 0.6, 12 + Math.random() * 10, { lt: 0 }]); }
    if (townP) { opt.push(['sweep', 1.6, 12 + Math.random() * 10, { lt: 0 }], ['carry', 1.4, 14 + Math.random() * 8, { lt: 0, ph: 0 }], ['herb', 1.2, 12 + Math.random() * 10]); if (h >= 8 && h < 18) opt.push(['herb', 0.8, 10 + Math.random() * 8]); }
    if (wat !== null) { if (d.sex === 'f') opt.push(['wash', 3, 16 + Math.random() * 16, { dir: wat }]); opt.push(['herb', 1, 12 + Math.random() * 10]); if (night > 0.4) opt.push(['stretch', 0.8, 8 + Math.random() * 6]); }
    if (wet) opt.push(['shelter', 4, 10 + Math.random() * 14]);
    if (night > 0.55 && townP && d.sex === 'm') opt.push(['drunk', 2.2, 14 + Math.random() * 12, { lt: 0 }]);
    if (scenic) opt.push(['gaze', 1.4, 10 + Math.random() * 12, { cx: st.x + Math.cos(Math.random() * TAU) * 200, cy: st.y - 100 }]);
    // 结伴：吃茶、下棋、听书
    const same = mate((o) => o.d.faction === 'mortal', 340);
    if (same.length && townP) { opt.push(['tea', 2.6, 18 + Math.random() * 14], ['chess', 2.2, 22 + Math.random() * 18]); }
    const crowd = mate(() => true, 760);
    if (crowd.length >= 2 && townP && h >= 10 && h < 18 && !wet) opt.push(['tell', 1.6, 30 + Math.random() * 18]);
    if (night > 0.6) opt.push(['gaze', 1, 8 + Math.random() * 8, { cx: st.x, cy: st.y - 140 }]);
  } else {
    // 修士
    if (morning || sectP) opt.push(['sword', sectP ? 3.4 : 1.8, 16 + Math.random() * 16, { lt: 0 }], ['stretch', 1.2, 8 + Math.random() * 6]);
    if (night > 0.45) opt.push(['sword', 0.8, 12 + Math.random() * 12, { lt: 0 }]);
    if (wat !== null) opt.push(['flute', (d.pers === 'aloof' ? 3 : 1.2), 18 + Math.random() * 18, { lt: 0 }], ['paint', (d.pers === 'kind' || d.pers === 'aloof' ? 2.4 : 0.8), 18 + Math.random() * 18, { lt: 0 }]);
    if (scenic) { opt.push(['paint', 1.6, 18 + Math.random() * 16, { lt: 0 }], ['gaze', 1.8, 10 + Math.random() * 12, { cx: (scenic as any).x ?? st.x, cy: (scenic as any).y ?? st.y - 60 }]); if (/庵|寺|佛|塔|观/.test(scenic.name ?? '')) opt.push(['pray', 2.6, 10 + Math.random() * 12]); }
    if (townP) opt.push(['tea', 1.6, 14 + Math.random() * 12, { lt: 1 }]);
    if (wet) opt.push(['shelter', 2.4, 8 + Math.random() * 10]);
    const same = mate((o) => o.d.faction !== 'mortal', 420);
    if (same.length && (morning || sectP)) opt.push(['spar', 2.6, 18 + Math.random() * 14]);
    if (same.length) opt.push(['tea', 1.8, 16 + Math.random() * 12], ['chess', 1.4, 20 + Math.random() * 16]);
    // 打坐吐纳：修士的常事（夜里最盛）
    opt.push(['stretch', 0.6, 8 + Math.random() * 6]);
  }
  if (!opt.length) return false;
  let tot = 0; for (const o of opt) tot += o[1];
  let r = Math.random() * tot;
  for (const [k, w, dur, extra] of opt) {
    r -= w; if (r > 0) continue;
    if (k === 'tell') {
      const crowd = mate(() => true, 760).slice(0, 6);
      set('tell', dur, { lt: 0.6, li: 0 }); st.faceToward(0, 1);
      crowd.forEach((o, i) => { const an = Math.PI * 0.12 + i / 6 * Math.PI * 0.76, rr = 110 + (i % 2) * 52; o.life = { k: 'listen', dir: 0, with: a, cx: st.x + Math.cos(an) * rr, cy: st.y + 30 + Math.sin(an) * rr * 0.6, lt: 2 + Math.random() * 6 }; o.wait = dur - 2; o.act = 'walk'; (o as any).path = undefined; });
      return true;
    }
    if (k === 'spar' || k === 'tea' || k === 'chess') {
      const pool = k === 'spar' ? mate((o) => o.d.faction !== 'mortal', 420) : k === 'chess' ? mate(() => true, 340) : mate(() => true, 340);
      const b = pool[Math.floor(Math.random() * pool.length)];
      if (b) return pair(k, b, dur);
      continue;
    }
    if (k === 'gaze') { const cx = (extra as any)?.cx ?? st.x, cy = (extra as any)?.cy ?? st.y - 120; a.life = { k: 'gaze', dir: 0, cx, cy, lines: Math.random() < 0.5 ? [pk(['好景。', '此处灵气清正。', '（望得出神）', '湖光山色，尽收眼底。'])] : [], li: 0, lt: 1 }; a.wait = dur; a.act = 'idle'; st.faceToward(cx - st.x, cy - st.y); return true; }
    return set(k, dur, extra);
  }
  // 什么都没挑上：坐一会儿
  return sit(6 + Math.random() * 10);
}

/** 日常进行中：动作、台词、道具相位 */
export function tickAlive(g: Game, a: AliveActor, dt: number): boolean {
  const L = a.life; if (!L) return false;
  const st = a.st, k = L.k as AliveK;
  if (!(k in ALIVE_NAME)) return false;
  L.lt = (L.lt ?? 0) - dt; L.ph = (L.ph ?? 0) + dt;
  const line = (arr: string[], p = 0.5, t = 2.2) => { if (Math.random() < p) a.bubble = { text: pk(arr), t }; };
  switch (k) {
    case 'sword': {
      // 一招一式：施法动作 1.2 秒一次，中间收势
      const ph = L.ph % 2.4; st.setAction(ph < 1.1 ? 'cast' : 'idle');
      if (ph < 0.05) st.faceToward(Math.cos(L.dir), Math.sin(L.dir));
      if (L.lt <= 0) { L.lt = 6 + Math.random() * 8; L.dir += 1.2 + Math.random(); line(['喝！', '这一式还是差了些火候。', '剑意……剑意……', '再来！', '师父说要练到心剑合一。'], 0.45); }
      break;
    }
    case 'spar': {
      const b = L.with; if (!b || !b.d.alive || b.life?.with !== a) { a.life = undefined; a.wait = Math.min(a.wait, 0.5); return true; }
      st.faceToward(b.st.x - st.x, b.st.y - st.y);
      const ph = (L.ph + (L.with === b && b.life!.lt! > L.lt! ? 0 : 0.8)) % 1.6; st.setAction(ph < 0.7 ? 'cast' : 'idle');
      if (L.lt <= 0) { L.lt = 1.6; const bolts = (a as any).bolts as any[]; if (bolts) bolts.push({ x: st.x, y: st.y - 60, x2: b.st.x + (Math.random() - 0.5) * 40, y2: b.st.y - 60 - st.lift, t: 0, col: a.d.faction === 'demon' ? '255,120,140' : '160,220,255' }); if (Math.random() < 0.2) line(['看招！', '好！再来！', '承让。', '师兄手下留情！', '这招有破绽。'], 1); }
      if (a.wait <= dt) { a.life = undefined; if (b.life?.with === a) b.life = undefined; a.bubble = { text: pk(['今日就到这里。', '受教了。', '明日再战。']), t: 2 }; }
      break;
    }
    case 'sweep': st.setAction('gather'); if (L.lt <= 0) { L.lt = 5 + Math.random() * 6; st.faceToward(Math.cos(L.dir), Math.sin(L.dir)); L.dir += 1.5; line(['这风，刚扫完又落一地。', '哎哟，腰……', '扫帚又该换了。', '今儿个人真多。'], 0.35); } break;
    case 'chop': { const ph = L.ph % 1.4; st.setAction(ph < 0.7 ? 'cast' : 'idle'); if (L.lt <= 0) { L.lt = 7 + Math.random() * 6; line(['嘿——咻！', '这柴够烧三天。', '歇口气。'], 0.4); } break; }
    case 'carry': {
      // 挑着水来回走两趟
      st.setAction('walk'); const sp = 48; const ph = L.ph % 8, dir = ph < 4 ? L.dir : L.dir + Math.PI;
      st.x += Math.cos(dir) * sp * dt; st.y += Math.sin(dir) * sp * dt * 0.6; st.faceToward(Math.cos(dir), Math.sin(dir), true); a.d.x = st.x; a.d.y = st.y;
      if (g.terrain.walkFactor(st.x, st.y) <= 0 || g.space?.blocked(st.x, st.y)) { st.x -= Math.cos(dir) * sp * dt; st.y -= Math.sin(dir) * sp * dt * 0.6; L.dir += Math.PI / 2; }
      if (L.lt <= 0) { L.lt = 6 + Math.random() * 6; line(['水缸又见底了。', '吱呀……吱呀……', '再挑两担就好。'], 0.3); }
      break;
    }
    case 'wash': st.setAction('gather'); if (L.lt <= 0) { L.lt = 6 + Math.random() * 6; line(['这水真凉。', '当家的衣裳又磨破了。', '河里有鱼呢。', '哎，这块泥巴洗不掉。'], 0.35); } break;
    case 'herb': st.setAction('gather'); if (L.lt <= 0) { L.lt = 6 + Math.random() * 6; line(['趁着日头好，晒干些。', '这味药能换两文钱。', '别让鸡给刨了。'], 0.3); } break;
    case 'flute': st.setAction('idle'); if (L.lt <= 0) { L.lt = 8 + Math.random() * 8; line(['……', '（笛声悠悠）', '此曲，只合此景。'], 0.35, 2.8); } break;
    case 'paint': st.setAction('idle'); if (L.lt <= 0) { L.lt = 7 + Math.random() * 8; line(['这一笔，还差些烟气。', '山是好山，水是好水。', '墨太浓了。', '若能把这雾画出来……'], 0.4, 2.6); } break;
    case 'pray': st.setAction('sit'); if (L.lt <= 0) { L.lt = 8 + Math.random() * 8; line(['（合十默祷）', '愿家人平安。', '愿早日筑基。', '南无……'], 0.35); } break;
    case 'tea': case 'chess': {
      const b = L.with; if (!b || !b.d.alive || b.life?.with !== a) { a.life = undefined; a.wait = Math.min(a.wait, 0.5); return true; }
      st.setAction('sit'); st.faceToward(b.st.x - st.x, b.st.y - st.y);
      if (L.lt <= 0) { L.lt = 6 + Math.random() * 7; line(k === 'chess' ? ['将！', '这步……容我想想。', '悔棋可不行。', '落子无悔。', '哈哈，你输了。', '再来一局。'] : ['这茶不错。', '听说了吗？西边又在打仗。', '今年的米价……', '你家小子该说亲了吧。', '慢用慢用。', '前些日子有仙师从天上过。'], 0.5); }
      if (a.wait <= dt) { a.life = undefined; if (b.life?.with === a) b.life = undefined; }
      break;
    }
    case 'drunk': {
      st.setAction('walk'); const sp = 30; L.dir += Math.sin(L.ph * 1.7) * dt * 2.2;
      st.x += Math.cos(L.dir) * sp * dt; st.y += Math.sin(L.dir) * sp * dt * 0.6; st.faceToward(Math.cos(L.dir), Math.sin(L.dir), true); a.d.x = st.x; a.d.y = st.y;
      if (g.terrain.walkFactor(st.x, st.y) <= 0 || g.space?.blocked(st.x, st.y)) { st.x -= Math.cos(L.dir) * sp * dt; st.y -= Math.sin(L.dir) * sp * dt * 0.6; L.dir += 2; }
      if (L.lt <= 0) { L.lt = 4 + Math.random() * 4; line(['嗝——再、再来一坛！', '我、我没醉……', '当年我也差点拜入仙门！', '月亮怎么有两个……', '（哼着跑调的小曲）'], 0.6, 2.4); }
      break;
    }
    case 'tell': {
      st.setAction(L.ph % 3 < 1.5 ? 'cast' : 'idle');
      if (L.lt <= 0) {
        const S = ['话说当年，那韩姓散修孤身入魔道……', '只见一道青光，三丈高的妖王应声而倒！', '啪！（醒木一拍）要知后事如何——', '那仙子回眸一笑，百花失色。', '列位看官，且听我慢慢道来。', '那老祖一掌拍下，山都塌了半边！', '欲知后事如何，且听下回分解。', '赏钱随意，赏钱随意！'];
        L.li = ((L.li ?? 0) + 1) % S.length; a.bubble = { text: S[L.li], t: 3 }; L.lt = 3.6 + Math.random() * 1.5;
      }
      break;
    }
    case 'listen': {
      const b = L.with; if (!b || !b.d.alive || b.life?.k !== 'tell') { a.life = undefined; a.wait = Math.min(a.wait, 0.5); return true; }
      const dx = (L.cx ?? st.x) - st.x, dy = (L.cy ?? st.y) - st.y, dd = Math.hypot(dx, dy);
      if (dd > 14) { const sp = 60; st.x += dx / dd * sp * dt; st.y += dy / dd * sp * dt; st.faceToward(dx, dy); st.setAction('walk'); a.d.x = st.x; a.d.y = st.y; }
      else { st.setAction('idle'); st.faceToward(b.st.x - st.x, b.st.y - st.y); if (L.lt <= 0) { L.lt = 6 + Math.random() * 10; line(['好！', '后来呢后来呢？', '（叫好声）', '这我听过三回了。', '嘘——'], 0.5, 1.8); } }
      break;
    }
    case 'parade': {
      const b = L.with;  // 跟着前面的人走
      st.setAction('walk');
      if (b && b.life?.k === 'parade') { const dx = b.st.x - st.x, dy = b.st.y - st.y, dd = Math.hypot(dx, dy); if (dd > 70) { st.x += dx / dd * 62 * dt; st.y += dy / dd * 62 * dt; st.faceToward(dx, dy); } else st.setAction('idle'); }
      else { const sp = 55; st.x += Math.cos(L.dir) * sp * dt; st.y += Math.sin(L.dir) * sp * dt * 0.6; st.faceToward(Math.cos(L.dir), Math.sin(L.dir), true); if (g.terrain.walkFactor(st.x, st.y) <= 0 || g.space?.blocked(st.x, st.y)) { st.x -= Math.cos(L.dir) * sp * dt; st.y -= Math.sin(L.dir) * sp * dt * 0.6; L.dir += Math.PI / 2; } if (L.lt <= 0) { L.lt = 3; a.bubble = { text: pk(['咚——锵！咚——锵！', '新娘子来喽！', '沾沾喜气！', '噼里啪啦——']), t: 2.4 }; } }
      a.d.x = st.x; a.d.y = st.y;
      break;
    }
    case 'shelter': st.setAction('idle'); if (L.lt <= 0) { L.lt = 6 + Math.random() * 6; line(['这雨下得……', '衣裳都湿透了。', '再等等，该停了。', '唉，今天的活儿泡汤了。', '（跺脚搓手）'], 0.45); } if (!isWet(g)) a.wait = Math.min(a.wait, 1); break;
    case 'kneel': st.setAction('sit'); st.faceToward((L.cx ?? g.player.x) - st.x, (L.cy ?? g.player.y) - st.y); break;
    case 'bow': st.setAction(L.ph % 3 < 1.5 ? 'gather' : 'idle'); st.faceToward((L.cx ?? g.player.x) - st.x, (L.cy ?? g.player.y) - st.y); break;
    case 'gaze': st.setAction('idle'); st.faceToward((L.cx ?? g.player.x) - st.x, (L.cy ?? g.player.y) - st.y); if (L.lines && L.lt <= 0 && (L.li ?? 0) < L.lines.length) { a.bubble = { text: L.lines[L.li ?? 0], t: 2.6 }; L.li = (L.li ?? 0) + 1; L.lt = 3 + Math.random() * 3; } break;
    case 'stretch': st.setAction(L.ph % 2 < 1 ? 'cast' : 'idle'); if (L.lt <= 0) { L.lt = 5; line(['嗯——', '筋骨舒展，神清气爽。'], 0.3); } break;
  }
  if (a.wait <= dt && a.life && (a.life.k as AliveK) in ALIVE_NAME && k !== 'spar' && k !== 'tea' && k !== 'chess') a.life = undefined;
  return true;
}

/** 心声：和他眼下的事有关的一句"心里话"（云朵泡，只对走近的人显示） */
export function thoughtOf(g: Game, a: AliveActor): string | null {
  const d = a.d, h = g.hero, wet = isWet(g), night = g.night, cold = g.weather.kind === 'snow';
  const gap = (d.realm * 13 + d.stage) - (h.realm * 13 + h.stage);
  const T: string[] = [];
  const P = d.plan;
  if (P) {
    const nm = PLAN_NAME[P.k];
    if (P.k === 'cult') T.push('这一关卡了三年了……', '今夜灵气不错，该多坐一会。');
    else if (P.k === 'gather') T.push('听说后山的血芝该熟了。', '再采两株就够换丹药了。');
    else if (P.k === 'hunt') T.push('那头妖狼伤了我师弟……', '妖丹卖了，就能买筑基丹了。');
    else if (P.k === 'trade') T.push('这趟货能赚三成。', '坊市的丹药又涨价了。');
    else if (P.k === 'visit') T.push(`好些年没见${P.who ? '他' : '家里人'}了。`, '该带点什么礼物呢。');
    else if (P.k === 'court') T.push('她今日会不会来……', '这枚玉佩，送还是不送？');
    else if (P.k === 'revenge') T.push('此仇不报，誓不为人。', '再等等，等我修为再高些。');
    else if (P.k === 'rob') T.push('这人的储物袋鼓鼓的……', '最近手头紧，得寻个肥羊。');
    else if (P.k === 'hide') T.push('他们应该找不到这儿……', '不能久留，得换个地方。');
    else if (P.k === 'heal') T.push('伤还没好利索……', '这口血淤在胸口半个月了。');
    else if (P.k === 'mourn') T.push('……', '若是你还在，该多好。');
    else if (P.k === 'farm') T.push('今年雨水足，收成该好。', '娃他娘的病，还得抓两副药。');
    else if (P.k === 'duty') T.push('执事又派差了，烦。', '这个月的贡献还差一截。');
    else T.push(`${nm}……${P.why ? P.why.slice(0, 12) : ''}`);
  }
  if (d.faction === 'mortal') {
    if (wet) T.push('这雨什么时候停……', '屋顶又该漏了。');
    if (night > 0.5) T.push('该回去了，孩子还等着。', '夜路不太平。');
    if (cold) T.push('冷死个人。', '柴火不够过冬的。');
    if (h.realm >= 2 && Math.hypot(d.x - g.player.x, d.y - g.player.y) < 400) T.push('这位……莫不是仙师？', '仙人走路都不沾尘土的。', '别多嘴，别惹祸。');
    if (!T.length) T.push('晌午吃什么好呢。', '赋税又涨了。', '隔壁家的闺女长得真俊。', '腿脚越来越不利索了。', '要是我也有灵根就好了……');
  } else {
    if (gap < -12) T.push('这人修为深不可测……', '是前辈？还是不要招惹。', '好强的威压。');
    else if (gap > 12) T.push('不过一个小辈。', '呵，炼气的小修士也敢在此晃荡。');
    if (d.favor >= 40) T.push('韩道友倒是个靠得住的人。');
    else if (d.favor <= -20 || d.grudge > 0) T.push('是他……先忍一忍。', '早晚找他算账。');
    if (d.pers === 'greedy') T.push('这人身上有什么好东西？', '灵石……灵石……');
    if (d.pers === 'arrogant') T.push('这些凡人真是碍眼。');
    if (d.pers === 'aloof') T.push('浮云朝露，皆是过客。', '山中无甲子。');
    if (d.pers === 'kind') T.push('那孩子怕是饿了，给他块饼。');
    if (d.age > d.life * 0.8) T.push('寿元无多，这一关若过不去……', '大限将至，何去何从。');
    if (wet) T.push('雨中听雷，倒也有几分意境。');
    if (night > 0.5) T.push('月华正盛，正宜吐纳。');
    if (!T.length) T.push('这一带灵气稀薄。', '何时才能结丹……', '师父闭关前说的话，是什么意思？', '那本残卷上的符文……');
  }
  const pick = pk(T);
  const out = (pick === a.mindLast && T.length > 1) ? pk(T.filter((x) => x !== pick)) : pick;
  // 第四十七步：人心——你看到的多半是"表演心声"；被神识压制、或高出对方两个大境界，才见真心
  const v = (g as any).deceit?.thought(g, a, out) as { text: string; real: boolean } | undefined;
  a.mindReal = v ? v.real : true;
  return v ? v.text : out;
}

/** 每帧：心声与对玩家的即时反应 */
export function reactTick(g: Game, a: AliveActor, dt: number, dist: number) {
  const d = a.d, st = a.st, p = g.player, h = g.hero;
  a.reactCd = Math.max(0, (a.reactCd ?? 0) - dt);
  a.mindT = (a.mindT ?? 4 + Math.random() * 10) - dt;
  const quiet = !a.bubble || (a.bubble.t < 0.5 && !a.bubble.mind);
  if (dist < 900 && a.mindT <= 0 && quiet && a.act !== 'flee' && a.act !== 'approach' && a.act !== 'follow' && !(a as any).enemy) {
    a.mindT = 11 + Math.random() * 16;
    const s = thoughtOf(g, a); if (s) { a.bubble = { text: s, t: 3.4, mind: true, mindReal: a.mindReal !== false }; a.mindLast = s; }
  }
  if (a.reactCd > 0 || a.act === 'flee' || a.act === 'approach' || a.act === 'follow' || (a as any).enemy || (a as any).duel) return;
  const L = a.life;
  // 你御剑掠过：凡人抬头指点
  if (p.flying && dist < 520 && d.faction === 'mortal' && Math.random() < dt * 0.9) {
    a.reactCd = 14; const k = (L?.k ?? '') as string;
    if (!L || k === 'sweep' || k === 'carry' || k === 'shelter' || k === 'herb' || k === 'wash') { a.life = { k: 'gaze', dir: 0, cx: p.x, cy: p.y, lines: [pk(['快看！天上有仙人！', '娘咧，真飞起来了！', '那是御剑！是御剑！', '仙师——带我一个！', '别指！仙人不喜欢人指他。'])], li: 0, lt: 0 }; a.wait = Math.max(a.wait, 4); a.act = 'idle'; }
    return;
  }
  // 你境界远高：修士行礼让路，凡人躬身
  const gap = (h.realm * 13 + h.stage) - (d.realm * 13 + d.stage);
  if (dist < 180 && !p.flying && !p.sitting && !g.concealed && gap >= 13 && Math.random() < dt * 1.2 && (!L || !(L.k === 'kneel' || L.k === 'bow'))) {
    a.reactCd = 30;
    a.life = { k: 'bow', dir: 0, cx: p.x, cy: p.y }; a.wait = Math.max(a.wait, 3); a.act = 'idle';
    a.bubble = { text: d.faction === 'mortal' ? pk(['仙师安好！', '（躬身让路）', '小的给仙师请安。']) : pk(['晚辈见过前辈。', '前辈请。', '（抱拳行礼）']), t: 2.4 };
    return;
  }
  // 你受了重伤：好心人上前关切
  if (h.hp < 0.3 && dist < 300 && (d.pers === 'kind' || d.pers === 'righteous') && Math.random() < dt * 0.5) {
    a.reactCd = 60; st.faceToward(p.x - st.x, p.y - st.y);
    a.bubble = { text: d.faction === 'mortal' ? pk(['这位客官，您脸色不好，要不要歇歇？', '哎哟，流了这么多血！']) : pk(['道友伤得不轻，这颗疗伤丹拿去。', '道友可要紧？']), t: 3.4 };
    if (d.faction !== 'mortal' && Math.random() < 0.5) { g.toast(`${d.name}递来一颗疗伤丹。`, 'good'); h.hp = Math.min(1, h.hp + 0.12); }
    return;
  }
  // 魔修见凡人：吓唬；凡人见魔修：躲
  if (d.faction === 'mortal' && h.realm >= 1 && (g as any).story?.mind > 0.3 && dist < 260 && Math.random() < dt * 0.6) { a.reactCd = 40; a.bubble = { text: pk(['这人……身上有股邪气。', '快走快走。']), t: 2.4 }; return; }
}

/** 群体反应（突破天象、斗法）：周围的人停下、看过来、喊、跪 */
export function exclaimAll(g: Game, actives: Iterable<AliveActor>, x: number, y: number, r: number, lines: string[], mode: 'watch' | 'bow' | 'kneel') {
  let i = 0;
  for (const a of actives) {
    if ((a as any).enemy || a.act === 'follow' || a.act === 'flee' || a.act === 'approach' || !a.d.alive) continue;
    const dd = Math.hypot(a.st.x - x, a.st.y - y); if (dd > r) continue;
    const mortal = a.d.faction === 'mortal';
    const k: AliveK = mode === 'kneel' ? (mortal || a.d.realm <= 2 ? 'kneel' : 'bow') : mode === 'bow' ? (mortal ? 'kneel' : 'bow') : 'gaze';
    if (a.life?.with) { const b = a.life.with; if (b.life?.with === a) b.life = undefined; }
    (a as any).path = undefined;
    a.life = { k, dir: 0, cx: x, cy: y, lines: Math.random() < 0.55 ? [pk(lines)] : [], li: 0, lt: 0.4 + (i++ % 5) * 0.9 + Math.random() * 1.5 };
    a.wait = Math.max(a.wait, mode === 'watch' ? 8 : 14); a.act = 'idle';
  }
}

/** 偶发街头事件：迎亲队伍（城镇里、白天、晴天） */
export function maybeParade(g: Game, actives: AliveActor[]): boolean {
  if (g.night > 0.3 || isWet(g)) return false;
  const p = g.player;
  const pool = actives.filter((a) => a.d.alive && a.d.faction === 'mortal' && !a.life && (a.act === 'idle' || a.act === 'walk') && !(a as any).enemy && Math.hypot(a.st.x - p.x, a.st.y - p.y) < 1800 && nearLoc(g, a.st.x, a.st.y, ['town', 'city'], 1400));
  if (pool.length < 4) return false;
  const lead = pool[0]; const dir = Math.random() * TAU;
  lead.life = { k: 'parade', dir, lt: 0, n: 0 }; lead.wait = 40; lead.act = 'walk';
  let prev = lead;
  pool.slice(1, 6).forEach((a, i) => { a.life = { k: 'parade', dir, with: prev, n: i + 1 }; a.wait = 40; a.act = 'walk'; (a as any).path = undefined; prev = a; });
  g.toast('街上锣鼓喧天——谁家在迎亲。', 'info');
  return true;
}

// ---------------------------------------------------------------- 绘制：道具与心声
export function drawAliveUnder(ctx: G, a: AliveActor, t: number) {
  const L = a.life; if (!L) return; const st = a.st, k = L.k as AliveK;
  if (k === 'chess' || k === 'tea') {
    const b = L.with; if (!b || (a.d.id > b.d.id)) return;   // 两人只画一张桌
    const cx = (st.x + b.st.x) / 2, cy = (st.y + b.st.y) / 2;
    ctx.save(); ctx.fillStyle = 'rgba(30,24,16,0.2)'; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 34, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(cx - 3, cy - 22, 6, 26);
    ctx.fillStyle = '#9a7246'; ctx.beginPath(); ctx.ellipse(cx, cy - 24, 30, 12, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.2; ctx.stroke();
    if (k === 'chess') {
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(cx - 16, cy - 31, 32, 14); ctx.strokeStyle = 'rgba(60,40,20,0.6)'; ctx.lineWidth = 0.6;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - 16 + i * 5.3, cy - 31); ctx.lineTo(cx - 16 + i * 5.3, cy - 17); ctx.stroke(); } for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 16, cy - 31 + i * 4.7); ctx.lineTo(cx + 16, cy - 31 + i * 4.7); ctx.stroke(); }
      const n = Math.min(14, Math.floor((L.ph ?? 0) / 2.5)); for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#1a1a1a' : '#f4f0e8'; ctx.beginPath(); ctx.arc(cx - 14 + ((i * 7) % 29), cy - 29 + ((i * 3) % 11), 1.8, 0, TAU); ctx.fill(); }
    } else {
      ctx.fillStyle = '#5a6a5a'; ctx.beginPath(); ctx.ellipse(cx, cy - 28, 6, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a4a3a'; ctx.fillRect(cx - 1.5, cy - 36, 3, 8);
      for (const o of [-14, 12]) { ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.ellipse(cx + o, cy - 24, 4, 2.4, 0, 0, TAU); ctx.fill(); }
      // 热气
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(t * 3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 36); ctx.quadraticCurveTo(cx + 4, cy - 44, cx - 2, cy - 52); ctx.stroke();
    }
    ctx.restore();
  }
  if (k === 'paint') {
    const c = Math.cos(L.dir), x = st.x + c * 34, y = st.y + 6;
    ctx.save(); ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x, y - 60); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 60); ctx.lineTo(x + 2, y - 4); ctx.stroke();
    ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x - 16, y - 58, 32, 36); ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 0.8; ctx.strokeRect(x - 16, y - 58, 32, 36);
    const k2 = Math.min(1, (L.ph ?? 0) / 25); ctx.strokeStyle = 'rgba(40,40,50,0.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 14, y - 30); ctx.quadraticCurveTo(x - 6, y - 50 * k2 - 2, x + 2, y - 34); ctx.quadraticCurveTo(x + 8, y - 44 * k2, x + 14, y - 32); ctx.stroke();
    if (k2 > 0.5) { ctx.strokeStyle = 'rgba(60,80,120,0.5)'; ctx.beginPath(); ctx.moveTo(x - 13, y - 26); ctx.lineTo(x + 13, y - 26); ctx.stroke(); }
    ctx.restore();
  }
}
export function drawAliveOver(ctx: G, a: AliveActor, t: number) {
  const L = a.life; if (!L) return; const st = a.st, k = L.k as AliveK, yaw = st.yaw ?? 0, fx = Math.sin(yaw), fy = Math.cos(yaw);
  ctx.save(); ctx.lineCap = 'round';
  if (k === 'sword' || k === 'spar' || (k === 'stretch' && (L.ph ?? 0) % 2 < 1)) {
    // 剑光：挥剑时的弧光
    const ph = k === 'spar' ? (L.ph ?? 0) % 1.6 / 0.7 : (L.ph ?? 0) % 2.4 / 1.1;
    if (ph < 1) {
      const col = a.d.faction === 'demon' ? '255,110,130' : a.d.sect ? '170,225,255' : '220,235,245';
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${col},${0.85 * (1 - ph)})`; ctx.lineWidth = 3;
      const a0 = -1.6 + ph * 2.8 + (fx > 0 ? 0 : Math.PI); ctx.beginPath(); ctx.arc(st.x + fx * 14, st.y - 70 - st.lift, 44, a0 - 1.1, a0, fx < 0); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(st.x + fx * 14, st.y - 70 - st.lift, 40, a0 - 0.9, a0, fx < 0); ctx.stroke();
    }
  } else if (k === 'sweep') {
    const sw = Math.sin(t * 5) * 0.5; ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(st.x + fx * 8, st.y - 70); ctx.lineTo(st.x + fx * 30 + sw * 14, st.y - 4); ctx.stroke();
    ctx.strokeStyle = '#b89a5a'; ctx.lineWidth = 1.2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(st.x + fx * 30 + sw * 14, st.y - 10); ctx.lineTo(st.x + fx * 30 + sw * 14 + i * 3, st.y + 2); ctx.stroke(); }
    if (Math.random() < 0.2) { ctx.fillStyle = 'rgba(190,170,130,0.5)'; ctx.beginPath(); ctx.arc(st.x + fx * 34 + sw * 18 + (Math.random() - 0.5) * 10, st.y + 2, 1.5, 0, TAU); ctx.fill(); }
  } else if (k === 'carry') {
    const bob = Math.sin(t * 7) * 3;
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(st.x - 46, st.y - 96 + bob); ctx.quadraticCurveTo(st.x, st.y - 104 + bob, st.x + 46, st.y - 96 + bob); ctx.stroke();
    for (const o of [-44, 44]) { ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(st.x + o, st.y - 96 + bob); ctx.lineTo(st.x + o, st.y - 60 - bob); ctx.stroke(); ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(st.x + o - 9, st.y - 60 - bob); ctx.lineTo(st.x + o + 9, st.y - 60 - bob); ctx.lineTo(st.x + o + 7, st.y - 40 - bob); ctx.lineTo(st.x + o - 7, st.y - 40 - bob); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(150,200,230,0.8)'; ctx.beginPath(); ctx.ellipse(st.x + o, st.y - 60 - bob, 8, 2.5, 0, 0, TAU); ctx.fill(); }
  } else if (k === 'chop') {
    const ph = (L.ph ?? 0) % 1.4, up = ph < 0.5 ? ph / 0.5 : Math.max(0, 1 - (ph - 0.5) / 0.15);
    ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.ellipse(st.x + fx * 40, st.y + 2, 14, 7, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#9a7a4a'; ctx.fillRect(st.x + fx * 40 - 5, st.y - 22, 10, 24);
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(st.x + fx * 12, st.y - 60); ctx.lineTo(st.x + fx * 34, st.y - 60 - up * 40); ctx.stroke(); ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.moveTo(st.x + fx * 34, st.y - 66 - up * 40); ctx.lineTo(st.x + fx * 46, st.y - 60 - up * 40); ctx.lineTo(st.x + fx * 34, st.y - 52 - up * 40); ctx.closePath(); ctx.fill();
  } else if (k === 'flute') {
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(st.x - 4 + fx * 6, st.y - 102); ctx.lineTo(st.x + 26 * (fx >= 0 ? 1 : -1), st.y - 96); ctx.stroke();
    for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3) % 1; ctx.fillStyle = `rgba(60,50,40,${0.7 * (1 - ph)})`; ctx.font = '12px serif'; ctx.fillText('♪', st.x + 30 * (fx >= 0 ? 1 : -1) + Math.sin(ph * 6 + i) * 8, st.y - 104 - ph * 50); }
  } else if (k === 'pray') {
    for (let i = 0; i < 2; i++) { const ph = (t * 0.35 + i * 0.5) % 1; ctx.strokeStyle = `rgba(230,230,230,${0.5 * (1 - ph)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(st.x + fx * 30, st.y - 20 - ph * 20); ctx.quadraticCurveTo(st.x + fx * 30 + 6, st.y - 40 - ph * 50, st.x + fx * 30 - 4, st.y - 60 - ph * 70); ctx.stroke(); }
    ctx.fillStyle = '#c8402a'; ctx.fillRect(st.x + fx * 30 - 1, st.y - 22, 2, 14); ctx.fillStyle = '#ff9a40'; ctx.beginPath(); ctx.arc(st.x + fx * 30, st.y - 23, 1.5, 0, TAU); ctx.fill();
  } else if (k === 'herb') {
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.ellipse(st.x + fx * 36, st.y + 4, 22, 10, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a08a5a'; ctx.lineWidth = 1; ctx.stroke();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#7a9a4a', '#a86a4a', '#c8a050'][i % 3]; ctx.beginPath(); ctx.ellipse(st.x + fx * 36 - 14 + (i % 5) * 7, st.y + (i < 5 ? 0 : 5), 3, 1.6, i, 0, TAU); ctx.fill(); }
  } else if (k === 'wash') {
    const c = Math.cos(L.dir), s = Math.sin(L.dir); ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(st.x + c * 30, st.y + s * 10 + 4, 13, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,170,200,0.7)'; ctx.beginPath(); ctx.ellipse(st.x + c * 30, st.y + s * 10 + 3, 10, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = pk(['#c8d0e0']); ctx.fillStyle = '#c8d0e0'; ctx.beginPath(); ctx.ellipse(st.x + c * 46, st.y + s * 10 + 6, 9, 3, 0.3, 0, TAU); ctx.fill();
    const rip = (t * 0.6) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - rip)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(st.x + c * 60, st.y + s * 30 + 6, 6 + rip * 20, (6 + rip * 20) * 0.35, 0, 0, TAU); ctx.stroke();
  } else if (k === 'tell') {
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(st.x - 22, st.y - 36, 44, 6); ctx.fillRect(st.x - 18, st.y - 30, 4, 30); ctx.fillRect(st.x + 14, st.y - 30, 4, 30);
    if ((L.ph ?? 0) % 3 < 0.25) { ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.font = 'bold 14px serif'; ctx.fillText('啪!', st.x + 20, st.y - 60); }
  } else if (k === 'parade') {
    const n = L.n ?? 0, bob = Math.sin(t * 6 + n) * 3;
    if (n === 0) { ctx.fillStyle = '#c8a040'; ctx.beginPath(); ctx.arc(st.x + fx * 26, st.y - 70 + bob, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = '#6a4a2a'; ctx.beginPath(); ctx.moveTo(st.x + fx * 10, st.y - 60); ctx.lineTo(st.x + fx * 26, st.y - 70 + bob); ctx.stroke(); }
    else { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(st.x + 10, st.y - 70); ctx.lineTo(st.x + 10, st.y - 150); ctx.stroke(); ctx.fillStyle = '#d8302a'; ctx.beginPath(); ctx.ellipse(st.x + 10, st.y - 150 + bob, 10, 12, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#f0c040'; ctx.fillRect(st.x + 8, st.y - 164 + bob, 4, 4); ctx.fillRect(st.x + 8, st.y - 140 + bob, 4, 6); if (n % 2 === 0) { ctx.fillStyle = 'rgba(220,40,40,0.9)'; ctx.fillRect(st.x - 30, st.y - 120 + bob, 60, 14); ctx.fillStyle = '#ffe9a0'; ctx.font = '11px "Noto Serif SC",serif'; ctx.textAlign = 'center'; ctx.fillText('囍', st.x, st.y - 109 + bob); } }
  } else if (k === 'shelter') {
    // 屋檐下：头顶一道小雨帘的留白
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { const ph = (t * 1.3 + i * 0.25) % 1; ctx.beginPath(); ctx.moveTo(st.x - 40 + i * 26, st.y - 130 + ph * 60); ctx.lineTo(st.x - 42 + i * 26, st.y - 120 + ph * 60); ctx.stroke(); }
  } else if (k === 'drunk') {
    ctx.fillStyle = '#8a5a3a'; ctx.beginPath(); ctx.ellipse(st.x + fx * 18, st.y - 62, 6, 9, 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#c8402a'; ctx.fillRect(st.x + fx * 18 - 2, st.y - 74, 4, 5);
  }
  ctx.restore();
}
/** 心声泡：云朵形、灰字、斜体感；real=true 为真心声（描金边——看穿人心是修为的奖赏） */
export function drawMindBubble(ctx: G, x: number, y: number, text: string, fs: number, alpha: number, real = false) {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.font = `${fs}px "Noto Serif SC","Songti SC",serif`; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + fs * 1.2, h = fs * 1.7;
  ctx.fillStyle = real ? 'rgba(250,244,226,0.94)' : 'rgba(236,238,236,0.9)';
  ctx.strokeStyle = real ? 'rgba(196,150,64,0.95)' : 'rgba(90,100,96,0.55)';
  ctx.lineWidth = real ? 1.8 : 1;
  ctx.beginPath();
  const n = Math.max(6, Math.round(w / (fs * 0.9)));
  for (let i = 0; i <= n; i++) { const px = x - w / 2 + (i / n) * w; ctx.arc(px, y - h * 0.5, h * 0.42, Math.PI, 0); }
  for (let i = n; i >= 0; i--) { const px = x - w / 2 + (i / n) * w; ctx.arc(px, y - h * 0.5 + h * 0.3, h * 0.42, 0, Math.PI); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - fs * (0.2 + i * 0.35), y + h * 0.45 + i * fs * 0.42, fs * (0.28 - i * 0.07), 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#4a5050'; ctx.fillText(text, x, y - h * 0.5 + fs * 0.3);
  ctx.restore();
}
