// 任务系统
import type { Quest, Settlement } from './state';
import { S, log, player, spawnBandit, settlementList, changePlayerRel, partyById, removeParty } from './game';
import { FACTION, BANDIT_ZONES } from '../data/world';
import { TROOPS } from '../data/troops';
import { addTroops, removeTroops, count } from './party';
import { pick, randInt, dist } from './rng';
import { ll } from './terrain';

const offers = new Map<string, { q: Quest | null; until: number }>();

function addRel(q: Quest, d: number) {
  const st = S.settlements[q.giver];
  if (st) st.relation = Math.max(-100, Math.min(100, st.relation + d));
  changePlayerRel(q.giverFaction, Math.round(d / 2));
}

export function questOffer(st: Settlement): Quest | null {
  const o = offers.get(st.id);
  if (o && o.until > S.time) return o.q;
  let q: Quest | null = null;
  const id = S.nextId++;
  const deadline = S.time + 24 * randInt(8, 14);
  const r = Math.random();
  if (st.kind === 'village') {
    if (r < 0.75) {
      const amount = randInt(4, 10);
      q = { id, type: 'grain', title: `为${st.name}运送米粮`, desc: `今年收成不好，乡亲们断了粮。村长恳请你送来 ${amount} 袋米粮。`, giver: st.id, giverName: `${st.name}村长`, giverFaction: st.faction, target: st.id, targetName: st.name, amount, reward: amount * 32, deadline };
    }
  } else if (st.kind === 'town') {
    if (r < 0.4) {
      // 剿匪
      let zi = 0, bd = Infinity;
      BANDIT_ZONES.forEach((z, i) => { const [x, y] = ll(z.lon, z.lat); const d = dist(x, y, st.x, st.y); if (d < bd) { bd = d; zi = i; } });
      const reward = 250 + S.hero.level * 40 + randInt(0, 150);
      q = { id, type: 'bandit', title: `剿灭${BANDIT_ZONES[zi].name}`, desc: `一伙凶悍的${BANDIT_ZONES[zi].name}在附近劫掠，官府悬赏 ${reward} 两缉拿其首领。`, giver: st.id, giverName: `${st.name}衙门`, giverFaction: st.faction, target: zi, targetName: BANDIT_ZONES[zi].name, reward, deadline };
    } else if (r < 0.7) {
      const others = settlementList().filter(x => x.kind === 'town' && x.faction === st.faction && x.id !== st.id);
      if (others.length) {
        const t = pick(others);
        const reward = Math.round(60 + dist(st.x, st.y, t.x, t.y) * 0.25);
        q = { id, type: 'letter', title: `送信至${t.name}`, desc: `将一封加急公文送往${t.name}的衙门。酬劳 ${reward} 两。`, giver: st.id, giverName: `${st.name}衙门`, giverFaction: st.faction, target: t.id, targetName: t.name, reward, deadline };
      }
    } else {
      const amount = randInt(5, 12);
      const tier = 2;
      q = { id, type: 'troops', title: `为${st.name}补充守军`, desc: `城防空虚，守将希望你带来 ${amount} 名二等以上的士兵补入守军。每人酬劳 45 两。`, giver: st.id, giverName: `${st.name}守将`, giverFaction: st.faction, target: st.id, targetName: st.name, amount, troopTier: tier, reward: amount * 45, deadline };
    }
  }
  offers.set(st.id, { q, until: S.time + 24 * 3 });
  return q;
}

export function acceptQuest(q: Quest) {
  if (S.quests.length >= 5) return false;
  S.quests.push(q);
  offers.set(q.giver, { q: null, until: S.time + 24 * 3 });
  if (q.type === 'bandit') {
    const p = spawnBandit(q.target as number, true);
    if (p) { p.questId = q.id; p.name = `恶名昭彰的${p.name}`; q.target = p.id; q.desc += `（目标：${p.name}，在${BANDIT_ZONES[p.zone!].name}一带出没）`; }
  }
  log(`接受任务：${q.title}`, 'quest');
  return true;
}

export function finishQuest(q: Quest, success: boolean) {
  S.quests = S.quests.filter(x => x.id !== q.id);
  if (success) {
    player().gold += q.reward;
    S.renown += 5; S.honor += 1;
    addRel(q, 6);
    log(`任务完成：${q.title}，获得 ${q.reward} 两银子。`, 'quest');
  } else {
    addRel(q, -5);
    log(`任务失败：${q.title}`, 'bad');
  }
}

export function completeBanditQuest(qid: number) {
  const q = S.quests.find(x => x.id === qid);
  if (q) finishQuest(q, true);
}

/** 进入据点时检查送信任务 */
export function onEnterSettlement(st: Settlement) {
  for (const q of [...S.quests]) if (q.type === 'letter' && q.target === st.id) finishQuest(q, true);
}

export function canDeliverGrain(q: Quest) { return (player().goods.grain || 0) >= (q.amount || 0); }
export function deliverGrain(q: Quest) {
  const pp = player();
  pp.goods.grain -= q.amount!;
  const v = S.settlements[q.target as string];
  if (v) v.prosperity = Math.min(100, v.prosperity + 5);
  finishQuest(q, true);
}

export function eligibleTroops(q: Quest) {
  return player().troops.filter(s => (TROOPS[s.id]?.tier ?? 0) >= (q.troopTier ?? 2)).reduce((a, s) => a + s.n - s.w, 0);
}
export function deliverTroops(q: Quest) {
  const pp = player();
  const st = S.settlements[q.target as string];
  let need = q.amount!;
  for (const s of [...pp.troops].sort((a, b) => TROOPS[a.id].tier - TROOPS[b.id].tier)) {
    if (need <= 0) break;
    if (TROOPS[s.id].tier < (q.troopTier ?? 2)) continue;
    const k = Math.min(need, s.n - s.w);
    removeTroops(pp.troops, s.id, k);
    if (st) addTroops(st.garrison, s.id, k);
    need -= k;
  }
  finishQuest(q, true);
  void count;
}

export function dailyQuests() {
  for (const q of [...S.quests]) {
    if (S.time > q.deadline) {
      if (q.type === 'bandit' && typeof q.target === 'number') { const p = partyById(q.target); if (p) { p.questId = undefined; removeParty(p); } }
      finishQuest(q, false);
    }
  }
  void FACTION;
}
