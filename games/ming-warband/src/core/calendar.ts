// 明末大事记：由各方动作与局势触发的历史事件，以及随机事件
import type { Party, Settlement } from './state';
import {
  S, log, emit, dayOf, dateStr, calYear, cnNum, player, spawnBandit, setWar, atWar, genTroops, spawnLordParty, lordName, playerSide, changePlayerRel, settlementList,
} from './game';
import { FACTION, TOWN_DEFS, MAJOR_FACTIONS, type FactionId } from '../data/world';
import { addTroops, healthy, count, removeTroops } from './party';
import { setOwner, checkFactionAlive } from './combat';
import { nearestPassable } from './terrain';
import { regionAt, SEGS, isBreached, nearestPassName } from './wall';
import { strategyDaily, strengthOf, summon, inTheater, THEATERS, mingNorthStrength, type RaidPlan } from './strategy';
import { chance, pick, randInt } from './rng';

export interface Chronicle { title: string; text: string; x?: number; y?: number; big?: boolean; choices?: { label: string; run: () => void }[] }
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
    const frontier = regionAt(s.x, s.y) === 2 && !s.isPass; // 只有关外的封地随之而去，关隘与关内城池仍归朝廷
    if (frontier) setOwner(s, to, lid);
    else { const k = keepers.sort((a, b) => settlementList().filter(x => x.owner === a.id).length - settlementList().filter(x => x.owner === b.id).length)[0]; s.owner = k ? k.id : null; }
  }
  checkFactionAlive(from);
  return true;
}
// ---------- 大事（由各方动作与局势触发，而非按日历） ----------
interface Ev { id: string; name: string; when: () => boolean; run: () => boolean | void }
const zhongStr = () => strengthOf('ming', p => inTheater(THEATERS[3], p.x, p.y, 380));
const EVENTS: Ev[] = [
  { id: 'fengyang', name: '凤阳之变', when: () => alive('chuang') || alive('xi'), run: () => {
    const f = alive('chuang') ? 'chuang' : 'xi';
    const xz = st('xuzhou');
    if (xz) { const a = muster(f, 2, xz.x - 60, xz.y + 40, 30, 1); orderRaid(a[0], xz.x, xz.y); }
    show({ title: `凤阳之变`, text: '荥阳大会之后，十三家七十二营流寇分兵东进，一把火烧了凤阳皇陵，享殿松柏尽成焦土。\n\n消息传到京师，崇祯帝素服避殿，哭告太庙。中原各路义军声势大振。', x: xz?.x, y: xz?.y, big: true });
  } },
  { id: 'qing', name: '大清建号', when: () => alive('jin') && dayOf(S.time) >= 30 && (dayOf(S.time) >= 45 || settlementList().filter(s => s.faction === 'jin' && s.kind !== 'village').length >= 9), run: () => {
    flag('qing');
    show({ title: `大清建号`, text: '盛京城中，皇太极受满、蒙、汉诸臣劝进，即皇帝位，改国号为“大清”，改元崇德。\n\n后金自此称大清，与大明分庭抗礼。', x: st('shengjing')?.x, y: st('shengjing')?.y, big: true });
  } },
  { id: 'gaoyingxiang', name: '闯王被擒', when: () => alive('chuang') && dayOf(S.time) >= 30 && strengthOf('chuang') < zhongStr() * 0.6 && chance(0.12), run: () => {
    for (const p of S.parties) if (p.faction === 'chuang' && p.kind === 'lord') for (const s of [...p.troops]) removeTroops(p.troops, s.id, Math.floor(s.n * 0.3));
    show({ title: `闯王被擒`, text: '官军设伏大破义军，闯王高迎祥被擒，解京凌迟。\n\n部众推举李自成继为“闯王”。闯军元气大伤，暂时退入山中。' });
  } },
  { id: 'gucheng', name: '谷城受抚', when: () => alive('xi') && atWar('xi', 'ming') && dayOf(S.time) >= 40 && settlementList().filter(s => s.faction === 'xi' && s.kind !== 'village').length <= 2, run: () => {
    setWar('xi', 'ming', false); S.truceUntil['ming|xi'] = S.time + 24 * 16; flag('guchengAt', S.time);
    show({ title: `谷城受抚`, text: '张献忠屡战不利，于谷城诈降，受朝廷招抚。西营屯兵谷城，表面归顺，暗中积草屯粮。' });
  } },
  { id: 'xifan', name: '谷城复叛', when: () => !!S.flags?.guchengAt && S.time > Number(S.flags.guchengAt) + 24 * 16 && alive('xi'), run: () => {
    setWar('xi', 'ming', true);
    const g = st('xiangyang') ?? st('wuchang');
    const lead = S.parties.filter(p => p.kind === 'lord' && p.faction === 'xi').sort((a, b) => count(b.troops) - count(a.troops))[0];
    if (lead && g && g.faction !== 'xi') { orderSiege(lead, g); summon(lead, 3); }
    show({ title: `谷城复叛`, text: '张献忠杀谷城知县，焚其城垣，复举义旗。罗汝才等九营响应，楚地大乱。', x: g?.x, y: g?.y });
  } },
  { id: 'chuangwang', name: '迎闯王', when: () => dayOf(S.time) >= 100 && (famine() > 0.5 || zhongStr() < 700) && chance(0.08), run: () => {
    let base = st('shangluo') ?? st('nanyang');
    if (!alive('chuang') && base) {
      S.alive.chuang = true;
      for (const l of Object.values(S.lords)) if (l.faction === 'chuang') { l.dead = false; l.respawnAt = 0; l.partyId = null; }
      if (base.faction !== 'player' && base.owner !== 'player') { setOwner(base, 'chuang', null); base.garrison = genTroops('chuang', 60, 0.5); }
      for (const f of ['ming', 'mon']) if (S.alive[f]) setWar('chuang', f, true);
      for (const l of Object.values(S.lords)) if (l.faction === 'chuang') spawnLordParty(l);
    }
    if (!alive('chuang')) return false;
    for (const p of S.parties) if (p.kind === 'lord' && p.faction === 'chuang') for (const t of genTroops('chuang', 70, 0.4)) addTroops(p.troops, t.id, t.n);
    base = settlementList().find(s => s.faction === 'chuang' && s.kind !== 'village') ?? base;
    flag('chuangRise');
    show({ title: `迎闯王，不纳粮`, text: `${zhongStr() < 700 ? '官军精锐尽被抽调北上，中原空虚。' : ''}中原连年大旱，赤地千里。李自成率十八骑出商洛山，饥民从之如流。\n\n李岩编歌谣传唱四方：“迎闯王，不纳粮！”旬日之间，闯军复聚至数十万。`, x: base?.x, y: base?.y, big: true });
  } },
  { id: 'luoyang', name: '洛阳陷落', when: () => owns('chuang', 'luoyang') && !!S.flags?.lyMing, run: () => {
    const l = st('luoyang')!; l.prosperity = Math.max(10, l.prosperity - 20);
    show({ title: `洛阳陷落`, text: '闯军攻破洛阳，福王朱常洵被杀。李自成开福王府仓廪赈济饥民，四方震动。', x: l.x, y: l.y, big: true });
  } },
  { id: 'songjin1', name: '松锦大战', when: () => alive('jin') && atWar('jin', 'ming') && owns('ming', 'jinzhou') && dayOf(S.time) >= 60 && !S.flags?.raidPlan && !S.flags?.raiders
      && strengthOf('jin', p => regionAt(p.x, p.y) === 2) > strengthOf('ming', p => inTheater(THEATERS[0], p.x, p.y)) * 1.1 && chance(0.1), run: () => {
    const j = st('jinzhou')!;
    const lead = S.parties.filter(p => p.kind === 'lord' && p.faction === 'jin' && regionAt(p.x, p.y) === 2).sort((a, b) => count(b.troops) - count(a.troops))[0];
    if (!lead) return false;
    orderSiege(lead, j); summon(lead, 4, 1500);
    flag('songjinAt', S.time);
    show({ title: `松锦大战`, text: `${FACTION.jin.name}${lordName(lead.lordId!)}尽起八旗，合围锦州，祖大寿困守孤城。兵部急调蓟辽各镇出关驰援。\n\n大明与${FACTION.jin.name}的国运之战，就此拉开序幕。`, x: j.x, y: j.y, big: true });
  } },
  { id: 'songjin2', name: '松锦终局', when: () => !!S.flags?.songjinAt && (owns('jin', 'jinzhou') || S.time - Number(S.flags.songjinAt) > 24 * 20), run: () => {
    if (owns('jin', 'jinzhou')) {
      const a = chance(0.7) && defect('ming_lord2', 'jin'); const b = defect('ming_lord6', 'jin');
      show({ title: `锦州陷落`, text: `锦州城破，${b ? '祖大寿开城投降' : '守军死战殆尽'}；${a ? '洪承畴兵败被俘，绝食数日后终降' : '洪承畴收拾残兵退守宁远'}。\n\n关外大明城池岌岌可危，山海关成为京师最后的屏障。`, big: true });
    } else {
      show({ title: `锦州解围`, text: '锦州城下，明军坚守不退，八旗久攻无功，只得退兵。此番松锦之战，大明挡住了清兵——史书由此改写。', big: true });
      if (playerSide() === 'ming') changePlayerRel('ming', 3);
    }
  } },
  { id: 'huangtaiji', name: '皇太极猝死', when: () => alive('jin') && dayOf(S.time) >= 250 && chance(1 / 30), run: () => {
    flag('qingRegent');
    if (atWar('jin', 'ming')) { setWar('jin', 'ming', false); S.truceUntil['jin|ming'] = S.time + 24 * 6; }
    show({ title: `皇太极猝死`, text: '皇太极于盛京清宁宫无疾而终。诸王争立，最终议定由六岁的福临继位，睿亲王多尔衮与郑亲王济尔哈朗辅政。\n\n大清暂息兵戈。' });
  } },
  { id: 'dashun', name: '大顺建国', when: () => alive('chuang') && dayOf(S.time) >= 180 && (owns('chuang', 'xian') || settlementList().filter(s => s.faction === 'chuang' && s.kind !== 'village').length >= 8), run: () => {
    flag('dashun');
    show({ title: `大顺建国`, text: '李自成称王，国号“大顺”，改元永昌。闯军将士欢声雷动，誓言东征，直指北京。', big: true });
  } },
  { id: 'jinjing', name: '兵临北京', when: () => !!S.flags?.jinjing && owns('ming', 'beijing') && (() => { const b = st('beijing')!; return !!b.siege || S.parties.some(p => p.faction === 'chuang' && p.kind === 'lord' && Math.hypot(p.x - b.x, p.y - b.y) < 260); })(), run: () => {
    const b = st('beijing')!;
    const n = S.parties.filter(p => p.faction === 'chuang' && p.kind === 'lord' && Math.hypot(p.x - b.x, p.y - b.y) < 400).length;
    show({ title: `兵临北京`, text: `${FACTION.chuang.name}大军${n}路兵临北京城下，彰义门外营帐连绵。京营兵饷久欠，守城者多老弱。\n\n若有忠勇之士入城助守，或可挽狂澜于既倒……`, x: b.x, y: b.y, big: true });
  } },
  { id: 'shanhai', name: '山海关之变', when: () => alive('jin') && !!st('beijing') && !['ming', 'player'].includes(st('beijing')!.faction), run: () => shanhaiEvent() },
  { id: 'daxi', name: '大西建国', when: () => alive('xi') && (owns('xi', 'chengdu') || owns('xi', 'chongqing')) && dayOf(S.time) >= 150, run: () => {
    flag('daxi');
    const cd = st('chengdu');
    show({ title: `大西建国`, text: '张献忠据有巴蜀，于成都称帝，国号“大西”，改元大顺。\n\n巴蜀天府，自此兵连祸结。', x: cd?.x, y: cd?.y, big: true });
  } },
];
/** 小冰期：崇祯十一年后旱蝗连年 */
export function famine() { const y = calYear(); return y >= 1638 && y <= 1643 ? 0.8 : y >= 1636 ? 0.4 : 0.2; }

/** 山海关之变：吴三桂何去何从（玩家可以干预） */
function shanhaiEvent() {
  flag('mingFell');
  const sh = st('shanhai');
  if (!sh) return true;
  const wu = S.lords['ming_lord7'];
  const marchIn = () => {
    if (alive('chuang') && !atWar('jin', 'chuang')) setWar('jin', 'chuang', true);
    const lead = S.parties.filter(p => p.kind === 'lord' && p.faction === 'jin').sort((a, b) => count(b.troops) - count(a.troops))[0];
    const bj = st('beijing'); if (lead && bj && bj.faction !== 'jin') { orderSiege(lead, bj); summon(lead, 5, 2000); }
    flag('ruguan');
  };
  if (sh.owner === 'player' || sh.faction === 'player') {
    show({ title: `京师陷落`, text: `京师已陷，崇祯帝自缢于煤山。天下的目光都落在了你镇守的山海关上——关外八旗虎视眈眈，关内${FACTION[st('beijing')!.faction]?.name ?? '敌军'}气焰正盛。\n\n明室遗臣于南京拥立福王，是为南明。`, x: sh.x, y: sh.y, big: true });
    return;
  }
  if (sh.faction === 'jin') {
    marchIn();
    show({ title: `清军入关`, text: `京师已陷，崇祯帝自缢于煤山。山海关早已在${FACTION.jin.name}手中，摄政王多尔衮闻讯，尽起八旗长驱入关，以“为明复仇”为名直扑北京。\n\n明室遗臣于南京拥立福王，是为南明。`, x: sh.x, y: sh.y, big: true });
    return;
  }
  if (sh.faction !== 'ming' || !wu || wu.dead || wu.faction !== 'ming') {
    show({ title: `甲申之变`, text: '京师已陷，崇祯帝自缢于煤山。明室遗臣于南京拥立福王，是为南明。', big: true });
    return;
  }
  const doDefect = () => {
    defect('ming_lord7', 'jin');
    if (sh.faction !== 'jin') setOwner(sh, 'jin', 'ming_lord7');
    setWar('jin', 'ming', true);
    marchIn();
    show({ title: `山海关之战`, text: '吴三桂“冲冠一怒为红颜”，开关迎清兵入关。一片石一战，闯军大败。多尔衮率八旗铁骑长驱入关，直取北京。\n\n天下大势，至此一变。', x: sh.x, y: sh.y, big: true });
  };
  const stay = () => show({ title: `吴三桂拒清`, text: '吴三桂读罢来信，掷书于地：“我吴家世受国恩，岂能开门揖盗！”山海关依旧紧闭，八旗无隙可乘。\n\n这一年，历史走向了另一条岔路。', x: sh.x, y: sh.y, big: true });
  if (playerSide() === 'ming' || (!playerSide() && (S.playerRel.ming ?? 0) >= 0)) {
    const odds = Math.min(0.9, 0.3 + S.renown / 1500 + Math.max(0, wu.relation) / 40);
    show({ title: `甲申之变`, text: `京师已陷，崇祯帝自缢于煤山。明室遗臣于南京拥立福王，是为南明。\n\n山海关总兵吴三桂手握关宁铁骑，进退两难：关外多尔衮许以王爵，关内闯军拘其父、夺其爱妾陈圆圆。有消息说，他已与清人暗通书信……\n\n你若此时修书一封，或许能左右他的抉择（成功率约 ${Math.round(odds * 100)}%）。`, x: sh.x, y: sh.y, big: true,
      choices: [
        { label: '✍ 修书劝说吴三桂', run: () => { if (chance(odds)) { stay(); wu.relation += 5; } else doDefect(); } },
        { label: '听天由命', run: () => { if (chance(0.25)) stay(); else doDefect(); } },
      ] });
    return;
  }
  if (chance(0.75)) doDefect(); else stay();
}

/** 入塞：清军破墙之后的跟进（由 strategy.ts 发起） */
function raidFollow() {
  const f = S.flags; if (!f?.raidPlan) return;
  let plan: RaidPlan; try { plan = JSON.parse(String(f.raidPlan)); } catch { delete f.raidPlan; return; }
  const lead = lordParty(plan.lead);
  if (!lead || lead.faction !== 'jin' || S.time - plan.at > 24 * 14) { delete f.raidPlan; f.lastRaid = S.time; return; }
  if (!isBreached(plan.seg) && regionAt(lead.x, lead.y) !== 1) return;
  const sg = SEGS[plan.seg];
  const army = [lead, ...S.parties.filter(p => p.ai.mode === 'follow' && p.ai.target === lead.id)];
  for (const p of army) p.ai.until = S.time + 24 * 4;
  orderRaid(lead, sg.x, sg.y);
  delete f.raidPlan; f.lastRaid = S.time;
  f.raidN = Number(f.raidN ?? 0) + 1;
  f.raidUntil = S.time + 24 * 14; delete f.raidHomeMsg;
  f.raiders = army.map(p => p.lordId).filter(Boolean).join(',');
  const where = nearestPassName(sg.x, sg.y);
  const n = Number(f.raidN);
  show({ title: `${n > 1 ? `清军第${cnNum(n)}次入塞` : '清军入塞'}`, text: `${FACTION.jin.name}${lordName(lead.lordId!)}率八旗劲旅${army.length}路，避开坚城，在${where}附近拆毁边墙，破口入塞！烽火自长城一路传至京师，畿辅震动。\n\n八旗所过之处，掳掠人口牲畜无数。各镇勤王兵马须速速截击。`, x: sg.x, y: sg.y, big: true });
  chronAdd(n > 1 ? `清军第${cnNum(n)}次入塞` : '清军入塞');
}

function chronAdd(name: string) { (S.chronLog ||= []).push({ n: name, at: S.time }); log(`【大事】${name}`, 'gold'); }

export function calendarInit() {
  S.calendarDone ||= [];
  S.flags ||= {};
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
  if (owns('ming', 'luoyang')) (S.flags ||= {}).lyMing = true;
  guardCal(manageRaid);
  guardCal(raidFollow);
  guardCal(strategyDaily);
  const done = S.calendarDone ||= [];
  for (const e of EVENTS) {
    if (done.includes(e.id)) continue;
    if (!e.when()) continue;
    const r = e.run();
    if (r !== false) { done.push(e.id); chronAdd(e.name); }
  }
  // 北京为他人所有即视为明亡
  if (!S.flags?.mingFell && S.settlements.beijing && S.settlements.beijing.faction !== 'ming' && S.settlements.beijing.faction !== 'player') {
    flag('mingFell');
    if (!alive('jin')) show({ title: `甲申之变`, text: `北京易手，${FACTION[S.settlements.beijing.faction]?.name ?? '敌军'}入主紫禁城。明室南渡，于南京另立新君，是为南明。`, big: true });
  }
}
function guardCal(fn: () => void) { try { fn(); } catch (e) { console.error('[calendar]', e); } }

/** 大事记（已发生 + 坊间传闻） */
export function chronicleList() {
  const past = (S.chronLog ?? []).map(e => ({ when: dateStr(e.at, false), name: e.n }));
  const next: { when: string; name: string }[] = [];
  const f = S.flags ?? {};
  if (f.raidPlan) next.push({ when: '近日', name: '关外八旗正在集结，恐将入塞' });
  if (f.jinjing && owns('ming', 'beijing')) next.push({ when: '近日', name: '闯军大举东进，直指京师' });
  if (famine() > 0.5) next.push({ when: '今岁', name: '中原大旱，饥民遍野' });
  if (alive('jin') && !f.raidPlan && atWar('jin', 'ming') && mingNorthStrength() < strengthOf('jin', p => regionAt(p.x, p.y) === 2) * 0.8) next.push({ when: '坊间', name: '九边空虚，恐为清人所乘' });
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

// ---------- 灭亡势力的余部复起（防止后期天下只剩寥寥数家） ----------
const REVIVE_TEXT: Record<string, [string, string]> = {
  ming: ['明室宗亲起兵', '大明宗室于{t}登高一呼，旧部云集，复举日月旗号。'],
  jin: ['八旗余部复起', '八旗残部于{t}重整旗鼓，誓要卷土重来。'],
  chuang: ['闯营余部复起', '闯营旧将收拾残兵，于{t}复竖“闯”字大旗，饥民从之。'],
  xi: ['西营余部复起', '西营旧部于{t}啸聚山林，重整旗鼓。'],
  mon: ['察哈尔部复起', '察哈尔诸台吉于{t}会盟，重振黄金家族的旗帜。'],
};
export function reviveFactions() {
  S.flags ||= {};
  for (const f of MAJOR_FACTIONS) {
    if (S.alive[f] || f === 'player') continue;
    const k = 'deadSince_' + f;
    if (S.flags[k] === undefined) { S.flags[k] = S.time; continue; }
    if (S.time - Number(S.flags[k]) < 24 * 40 || !chance(0.3)) continue;
    // 在其故地挑一座守备薄弱、不属于玩家的城堡
    const home = TOWN_DEFS.filter(d => d.faction === f && d.kind !== 'village').map(d => S.settlements[d.id]).filter(s => s && s.owner !== 'player' && s.faction !== 'player' && !s.siege);
    if (!home.length) continue;
    home.sort((a, b) => count(a.garrison) - count(b.garrison));
    const t = home[0];
    const old = t.faction;
    S.alive[f] = true;
    delete S.flags[k];
    for (const l of Object.values(S.lords)) if (l.faction === f) { l.dead = false; l.respawnAt = 0; l.partyId = null; }
    setOwner(t, f, null);
    t.garrison = genTroops(FACTION[f].culture, 120, 0.5);
    for (const l of Object.values(S.lords)) if (l.faction === f) { spawnLordParty(l); const pp = lordParty(l.id); if (pp) for (const tt of genTroops(FACTION[f].culture, 40, 0.5)) addTroops(pp.troops, tt.id, tt.n); }
    if (old && old !== f && S.alive[old]) setWar(f, old, true);
    const [title, text] = REVIVE_TEXT[f] ?? ['余部复起', '{t}有人起兵。'];
    show({ title: `${title}`, text: text.replace('{t}', t.name) + `\n\n${FACTION[f].name}重新回到了天下的棋局之中。`, x: t.x, y: t.y });
    checkFactionAlive(old);
    return; // 每次至多复起一家
  }
}
