// 明末大事记：按历法触发的历史事件（会依据当前局势改写），以及随机事件
import type { Party, Settlement } from './state';
import {
  S, log, emit, dayOf, dayFor, player, spawnBandit, setWar, atWar, genTroops, spawnLordParty, lordName, playerSide, changePlayerRel, settlementList,
} from './game';
import { FACTION, type FactionId } from '../data/world';
import { addTroops, healthy, count, removeTroops } from './party';
import { setOwner, checkFactionAlive } from './combat';
import { nearestPassable } from './terrain';
import { regionAt, breachWall, SEGS, wallPointAtLon, lightBeacon } from './wall';
import { chance, pick, randInt } from './rng';

export interface Chronicle { title: string; text: string; x?: number; y?: number; big?: boolean }
const show = (c: Chronicle) => emit('chronicle', c);

// ---------- 势力更名等持久标记 ----------
const BASE_NAMES: Record<string, { name: string; ruler: string; rulerTitle: string; capital: string }> = {};
export function applyFlags() {
  const f = S.flags ?? {};
  for (const id of ['ming', 'jin', 'chuang', 'xi']) {
    const F = FACTION[id as FactionId] as any;
    if (!F) continue;
    BASE_NAMES[id] ||= { name: F.name, ruler: F.ruler, rulerTitle: F.rulerTitle, capital: F.capital };
    Object.assign(F, BASE_NAMES[id]);
  }
  if (f.qing) Object.assign(FACTION.jin as any, { name: '大清', rulerTitle: '大清皇帝' });
  if (f.qingRegent) Object.assign(FACTION.jin as any, { ruler: '多尔衮', rulerTitle: '摄政王' });
  if (f.dashun) Object.assign(FACTION.chuang as any, { name: '大顺', ruler: '李自成', rulerTitle: '大顺皇帝' });
  if (f.daxi) Object.assign(FACTION.xi as any, { name: '大西', ruler: '张献忠', rulerTitle: '大西皇帝' });
  if (f.mingFell) Object.assign(FACTION.ming as any, { name: '南明', ruler: '朱由崧', rulerTitle: '弘光帝', capital: 'nanjing' });
}
const flag = (k: string, v: number | boolean | string = true) => { (S.flags ||= {})[k] = v; applyFlags(); };

// ---------- 工具 ----------
const st = (id: string): Settlement | undefined => S.settlements[id];
const owns = (f: string, id: string) => st(id)?.faction === f;
const alive = (f: string) => !!S.alive[f];
const lordParty = (lid: string) => { const l = S.lords[lid]; return l?.partyId != null ? S.parties.find(p => p.id === l.partyId) : undefined; };
function placeNear(x: number, y: number, region: number, r = 40): [number, number] {
  for (let k = 0; k < 30; k++) {
    const [px, py] = nearestPassable(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r * 2);
    if (!region || regionAt(px, py) === region) return [px, py];
  }
  return nearestPassable(x, y);
}
/** 召集某势力若干领主于 (x,y)，组成以第一人为帅的军团 */
function muster(f: string, n: number, x: number, y: number, add: number, region = 0, prefer: string[] = []): Party[] {
  const lords = Object.values(S.lords).filter(l => l.faction === f && !l.dead)
    .sort((a, b) => (prefer.includes(b.id) ? 1 : 0) - (prefer.includes(a.id) ? 1 : 0) || (Math.random() - 0.5)).slice(0, n);
  const out: Party[] = [];
  for (const l of lords) {
    let p = lordParty(l.id);
    if (!p) { l.respawnAt = 0; spawnLordParty(l); p = lordParty(l.id); }
    if (!p) continue;
    [p.x, p.y] = placeNear(x, y, region);
    p.inside = undefined; p.reg = regionAt(p.x, p.y);
    for (const t of genTroops(FACTION[f as FactionId].culture, add, 0.6)) addTroops(p.troops, t.id, t.n);
    p.ai.path = []; p.ai.nextThink = S.time;
    out.push(p);
  }
  const lead = out[0];
  for (const p of out.slice(1)) { p.ai.mode = 'follow'; p.ai.target = lead.id; p.ai.until = S.time + 24 * 10; }
  return out;
}
function orderSiege(lead: Party | undefined, target: Settlement | undefined) {
  if (!lead || !target) return;
  lead.ai.mode = 'siege'; lead.ai.target = target.id; lead.ai.path = []; lead.ai.nextThink = S.time; lead.ai.until = undefined;
}
function orderRaid(lead: Party | undefined, nearX: number, nearY: number) {
  if (!lead) return;
  const vs = settlementList().filter(v => v.kind === 'village' && v.faction !== lead.faction && regionAt(v.x, v.y) === 1).sort((a, b) => Math.hypot(a.x - nearX, a.y - nearY) - Math.hypot(b.x - nearX, b.y - nearY));
  if (!vs.length) return;
  lead.ai.mode = 'raid'; lead.ai.target = vs[0].id; lead.ai.until = undefined; lead.ai.path = []; lead.ai.nextThink = S.time;
}
function defect(lid: string, to: string) {
  const l = S.lords[lid]; if (!l || l.dead || l.faction === to) return false;
  const from = l.faction;
  l.faction = to as FactionId;
  const p = lordParty(lid); if (p) { p.faction = to as FactionId; p.ai.mode = 'idle'; p.ai.target = undefined; }
  const keepers = Object.values(S.lords).filter(o => o.faction === from && !o.dead && o.id !== lid);
  for (const s of settlementList()) if (s.owner === lid) {
    const frontier = regionAt(s.x, s.y) === 2 || (s.isPass && Math.hypot(s.x - (S.settlements.shanhai?.x ?? 0), s.y - (S.settlements.shanhai?.y ?? 0)) < 260);
    if (frontier) setOwner(s, to, lid);
    else { const k = keepers.sort((a, b) => settlementList().filter(x => x.owner === a.id).length - settlementList().filter(x => x.owner === b.id).length)[0]; s.owner = k ? k.id : null; }
  }
  checkFactionAlive(from);
  return true;
}
function breachNear(lon: number) {
  const [x, y] = wallPointAtLon(lon);
  let best = -1, bd = Infinity;
  SEGS.forEach((sg, k) => { if (sg.gate >= 0) return; const d = Math.hypot(sg.x - x, sg.y - y); if (d < bd) { bd = d; best = k; } });
  if (best >= 0) breachWall(best);
  return best >= 0 ? SEGS[best] : null;
}
function qingRaid(lon: number, where: string, year: string) {
  if (!alive('jin') || !atWar('jin', 'ming')) return false;
  const sg = breachNear(lon); if (!sg) return false;
  const [ox, oy] = [sg.x - sg.nx * 60, sg.y - sg.ny * 60];
  const outside = regionAt(ox, oy) === 2 ? [ox, oy] : [sg.x + sg.nx * 60, sg.y + sg.ny * 60];
  const army = muster('jin', 3, outside[0], outside[1], 70, 2, ['jin_lord0', 'jin_lord1', 'jin_lord2']);
  if (!army.length) return false;
  orderRaid(army[0], sg.x, sg.y);
  for (const p of army.slice(1)) p.ai.until = S.time + 24 * 3;
  lightBeacon(sg.x, sg.y, 72);
  flag('raidUntil', S.time + 24 * 14); if (S.flags) delete S.flags.raidHomeMsg;
  flag('raiders', army.map(p => p.lordId).join(','));
  show({ title: `${year} · 清军入塞`, text: `${FACTION.jin.name}${lordName(army[0].lordId!)}率八旗劲旅${army.length}路，避开山海关坚城，自${where}一带拆毁边墙，破口入塞！烽火自长城一路传至京师，畿辅震动。\n\n八旗所过之处，掳掠人口牲畜无数。各镇勤王兵马须速速截击。`, x: sg.x, y: sg.y, big: true });
  return true;
}

// ---------- 历史事件表 ----------
interface Ev { id: string; y: number; m: number; x?: number; window?: number; cond?: () => boolean; run: () => boolean | void }
const EVENTS: Ev[] = [
  { id: 'fengyang', y: 1635, m: 1, x: 1, cond: () => alive('chuang') || alive('xi'), run: () => {
    const f = alive('chuang') ? 'chuang' : 'xi';
    const xz = st('xuzhou');
    if (xz) { const a = muster(f, 2, xz.x - 60, xz.y + 40, 30, 1); orderRaid(a[0], xz.x, xz.y); }
    show({ title: '崇祯八年正月 · 凤阳之变', text: '荥阳大会之后，十三家七十二营流寇分兵东进，一把火烧了凤阳皇陵，享殿松柏尽成焦土。\n\n消息传到京师，崇祯帝素服避殿，哭告太庙。中原各路义军声势大振。', x: xz?.x, y: xz?.y, big: true });
  } },
  { id: 'qing', y: 1636, m: 4, cond: () => alive('jin'), run: () => {
    flag('qing');
    show({ title: '崇祯九年四月 · 大清建号', text: '盛京城中，皇太极受满、蒙、汉诸臣劝进，即皇帝位，改国号为“大清”，改元崇德。\n\n后金自此称大清，与大明分庭抗礼。', x: st('shengjing')?.x, y: st('shengjing')?.y, big: true });
  } },
  { id: 'raid1636', y: 1636, m: 7, window: 6, run: () => qingRaid(116.0, '独石口、居庸关', '崇祯九年七月') },
  { id: 'gaoyingxiang', y: 1636, m: 7, x: 2, cond: () => alive('chuang'), run: () => {
    for (const p of S.parties) if (p.faction === 'chuang' && p.kind === 'lord') for (const s of [...p.troops]) removeTroops(p.troops, s.id, Math.floor(s.n * 0.3));
    show({ title: '崇祯九年七月 · 闯王被擒', text: '盩厔黑水峪，孙传庭设伏大破义军，闯王高迎祥被擒，解京凌迟。\n\n部众推举李自成继为“闯王”。闯军元气大伤，暂时退入山中。' });
  } },
  { id: 'raid1638', y: 1638, m: 9, window: 6, run: () => qingRaid(117.6, '墙子岭、青山口', '崇祯十一年九月') },
  { id: 'gucheng', y: 1638, m: 1, cond: () => alive('xi') && atWar('xi', 'ming'), run: () => {
    setWar('xi', 'ming', false); S.truceUntil['ming|xi'] = S.time + 24 * 16;
    show({ title: '崇祯十一年正月 · 谷城受抚', text: '张献忠兵败南阳，于谷城诈降，受熊文灿招抚。西营屯兵谷城，表面归顺，暗中积草屯粮。' });
  } },
  { id: 'xifan', y: 1639, m: 5, cond: () => alive('xi') && !atWar('xi', 'ming'), run: () => {
    setWar('xi', 'ming', true);
    const g = st('xiangyang') ?? st('wuchang');
    if (g) { const a = muster('xi', 3, g.x - 50, g.y - 30, 40, 1); orderSiege(a[0], g.faction !== 'xi' ? g : undefined); }
    show({ title: '崇祯十二年五月 · 谷城复叛', text: '张献忠杀谷城知县，焚其城垣，复举义旗。罗汝才等九营响应，楚地大乱。', x: g?.x, y: g?.y });
  } },
  { id: 'chuangwang', y: 1640, m: 11, run: () => {
    // 李自成东山再起：若闯军已灭，则自商洛山中复起
    let base = st('shangluo') ?? st('nanyang');
    if (!alive('chuang') && base) {
      S.alive.chuang = true;
      for (const l of Object.values(S.lords)) if (l.faction === 'chuang') { l.dead = false; l.respawnAt = 0; }
      if (base.faction !== 'player' && base.owner !== 'player') { setOwner(base, 'chuang', null); base.garrison = genTroops('chuang', 60, 0.5); }
      for (const f of ['ming', 'mon']) if (S.alive[f]) setWar('chuang', f, true);
    }
    if (!alive('chuang')) return false;
    base = settlementList().find(s => s.faction === 'chuang' && s.kind !== 'village') ?? base;
    if (base) { const a = muster('chuang', 4, base.x, base.y, 90, 1, ['chuang_lord0']); const lyt = st('luoyang'); if (lyt && lyt.faction !== 'chuang') orderSiege(a[0], lyt); }
    flag('chuangRise');
    show({ title: '崇祯十三年冬 · 迎闯王，不纳粮', text: '李自成率十八骑出商洛山，入河南。时值中原大旱，赤地千里，饥民从之如流。\n\n李岩编歌谣传唱四方：“迎闯王，不纳粮！”旬日之间，闯军复聚至数十万。', x: base?.x, y: base?.y, big: true });
  } },
  { id: 'luoyang', y: 1641, m: 1, x: 2, cond: () => alive('chuang') && owns('ming', 'luoyang'), run: () => {
    const l = st('luoyang')!;
    const near = S.parties.some(p => p.faction === 'chuang' && p.kind === 'lord' && Math.hypot(p.x - l.x, p.y - l.y) < 400);
    if (!near && count(l.garrison) > 70) return false;
    setOwner(l, 'chuang', null); l.garrison = genTroops('chuang', 70, 0.5); l.prosperity = Math.max(10, l.prosperity - 30);
    checkFactionAlive('ming');
    show({ title: '崇祯十四年正月 · 洛阳陷落', text: '闯军攻破洛阳，福王朱常洵被杀。李自成开福王府仓廪赈济饥民，四方震动。', x: l.x, y: l.y, big: true });
  } },
  { id: 'songjin1', y: 1641, m: 4, cond: () => alive('jin') && owns('ming', 'jinzhou') && atWar('jin', 'ming'), run: () => {
    const j = st('jinzhou')!;
    const a = muster('jin', 4, j.x + 60, j.y - 40, 80, 2, ['jin_lord0', 'jin_lord1']);
    orderSiege(a[0], j);
    show({ title: '崇祯十四年三月 · 松锦大战', text: `${FACTION.jin.name}大军合围锦州，祖大寿困守孤城。崇祯帝命洪承畴率八总兵、十三万大军出山海关驰援。\n\n大明与${FACTION.jin.name}的国运之战，就此拉开序幕。`, x: j.x, y: j.y, big: true });
  } },
  { id: 'songjin2', y: 1642, m: 2, cond: () => alive('jin'), run: () => {
    const lost = !owns('ming', 'jinzhou');
    if (lost) {
      const a = defect('ming_lord2', 'jin'); const b = defect('ming_lord6', 'jin');
      show({ title: '崇祯十五年二月 · 洪承畴降清', text: `松山城破，${a ? '洪承畴被俘，绝食数日后终降' : '洪承畴力战殉国'}；${b ? '祖大寿以锦州降' : '祖大寿下落不明'}。\n\n关外大明城池尽失，山海关成为京师最后的屏障。`, big: true });
    } else {
      show({ title: '崇祯十五年二月 · 锦州解围', text: '锦州城下，明军坚守不退，八旗久攻无功。此番松锦之战，大明竟挡住了清兵——史书由此改写。', big: true });
      changePlayerRel('ming', playerSide() === 'ming' ? 3 : 0);
    }
  } },
  { id: 'raid1642', y: 1642, m: 10, window: 6, run: () => qingRaid(118.0, '界岭口、黄崖口', '崇祯十五年十月') },
  { id: 'huangtaiji', y: 1643, m: 8, cond: () => alive('jin'), run: () => {
    flag('qingRegent');
    if (atWar('jin', 'ming')) { setWar('jin', 'ming', false); S.truceUntil['jin|ming'] = S.time + 24 * 6; }
    show({ title: '崇祯十六年八月 · 皇太极猝死', text: '皇太极于盛京清宁宫无疾而终。诸王争立，最终议定由六岁的福临继位，睿亲王多尔衮与郑亲王济尔哈朗辅政。\n\n大清暂息兵戈，与明边境稍安。' });
  } },
  { id: 'dashun', y: 1644, m: 1, cond: () => alive('chuang'), run: () => {
    flag('dashun');
    show({ title: '崇祯十七年正月 · 大顺建国', text: '李自成于西安称王，国号“大顺”，改元永昌。随即亲率大军东征，渡河入晋，直指北京。', big: true });
  } },
  { id: 'jinjing', y: 1644, m: 3, cond: () => alive('chuang') && owns('ming', 'beijing'), run: () => {
    const b = st('beijing')!;
    const a = muster('chuang', 5, b.x - 40, b.y + 70, 110, 1, ['chuang_lord0']);
    if (!a.length) return false;
    orderSiege(a[0], b);
    flag('jinjingAt', S.time);
    show({ title: '崇祯十七年三月 · 兵临北京', text: `${FACTION.chuang.name}大军${a.length}路兵临北京城下，彰义门外营帐连绵。京营兵饷久欠，守城者多老弱。\n\n若有忠勇之士入城助守，或可挽狂澜于既倒……`, x: b.x, y: b.y, big: true });
  } },
  { id: 'shanhai', y: 1644, m: 4, x: 1, window: 9, cond: () => alive('jin'), run: () => {
    const fell = !owns('ming', 'beijing') && S.settlements.beijing?.faction !== 'player';
    const sh = st('shanhai');
    if (!sh) return true;
    if (fell && sh.faction === 'ming') {
      flag('mingFell');
      const wu = S.lords['ming_lord7'];
      const switched = wu && !wu.dead ? defect('ming_lord7', 'jin') : false;
      if (!switched || sh.faction === 'ming') setOwner(sh, 'jin', switched ? 'ming_lord7' : null);
      if (!atWar('jin', 'chuang') && alive('chuang')) setWar('jin', 'chuang', true);
      setWar('jin', 'ming', true);
      const a = muster('jin', 5, sh.x - 50, sh.y + 20, 120, 1, ['jin_lord0']);
      const bj = st('beijing'); if (bj && bj.faction !== 'jin') orderSiege(a[0], bj);
      show({ title: '崇祯十七年四月 · 山海关之战', text: '京师已陷，崇祯帝自缢于煤山。山海关总兵吴三桂闻变，“冲冠一怒为红颜”，开关迎清兵入关。\n\n一片石一战，大顺军大败。多尔衮率八旗铁骑长驱入关，直取北京。天下大势，至此一变。\n\n明室遗臣于南京拥立福王，是为南明。', x: sh.x, y: sh.y, big: true });
    } else if (!fell) {
      show({ title: '崇祯十七年四月 · 京师无恙', text: '北京城头依旧飘扬着大明的旗帜。吴三桂仍据守山海关，八旗无隙可乘。\n\n这一年，历史走向了另一条岔路。', big: true });
    } else if (fell && sh.faction === 'jin' && !owns('jin', 'beijing')) {
      flag('mingFell');
      if (alive('chuang') && !atWar('jin', 'chuang')) setWar('jin', 'chuang', true);
      const a = muster('jin', 5, sh.x - 50, sh.y + 20, 120, 1, ['jin_lord0']);
      const bj = st('beijing'); if (bj) orderSiege(a[0], bj);
      show({ title: '崇祯十七年四月 · 清军入关', text: `京师已陷，崇祯帝自缢于煤山。山海关早已在${FACTION.jin.name}手中，摄政王多尔衮闻讯，即刻尽起八旗，自山海关长驱入关，以“为明复仇”为名直扑北京。\n\n明室遗臣于南京拥立福王，是为南明。`, x: sh.x, y: sh.y, big: true });
    }
  } },
  { id: 'daxi', y: 1644, m: 8, run: () => {
    const cd = st('chengdu');
    if (!cd) return true;
    if (!alive('xi')) {
      S.alive.xi = true;
      for (const l of Object.values(S.lords)) if (l.faction === 'xi') { l.dead = false; l.respawnAt = 0; }
      for (const f of ['ming', 'jin']) if (S.alive[f]) setWar('xi', f, true);
    }
    const base = settlementList().find(x => x.faction === 'xi' && x.kind !== 'village') ?? st('kuizhou');
    if (cd.faction !== 'xi' && cd.faction !== 'player' && cd.owner !== 'player') { setOwner(cd, 'xi', null); cd.garrison = genTroops('xi', 90, 0.5); }
    if (base && base.faction !== 'xi' && base.owner !== 'player' && base.faction !== 'player') { setOwner(base, 'xi', null); base.garrison = genTroops('xi', 50, 0.5); }
    const a = muster('xi', 4, cd.x, cd.y + 30, 80, 1);
    const cq = st('chongqing'); if (cq && cq.faction !== 'xi') orderSiege(a[0], cq);
    flag('daxi');
    show({ title: '崇祯十七年八月 · 张献忠入川', text: '张献忠率西营数十万众溯江入川，破重庆，陷成都。旋即于成都称帝，国号“大西”，改元大顺。\n\n巴蜀天府，自此兵连祸结。', x: cd.x, y: cd.y, big: true });
  } },
];

/** 旧存档迁移：已经过去的事件不再触发 */
export function calendarInit() {
  S.calendarDone ||= [];
  S.flags ||= {};
  if (!S.flags.calInit) {
    const d = dayOf(S.time);
    for (const e of EVENTS) if (dayFor(e.y, e.m, e.x ?? 0) + (e.window ?? 3) < d) S.calendarDone.push(e.id);
    S.flags.calInit = true;
  }
  applyFlags();
}

/** 入塞八旗：劫掠十四日后携掳获出塞 */
function manageRaid() {
  const f = S.flags; if (!f?.raiders) return;
  const ids = String(f.raiders).split(',');
  const home = settlementList().filter(s => s.faction === 'jin' && s.kind !== 'village' && regionAt(s.x, s.y) === 2);
  let active = 0;
  for (const lid of ids) {
    const p = lordParty(lid); if (!p || p.faction !== 'jin') continue;
    if (regionAt(p.x, p.y) !== 1 && !p.inside) continue;
    if (p.inside && S.settlements[p.inside] && regionAt(S.settlements[p.inside].x, S.settlements[p.inside].y) !== 1) continue;
    active++;
    const ai = p.ai;
    if (S.time < Number(f.raidUntil)) {
      if (ai.mode === 'siege' || ai.mode === 'idle' || ai.mode === 'patrol' || ai.mode === 'wander' || ai.mode === 'recruit') orderRaid(p, p.x, p.y);
    } else if (ai.mode !== 'travel' && ai.mode !== 'flee' && home.length) {
      const h = home.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      p.inside = undefined; ai.mode = 'travel'; ai.target = h.id; ai.path = []; ai.until = undefined; ai.nextThink = S.time;
    }
  }
  if (!active || S.time > Number(f.raidUntil) + 24 * 20) { delete f.raiders; delete f.raidUntil; }
  else if (S.time >= Number(f.raidUntil) && !f.raidHomeMsg) { f.raidHomeMsg = true; log(`${FACTION.jin.name}入塞大军满载掳获，开始北返出塞。`, 'war'); }
}

export function calendarDaily() {
  const d = dayOf(S.time);
  manageRaid();
  const done = S.calendarDone ||= [];
  for (const e of EVENTS) {
    if (done.includes(e.id)) continue;
    const at = dayFor(e.y, e.m, e.x ?? 0);
    if (d < at) continue;
    const late = d > at + (e.window ?? 3);
    if (late) { done.push(e.id); continue; }
    if (e.cond && !e.cond()) continue;
    const r = e.run();
    if (r !== false) { done.push(e.id); log(`【大事】${eventName(e.id)}`, 'gold'); }
  }
  // 甲申之后：北京为他人所有即视为明亡
  if (!S.flags?.mingFell && S.settlements.beijing && S.settlements.beijing.faction !== 'ming' && S.settlements.beijing.faction !== 'player' && d > dayFor(1640, 1)) {
    flag('mingFell');
    show({ title: '甲申之变', text: `北京易手，${FACTION[S.settlements.beijing.faction]?.name ?? '敌军'}入主紫禁城。明室南渡，于南京另立新君，是为南明。`, big: true });
  }
}
const NAMES: Record<string, string> = { fengyang: '凤阳之变', qing: '大清建号', raid1636: '清军入塞', gaoyingxiang: '闯王被擒', raid1638: '清军入塞', gucheng: '谷城受抚', xifan: '谷城复叛', chuangwang: '闯王复起', luoyang: '洛阳陷落', songjin1: '松锦大战', songjin2: '松锦之役终局', raid1642: '清军入塞', huangtaiji: '皇太极猝死', dashun: '大顺建国', jinjing: '兵临北京', shanhai: '山海关之战', daxi: '张献忠入川' };
function eventName(id: string) { return NAMES[id] ?? id; }

/** 大事记（已发生 + 坊间传闻） */
export function chronicleList() {
  const d = dayOf(S.time);
  const done = S.calendarDone ?? [];
  const past = EVENTS.filter(e => done.includes(e.id) && dayFor(e.y, e.m, e.x ?? 0) <= d).map(e => ({ when: `${e.y}年${e.m}月`, name: eventName(e.id) }));
  const next = EVENTS.filter(e => !done.includes(e.id) && dayFor(e.y, e.m, e.x ?? 0) > d).slice(0, 2).map(e => ({ when: `${e.y}年${e.m}月`, name: eventName(e.id) }));
  return { past, next };
}

// ---------- 随机事件（每三日一判） ----------
export function randomEvents() {
  const pp = player();
  const roll = Math.random();
  if (roll < 0.1) {
    // 旱蝗
    const v = pick(settlementList().filter(s => s.kind === 'village'));
    const area = settlementList().filter(s => s.kind === 'village' && Math.hypot(s.x - v.x, s.y - v.y) < 220);
    for (const s of area) { s.prosperity = Math.max(5, s.prosperity - 15); s.recruits = Math.max(0, s.recruits - 2); }
    log(`${v.name}一带${chance(0.5) ? '大旱' : '飞蝗蔽日'}，${area.length}个村庄颗粒无收，流民四起。`, 'bad');
    for (let i = 0; i < 2; i++) spawnBandit();
  } else if (roll < 0.16) {
    const t = pick(settlementList().filter(s => s.kind === 'town'));
    for (const s of t.garrison) removeTroops(t.garrison, s.id, Math.floor(s.n * 0.15));
    t.prosperity = Math.max(5, t.prosperity - 10);
    log(`${t.name}爆发大疫，“十室九空”，守军亦多病殁。`, 'bad');
  } else if (roll < 0.22) {
    const v = pick(settlementList().filter(s => s.kind === 'village'));
    v.prosperity = Math.min(100, v.prosperity + 15);
    log(`${v.name}今岁风调雨顺，五谷丰登。`, 'good');
  } else if (roll < 0.27 && S.renown >= 80 && healthy(pp.troops) > 0) {
    // 豪杰来投
    const ids = ['ming_soldier', 'ming_archer', 'ming_spear'];
    const n = randInt(3, 6 + Math.floor(S.renown / 150));
    const id = pick(ids);
    show({ title: '豪杰来投', text: `一队${n}名${chance(0.5) ? '乡勇' : '败兵'}慕你的威名而来，跪在营门外：“愿随将军杀贼！”`, });
    addTroops(pp.troops, id, n);
  } else if (roll < 0.3 && S.flags?.chuangRise && alive('chuang')) {
    for (const p of S.parties) if (p.faction === 'chuang' && p.kind === 'lord' && chance(0.5)) for (const t of genTroops('chuang', randInt(8, 18), 0.35)) addTroops(p.troops, t.id, t.n);
    log('饥民成群结队投奔闯营，闯军声势日盛。', 'war');
  }
}
