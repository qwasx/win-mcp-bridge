// 据点菜单：城镇 / 城堡 / 村庄
import { sfx } from '../audio/sfx';
import { settlementVista, hashStr } from '../art/vista';
import { weatherAt, seasonOf } from '../core/weather';
import { toLL } from '../core/terrain';
import { troopPortrait, companionPortrait } from '../art/portrait';
import { h, openPanel, closeTop, closeAll, btn, toast, confirmDialog, replaceTop } from './dom';
import type { Settlement, Stack } from '../core/state';
import {
  S, player, log, lordName, playerHostileToSettlement, playerHostileTo, changePlayerRel, cultureOf, fiefsOf, partyById, setWar,
  refreshTavern, settlementList, emit, atWar,
} from '../core/game';
import { FACTION, COMPANIONS, BANDIT_ZONES } from '../data/world';
import { TROOPS, RECRUIT_OF, recruitCost, classLabel } from '../data/troops';
import { GOODS, GOOD, ITEMS } from '../data/items';
import { goodPrice, itemBuyPrice, itemSellPrice, ransomPrice } from '../core/economy';
import { addTroops, removeTroops, count, healthy, partySize, cargoCount, cargoLimit, sortStacks } from '../core/party';
import { partyLimit, partySkill } from '../core/character';
import { restInside, simulate, nav } from '../core/sim';
import { questOffer, acceptQuest, onEnterSettlement, canDeliverGrain, deliverGrain, eligibleTroops, deliverTroops } from '../core/quests';
import { startBattle } from './encounter';
import { myFollowers, lordsInside, partyLabel } from '../core/war';
import type { SiegeKit } from '../scenes/battle/siege';
import { playerAutoBattle, applyPlayerBattle, setOwner } from '../core/combat';
import { showReport } from './encounter';
import { saveGame } from '../core/save';
import { pick, randInt } from '../core/rng';
import { ll } from '../core/terrain';

const KIND = { town: '城镇', castle: '城堡', village: '村庄' } as const;

function header(st: Settlement) {
  const f = FACTION[st.faction];
  const gar = st.kind !== 'village' ? h('span', null, `守军 ${count(st.garrison)} 人`) : h('span', null, `可招募 ${st.recruits} 人 · 关系 ${st.relation}`);
  let vista: HTMLElement | null = null;
  try {
    const pp = player();
    vista = settlementVista({
      kind: st.kind, seed: hashStr(st.id), hour: S.time % 24, season: seasonOf(S.time), weather: weatherAt(pp.x, pp.y, S.time),
      color: f.color, looted: st.lootedUntil > S.time, siege: !!st.siege, capital: st.id === 'beijing' || st.id === 'shengjing' || f.capital === st.id,
      south: toLL(st.x, st.y)[1] < 32.5,
    });
    vista.className = 'st-vista';
  } catch { vista = null; }
  return h('div', null, vista, h('div', { class: 'st-head' },
    h('div', { class: 'st-flag', style: { background: f.css } }, f.name[0]),
    h('div', null,
      h('div', { class: 'st-name' }, st.name, h('small', null, ` ${KIND[st.kind]}`)),
      h('div', { class: 'st-sub' }, `${f.name} · 领主：${lordName(st.owner)}`, st.parent ? ` · 隶属${S.settlements[st.parent].name}` : ''),
      h('div', { class: 'st-sub' }, `繁荣 ${Math.round(st.prosperity)}　`, gar,
        st.siege ? h('span', { class: 'bad' }, ' · 正被围攻') : null,
        st.lootedUntil > S.time ? h('span', { class: 'bad' }, ' · 已遭洗劫') : null),
    ),
  ));
}

function flavor(st: Settlement) {
  const hr = S.time % 24;
  const t = hr < 6 ? '夜色深沉，' : hr < 11 ? '清晨时分，' : hr < 17 ? '日头正盛，' : hr < 20 ? '夕阳西下，' : '华灯初上，';
  if (st.kind === 'town') return `${t}${st.name}城内人声鼎沸，商贩云集，${st.prosperity > 60 ? '一派繁华景象' : st.prosperity > 35 ? '只是不少百姓面有菜色' : '街头满是逃荒的饥民'}。`;
  if (st.kind === 'castle') return `${t}${st.name}城头旌旗猎猎，守卒持械巡视。`;
  if (st.lootedUntil > S.time) return `${st.name}刚遭兵燹，房舍焦黑，村民四散。`;
  return `${t}${st.name}炊烟袅袅，${st.prosperity > 50 ? '田间麦浪起伏' : '田地多有荒芜'}。`;
}

export function openSettlement(st: Settlement) {
  closeAll();
  nav.target = null; nav.path = []; nav.waiting = false;
  const pp = player();
  pp.x = st.x + 6; pp.y = st.y + 6;
  sfx(st.kind === 'village' ? 'woodblock' : 'bell', { vol: st.kind === 'village' ? 0.5 : 0.45 });
  onEnterSettlement(st);
  const hostileSt = playerHostileToSettlement(st);
  const items: HTMLElement[] = [];
  const add = (label: string, fn: () => void, cls = '', disabled = false, title = '') => items.push(btn(label, fn, `menu-item ${cls}`, disabled, title));

  // 玩家正在围攻
  if (st.siege && st.siege.by === pp.id) return openSiege(st);

  if (hostileSt) {
    if (st.kind === 'village') {
      add('🔥 洗劫村庄', () => raidVillage(st), 'danger', st.lootedUntil > S.time || healthy(pp.troops) < 5, st.lootedUntil > S.time ? '已经被洗劫过了' : healthy(pp.troops) < 5 ? '至少需要 5 名健康的部下' : '');
    } else {
      add('⚔ 围攻此地', () => beginSiege(st), 'danger', healthy(pp.troops) < 10, healthy(pp.troops) < 10 ? '至少需要 10 名健康的部下' : '');
    }
    add('离开', () => closeTop());
    openPanel(st.name, h('div', null, header(st), h('p', { class: 'flavor' }, `${st.name}的守军对你充满敌意，城门紧闭。`), h('div', { class: 'menu' }, items)));
    return;
  }

  if (st.kind === 'town') {
    add('🏪 集市（买卖货物）', () => openTrade(st));
    add('⚒ 铁匠铺（兵器甲胄）', () => openShop(st));
    add('🍶 酒馆（雇佣兵、同伴、牙人）', () => openTavern(st));
    add('📜 衙门（差事）', () => openOffice(st));
    if (st.prosperity >= 35) add('🧨 军器局（火炮）', () => openArsenal(st));
    add(`🏯 拜见${lordName(st.owner)}`, () => openHall(st));
  } else if (st.kind === 'castle') {
    add(`🏯 拜见${lordName(st.owner)}`, () => openHall(st), '', st.owner === 'player');
  } else {
    add('🙋 招募乡勇', () => openRecruit(st), '', st.lootedUntil > S.time);
    add('🌾 购买粮草与土产', () => openTrade(st), '', st.lootedUntil > S.time);
    add('👴 拜访村长', () => openElder(st));
  }
  if (st.owner === 'player' && st.kind !== 'village') add('🛡 管理守军', () => openGarrison(st), 'gold');
  add('⛺ 休息', () => openRest(st));
  if (st.kind === 'village' && st.owner !== 'player') add('🔥 洗劫村庄', () => confirmDialog('洗劫村庄', `洗劫${st.name}会严重损害你与${FACTION[st.faction].name}的关系，确定吗？`, () => raidVillage(st)), 'danger', st.lootedUntil > S.time || healthy(pp.troops) < 5);
  add('离开', () => closeTop());
  openPanel(st.name, h('div', null, header(st), h('p', { class: 'flavor' }, flavor(st)), h('div', { class: 'menu' }, items)));
  if (S.time - (lastAuto) > 72) { lastAuto = S.time; saveGame('auto'); }
}
let lastAuto = -999;

// ---------- 集市 ----------
function openTrade(st: Settlement) {
  const pp = player();
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const rows = GOODS.filter(g => st.stock[g.id] !== undefined || pp.goods[g.id]).map(g => {
      const have = pp.goods[g.id] || 0;
      const canTrade = st.stock[g.id] !== undefined;
      const bp = canTrade ? goodPrice(st, g.id, true) : 0;
      const sp = canTrade ? goodPrice(st, g.id, false) : Math.round(g.base * 0.6);
      const tag = st.produce.includes(g.id) ? h('span', { class: 'tag good' }, '特产') : st.demand.includes(g.id) ? h('span', { class: 'tag bad' }, '紧缺') : null;
      const buy = (n: number) => {
        for (let i = 0; i < n; i++) {
          const p = goodPrice(st, g.id, true);
          if (pp.gold < p || (st.stock[g.id] ?? 0) < 1) break;
          pp.gold -= p; st.stock[g.id] -= 1; pp.goods[g.id] = (pp.goods[g.id] || 0) + 1;
        }
        render();
      };
      const sell = (n: number) => {
        for (let i = 0; i < n && (pp.goods[g.id] || 0) > 0; i++) {
          const p = canTrade ? goodPrice(st, g.id, false) : Math.round(g.base * 0.6);
          pp.gold += p; pp.goods[g.id]--; st.stock[g.id] = (st.stock[g.id] ?? 0) + 1;
        }
        if (!pp.goods[g.id]) delete pp.goods[g.id];
        render();
      };
      return h('tr', null,
        h('td', null, g.name, g.food ? h('span', { class: 'tag' }, '粮') : null, tag),
        h('td', { class: 'num' }, canTrade ? Math.floor(st.stock[g.id]) : '-'),
        h('td', { class: 'num' }, canTrade ? bp : '-'),
        h('td', { class: 'num' }, sp),
        h('td', { class: 'num' }, have),
        h('td', null, btn('买1', () => buy(1), 'sm', !canTrade || pp.gold < bp), btn('买5', () => buy(5), 'sm', !canTrade || pp.gold < bp),
          btn('卖1', () => sell(1), 'sm', !have), btn('全卖', () => sell(have), 'sm', !have)),
      );
    });
    body.append(
      h('div', { class: 'row between' }, h('span', null, `银两：${pp.gold}`), h('span', null, `载货：${cargoCount(pp)}/${cargoLimit(S, pp)}`), h('span', { class: 'dim' }, `交易技能 ${partySkill(S, 'trade')}`)),
      h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ...['货物', '存量', '买价', '卖价', '持有', ''].map(x => h('th', null, x)))), h('tbody', null, rows)),
      h('p', { class: 'dim' }, '提示：特产价格低廉，紧缺货物售价更高。大量买卖会推动价格变化。'),
    );
  };
  render();
  openPanel(`${st.name} · 集市`, body, { wide: true });
}

// ---------- 铁匠铺 ----------
function openShop(st: Settlement) {
  const pp = player();
  const body = h('div');
  const statLine = (id: string) => {
    const it = ITEMS[id];
    if (it.slot === 'melee') return `伤害${it.dmg} 距离${it.reach}${it.antiCav ? ' 克骑' : ''}`;
    if (it.slot === 'ranged') return `伤害${it.dmg} 射程${it.range} 装填${it.reload}s`;
    if (it.slot === 'horse') return `速度${it.horseSpeed} 护甲${it.horseArmor} 需骑术${Math.max(0, it.tier - 2)}`;
    return `护甲${it.armor}`;
  };
  const render = () => {
    body.innerHTML = '';
    const forSale = st.shop.map((id, idx) => {
      const it = ITEMS[id]; const price = itemBuyPrice(id);
      return h('div', { class: 'item' }, h('div', null, h('b', null, it.name), h('small', null, ` [${slotName(it.slot)}] ${statLine(id)}`), h('div', { class: 'dim' }, it.desc)),
        btn(`购买 ${price}两`, () => { if (pp.gold < price) return toast('银两不足'); pp.gold -= price; S.hero.inventory.push(id); st.shop.splice(idx, 1); toast(`购得${it.name}，可在行囊中装备`); render(); }, 'sm', pp.gold < price));
    });
    const mine = S.hero.inventory.map((id, idx) => {
      const it = ITEMS[id]; const price = itemSellPrice(id);
      return h('div', { class: 'item' }, h('div', null, h('b', null, it.name), h('small', null, ` [${slotName(it.slot)}] ${statLine(id)}`)),
        btn(`出售 ${price}两`, () => { pp.gold += price; S.hero.inventory.splice(idx, 1); st.shop.push(id); render(); }, 'sm'));
    });
    body.append(h('div', { class: 'row between' }, h('span', null, `银两：${pp.gold}`)),
      h('div', { class: 'cols' },
        h('div', null, h('h4', null, '待售'), forSale.length ? forSale : h('p', { class: 'dim' }, '货架空空如也。')),
        h('div', null, h('h4', null, '你的行囊'), mine.length ? mine : h('p', { class: 'dim' }, '行囊中没有多余的装备。')),
      ));
  };
  render();
  openPanel(`${st.name} · 铁匠铺`, body, { wide: true });
}
function slotName(s: string) { return ({ melee: '近战', ranged: '远程', armor: '身甲', helm: '头盔', horse: '坐骑' } as Record<string, string>)[s]; }

// ---------- 酒馆 ----------
function openTavern(st: Settlement) {
  const pp = player();
  if (st.tavern.refresh < S.time) refreshTavern(st);
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const space = partyLimit(S) - partySize(S, pp);
    // 雇佣兵
    const m = st.tavern.mercs;
    if (m && m.n > 0) {
      const t = TROOPS[m.id]; const c = recruitCost(t);
      const n = Math.min(m.n, space, Math.floor(pp.gold / c));
      body.append(h('div', { class: 'card with-portrait' }, troopPortrait(m.id, 52), h('b', null, `一伙${t.name}（${m.n}人）`), h('p', { class: 'dim' }, `${t.desc} ${classLabel(t.cls)} · ${t.tier}等 · 每人 ${c} 两，周饷 ${t.wage}`),
        btn(`雇佣 ${n} 人（${n * c}两）`, () => { pp.gold -= n * c; addTroops(pp.troops, m.id, n); m.n -= n; log(`在${st.name}雇佣了 ${n} 名${t.name}。`, 'good'); render(); }, 'sm', n <= 0)));
    } else body.append(h('p', { class: 'dim' }, '酒馆里没有待雇的佣兵。'));
    // 同伴
    if (st.tavern.companion) {
      const d = COMPANIONS.find(c => c.id === st.tavern.companion)!;
      const sk = Object.entries(d.skills).map(([k, v]) => `${skillCn(k)}${v}`).join(' ');
      body.append(h('div', { class: 'card comp with-portrait' }, companionPortrait(d.id, 60), h('b', null, `${d.name}`, h('small', null, ` · ${d.title}`)), h('p', null, `“${d.story}”`), h('p', { class: 'dim' }, `擅长：${sk}`),
        btn(`招揽（${d.cost}两）`, () => {
          if (pp.gold < d.cost) return toast('银两不足');
          if (space <= 0) return toast('部队已满');
          pp.gold -= d.cost; S.companions.push({ id: d.id, wounded: 0, joined: S.time }); st.tavern.companion = null;
          log(`${d.name}加入了你的队伍！`, 'gold'); render();
        }, 'sm primary', pp.gold < d.cost || space <= 0)));
    }
    // 牙人（赎俘虏）
    const pr = pp.prisoners;
    if (pr.length) {
      let total = 0;
      const rows = pr.map(s => { const p = ransomPrice(TROOPS[s.id].tier); total += p * s.n; return h('div', null, `${TROOPS[s.id].name} ×${s.n}（每人 ${p} 两）`); });
      body.append(h('div', { class: 'card' }, h('b', null, '牙人'), h('p', { class: 'dim' }, '“俘虏？我全要了，价钱公道。”'), rows,
        btn(`全部卖出（${total}两）`, () => { pp.gold += total; pp.prisoners = []; log(`卖出俘虏得银 ${total} 两。`, 'good'); render(); }, 'sm')));
    }
    body.append(h('div', { class: 'card' }, h('b', null, '酒客闲谈'), h('p', null, rumor(st))));
  };
  render();
  openPanel(`${st.name} · 酒馆`, body);
}
export function skillCn(k: string) {
  return ({ ironflesh: '铁骨', powerstrike: '强击', archery: '射术', riding: '骑术', leadership: '统御', training: '训练', tactics: '战术', trade: '交易', surgery: '医术', spotting: '侦察', pathfinding: '寻路', prisoner: '管束' } as Record<string, string>)[k] ?? k;
}
function rumor(st: Settlement) {
  const r = Math.random();
  const towns = settlementList().filter(s => s.kind === 'town' && s.id !== st.id);
  if (r < 0.4) {
    const t = pick(towns); const g = pick(t.demand.length ? t.demand : t.produce);
    return t.demand.includes(g) ? `“听说${t.name}那边${GOOD[g].name}紧缺，价钱高得吓人。”` : `“${t.name}的${GOOD[g].name}便宜得很，贩回来能赚一笔。”`;
  }
  if (r < 0.6) { const z = pick(BANDIT_ZONES); return `“最近${z.name}闹得厉害，路过可得多带些人手。”`; }
  if (r < 0.8) {
    const wars = S.wars.filter(k => !k.includes('player'));
    if (wars.length) { const [a, b] = pick(wars).split('|'); return `“${FACTION[a].name}和${FACTION[b].name}还在打仗，这世道……”`; }
  }
  const lines = ['“陕西又闹旱灾了，人吃人啊。”', '“听说辽东的鞑子又要入关了。”', '“闯王来了不纳粮，这话你信吗？”', '“客官，来一壶烧刀子？”', '“城外的官道不太平，入夜别赶路。”'];
  return pick(lines);
}

// ---------- 衙门 / 村长 ----------
function questCard(st: Settlement) {
  const q = questOffer(st);
  if (!q) return h('p', { class: 'dim' }, '“眼下没什么差事要劳烦壮士。”');
  return h('div', { class: 'card' }, h('b', null, q.title), h('p', null, q.desc), h('p', { class: 'dim' }, `期限 ${Math.round((q.deadline - S.time) / 24)} 天 · 报酬 ${q.reward} 两`),
    btn('接下差事', () => { if (acceptQuest(q)) { toast('已接受任务'); closeTop(); } else toast('任务太多了（最多5个）'); }, 'sm primary'));
}
function openOffice(st: Settlement) {
  const body = h('div');
  const tq = S.quests.find(q => q.type === 'troops' && q.target === st.id);
  if (tq) {
    const el = eligibleTroops(tq);
    body.append(h('div', { class: 'card' }, h('b', null, tq.title), h('p', null, `需要 ${tq.amount} 名二等以上士兵，你有 ${el} 名。`),
      btn('交付士兵', () => { deliverTroops(tq); closeTop(); }, 'sm primary', el < (tq.amount ?? 0))));
  }
  body.append(questCard(st));
  openPanel(`${st.name} · 衙门`, body);
}
function openElder(st: Settlement) {
  const body = h('div');
  body.append(h('p', { class: 'flavor' }, st.relation > 20 ? '村长笑逐颜开：“恩公来了！快请进！”' : st.relation < -10 ? '村长冷冷地看着你。' : '村长拱了拱手：“这位壮士有何贵干？”'));
  const gq = S.quests.find(q => q.type === 'grain' && q.target === st.id);
  if (gq) body.append(h('div', { class: 'card' }, h('b', null, gq.title), h('p', null, `需要米粮 ${gq.amount} 袋，你有 ${player().goods.grain || 0} 袋。`),
    btn('交付米粮', () => { deliverGrain(gq); closeTop(); }, 'sm primary', !canDeliverGrain(gq))));
  else body.append(questCard(st));
  openPanel(`${st.name} · 村长`, body);
}

// ---------- 招募 ----------
function openRecruit(st: Settlement) {
  const pp = player();
  const body = h('div');
  const culture = st.owner === 'player' ? cultureOf(S.playerFaction ?? 'ming') : FACTION[st.faction].culture;
  const tid = RECRUIT_OF[culture] ?? 'ming_recruit';
  const t = TROOPS[tid];
  const render = () => {
    body.innerHTML = '';
    const cost = recruitCost(t);
    const space = partyLimit(S) - partySize(S, pp);
    const can = Math.min(st.recruits, space, Math.floor(pp.gold / cost));
    if (st.relation < -10) { body.append(h('p', null, '村民们对你心存戒备，没人愿意跟你走。（关系过低）')); return; }
    body.append(h('div', { class: 'recruit-row' }, troopPortrait(tid, 56), troopPortrait(tid, 50), troopPortrait(tid, 56)), h('p', null, `村里有 ${st.recruits} 名青壮愿意从军（${t.name}，每人 ${cost} 两安家银）。`),
      h('p', { class: 'dim' }, `部队空位：${space}`),
      h('div', { class: 'row' }, btn('招募 1 人', () => hire(1), 'sm', can < 1), btn(`全部招募（${can}人）`, () => hire(can), 'sm primary', can < 1)));
    function hire(n: number) { pp.gold -= n * cost; st.recruits -= n; addTroops(pp.troops, tid, n); st.relation = Math.min(100, st.relation + (n > 3 ? 1 : 0)); render(); }
  };
  render();
  openPanel(`${st.name} · 招募`, body);
}

// ---------- 休息 ----------
function openRest(st: Settlement) {
  const pp = player();
  const costPerDay = st.kind === 'town' && st.owner !== 'player' ? Math.ceil(partySize(S, pp) / 4) : 0;
  const doRest = (hours: number) => {
    const days = Math.ceil(hours / 24);
    const c = costPerDay * days;
    if (pp.gold < c) return toast('银两不足以支付食宿');
    pp.gold -= c;
    closeAll();
    restInside(st, hours);
    pp.inside = undefined;
    toast(`休息了 ${hours} 个时辰${hours >= 24 ? `（${days}天）` : ''}`.replace('个时辰', '小时'));
    openSettlement(st);
  };
  const needHeal = S.hero.hp < 1 || pp.troops.some(s => s.w > 0) || S.companions.some(c => c.wounded > 0);
  openPanel('休息', h('div', null,
    h('p', null, costPerDay ? `在客栈休整每天需花费 ${costPerDay} 两。` : '你可以在此免费休整。'),
    h('p', { class: 'dim' }, '休息时伤员恢复更快，但时间照常流逝。'),
    h('div', { class: 'menu' },
      btn('休息至天明', () => doRest(Math.max(1, Math.round((30 - (S.time % 24)) % 24) || 24)), 'menu-item'),
      btn('休息一天', () => doRest(24), 'menu-item'),
      btn('休息至痊愈（最多5天）', () => {
        let hrs = 0;
        const heroNeed = (1 - S.hero.hp) / 0.033;
        const w = pp.troops.reduce((a, s) => a + s.w, 0);
        hrs = Math.min(120, Math.max(heroNeed, w > 0 ? 24 * Math.min(5, Math.ceil(Math.log(Math.max(1, w)) / 0.25)) : 0, ...S.companions.map(c => c.wounded / 2)));
        doRest(Math.max(6, Math.ceil(hrs)));
      }, 'menu-item', !needHeal),
      btn('返回', () => closeTop(), 'menu-item'),
    )));
}

// ---------- 领主府 ----------
function openHall(st: Settlement) {
  const pp = player();
  const f = FACTION[st.faction];
  const isRuler = st.owner === `ruler_${st.faction}`;
  const lordId = st.owner && !isRuler ? st.owner : null;
  const lord = lordId ? S.lords[lordId] : null;
  if (lord) {
    const lp = lord.partyId ? partyById(lord.partyId) : null;
    if (!lp || lp.inside !== st.id) {
      openPanel('领主府', h('div', null, h('p', null, `管家告诉你：“${lord.title}${lord.name}大人率军在外，不在府中。”`), btn('离开', () => closeTop())));
      return;
    }
  }
  const name = isRuler ? `${f.rulerTitle}${f.ruler}` : lord ? `${lord.title}${lord.name}` : '城主';
  const rel = S.playerRel[st.faction] ?? 0;
  const body = h('div');
  const greet = rel < -5 ? '冷冷地打量着你：“你来做什么？”' : S.renown < 30 ? '瞥了你一眼：“无名之辈，有何贵干？”' : S.renown < 150 ? '点了点头：“久闻壮士之名。”' : '起身相迎：“将军威名远播，请坐！”';
  body.append(h('p', { class: 'flavor' }, `${name}${greet}`), h('p', { class: 'dim' }, `你与${f.name}的关系：${rel} · 你的声望：${S.renown}`));
  const menu = h('div', { class: 'menu' });
  body.append(menu);
  const add = (label: string, fn: () => void, disabled = false, title = '') => menu.appendChild(btn(label, fn, 'menu-item', disabled, title));

  if (S.playerFaction === st.faction) {
    add('“末将听候调遣。”（查看战况）', () => { closeTop(); openPanel('战况', h('div', null, h('p', null, `${f.name}当前的敌人：${S.wars.filter(k => k.includes(st.faction)).map(k => k.split('|').find(x => x !== st.faction)!).map(x => FACTION[x].name).join('、') || '无'}`), btn('好', () => closeTop()))); });
    if (isRuler) add('“臣请辞去封臣之位。”', () => confirmDialog('辞去封臣', `辞去后你的封地将独立，并与${f.name}开战。确定吗？`, () => {
      S.playerFaction = null;
      for (const s of fiefsOf('player')) { setOwner(s, 'player', 'player'); }
      if (fiefsOf('player').length) setWar('player', st.faction, true);
      changePlayerRel(st.faction, -30);
      log(`你辞去了${f.name}封臣之位。`, 'bad'); emit('ownerChanged'); closeAll();
    }));
  } else {
    if (S.mercOf !== st.faction && !S.playerFaction) {
      add(`“愿受雇于${f.name}，为您征战。”（雇佣兵契约 30 天）`, () => {
        S.mercOf = st.faction; S.mercUntil = S.time + 24 * 30;
        log(`你与${f.name}签订了雇佣兵契约，为期 30 天。每周可领取雇佣金。`, 'quest'); closeAll();
      }, S.renown < 30 || rel < -5 || playerHostileTo(st.faction), S.renown < 30 ? '需要声望 30' : '');
    }
    if (isRuler && !S.playerFaction) {
      add(`“愿为${f.rulerTitle}效犬马之劳！”（成为封臣）`, () => becomeVassal(st), S.renown < 120 || rel < 0 || playerHostileTo(st.faction), S.renown < 120 ? '需要声望 120 且关系不低于 0' : '');
    }
    if (playerHostileTo(st.faction) && !(S.playerFaction && atWar(S.playerFaction, st.faction))) {
      const cost = 300 + S.renown * 3;
      add(`“我愿化干戈为玉帛。”（赔款 ${cost} 两求和）`, () => {
        if (pp.gold < cost) return toast('银两不足');
        pp.gold -= cost; S.playerRel[st.faction] = 0; setWar('player', st.faction, false);
        log(`你与${f.name}讲和了。`, 'good'); closeAll();
      }, pp.gold < cost);
    }
  }
  add('告辞', () => closeTop());
  openPanel(isRuler ? '朝堂' : '领主府', body);
}

function becomeVassal(st: Settlement) {
  const f = FACTION[st.faction];
  S.playerFaction = st.faction; S.mercOf = null;
  // 独立领地并入
  for (const s of fiefsOf('player')) { s.faction = st.faction; for (const v of s.villages) S.settlements[v].faction = st.faction; }
  S.wars = S.wars.filter(k => !k.includes('player'));
  // 赐予封地：首都附近一座村庄
  const cap = S.settlements[f.capital];
  const vills = settlementList().filter(s => s.kind === 'village' && s.faction === st.faction && s.owner !== 'player').sort((a, b) => Math.hypot(a.x - cap.x, a.y - cap.y) - Math.hypot(b.x - cap.x, b.y - cap.y));
  const v = vills[randInt(0, Math.min(3, vills.length - 1))];
  if (v) { v.owner = 'player'; }
  changePlayerRel(st.faction, 10);
  log(`你向${f.rulerTitle}${f.ruler}宣誓效忠，成为${f.name}的封臣！${v ? `获赐封地：${v.name}。` : ''}`, 'gold');
  emit('ownerChanged');
  closeAll();
  openPanel('宣誓效忠', h('div', null, h('p', { class: 'flavor' }, `${f.ruler}亲手扶起你：“从今往后，你便是我${f.name}的栋梁。望你奋勇杀敌，莫负朕望！”`),
    v ? h('p', null, `你获得了封地 ${v.name}，每周将收到税银。攻占的敌方据点也将归你所有。`) : null, btn('谢恩', () => closeTop(), 'primary')));
}

// ---------- 守军管理 ----------
function openGarrison(st: Settlement) {
  const pp = player();
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    sortStacks(pp.troops); sortStacks(st.garrison);
    const list = (from: Stack[], to: Stack[], dir: string) => from.map(s => h('div', { class: 'trow' },
      h('span', null, `${TROOPS[s.id].name} ×${s.n}${s.w ? `（${s.w}伤）` : ''}`),
      h('span', null,
        btn(`${dir}1`, () => { move(from, to, s.id, 1); }, 'sm'),
        btn(`${dir}全部`, () => { move(from, to, s.id, s.n); }, 'sm'))));
    const move = (from: Stack[], to: Stack[], id: string, n: number) => {
      if (to === pp.troops) n = Math.min(n, partyLimit(S) - partySize(S, pp));
      if (n <= 0) return toast('部队已满');
      const st0 = from.find(x => x.id === id)!;
      const w = Math.min(st0.w, Math.round(st0.w * n / st0.n));
      removeTroops(from, id, n); addTroops(to, id, n, w);
      render();
    };
    body.append(h('div', { class: 'cols' },
      h('div', null, h('h4', null, `你的部队（${count(pp.troops)}）`), list(pp.troops, st.garrison, '留守 ')),
      h('div', null, h('h4', null, `${st.name}守军（${count(st.garrison)}）`), list(st.garrison, pp.troops, '带走 ')),
    ), h('p', { class: 'dim' }, '守军军饷为正常的一半，由你每周支付。'));
  };
  render();
  openPanel(`${st.name} · 守军`, body, { wide: true });
}

// ---------- 洗劫 ----------
function raidVillage(st: Settlement) {
  closeAll();
  const pp = player();
  const militia: Stack[] = [{ id: 'civ_peasant', n: 8 + Math.round(st.prosperity / 6), w: 0, xp: 0 }];
  const wasHostile = playerHostileTo(st.faction);
  const out = playerAutoBattle(militia);
  out.heroDown = false;
  if (!out.win) {
    const rep = applyPlayerBattle(null, { ...st, garrison: militia } as Settlement, { ...out, retreat: true });
    showReport({ ...rep, title: '洗劫失败' });
    return;
  }
  for (const id in out.ourDown) removeTroops(pp.troops, id, Math.ceil(out.ourDown[id] / 3));
  const gold = Math.round(st.prosperity * 4 + randInt(50, 150));
  pp.gold += gold;
  const loot: string[] = [`${gold} 两银子`];
  for (const g of st.produce) { const n = randInt(2, 5); pp.goods[g] = (pp.goods[g] || 0) + n; loot.push(`${GOOD[g].name} ×${n}`); }
  st.lootedUntil = S.time + 24 * 5; st.prosperity = Math.max(5, st.prosperity - 15); st.relation = Math.max(-100, st.relation - 30);
  changePlayerRel(st.faction, wasHostile ? -3 : -25);
  S.honor -= 2;
  log(`你洗劫了${st.name}。`, 'bad');
  showReport({ title: '洗劫村庄', win: true, lines: [`你的部下冲进${st.name}，村民四散奔逃。`], loot, prisoners: [] });
  simulate(4);
}

// ---------- 攻城 ----------
const SIEGE_PREP = 10;
const RAM_AT = 18, MINE_DUR = 30;
export function siegeKitOf(st: Settlement): SiegeKit {
  const el = S.time - (st.siege?.since ?? S.time);
  return {
    ladders: el < SIEGE_PREP ? 0 : Math.min(6, 3 + Math.floor((el - SIEGE_PREP) / 8)),
    ram: el >= RAM_AT,
    cannons: Math.min(4, S.cannons ?? 0),
    mine: !!st.siege?.mineAt && S.time - st.siege.mineAt >= MINE_DUR,
  };
}
function beginSiege(st: Settlement) {
  const pp = player();
  if (st.siege && st.siege.by !== pp.id) { const p = partyById(st.siege.by); if (p) return toast(`${p.name}正在围攻此地`); }
  if (!playerHostileTo(st.faction) || !S.playerFaction) {
    // 独立玩家攻击会导致开战
    if (!(S.playerFaction && atWar(S.playerFaction, st.faction)) && !(S.mercOf && atWar(S.mercOf, st.faction))) {
      changePlayerRel(st.faction, -10);
    }
  }
  st.siege = { by: pp.id, since: S.time };
  log(`你开始围攻${st.name}，部下们开始伐木打造云梯。`, 'war');
  openSiege(st);
}

function openSiege(st: Settlement) {
  closeAll();
  const pp = player();
  const elapsed = S.time - (st.siege?.since ?? S.time);
  const ready = elapsed >= SIEGE_PREP;
  const kit = siegeKitOf(st);
  const fol = myFollowers();
  const inside = lordsInside(st);
  const mineLeft = st.siege?.mineAt ? Math.max(0, Math.ceil(MINE_DUR - (S.time - st.siege.mineAt))) : -1;
  const wait = (hrs: number) => () => { closeAll(); const interrupted = simulate(Math.max(0.5, hrs)); if (!interrupted && st.siege) openSiege(st); };
  const line = (ok: boolean, txt: string) => h('div', { class: ok ? 'good' : 'dim' }, (ok ? '✔ ' : '… ') + txt);
  const our = healthy(pp.troops) + fol.reduce((a, p) => a + healthy(p.troops), 0);
  const their = healthy(st.garrison) + inside.reduce((a, p) => a + healthy(p.troops), 0);
  const body = h('div', null, header(st),
    h('p', { class: 'flavor' }, ready ? '营中斧锯声不绝。将士们摩拳擦掌，只待一声令下。' : `部下正在伐木打造云梯，还需约 ${Math.ceil(SIEGE_PREP - elapsed)} 小时。`),
    h('div', { class: 'card' },
      h('b', null, '攻城器械'),
      line(kit.ladders > 0, kit.ladders ? `云梯 ${kit.ladders} 架${kit.ladders < 6 ? '（每 8 小时再造一架，至多 6 架）' : ''}` : '云梯：尚未造好'),
      line(kit.ram, kit.ram ? '冲车一辆，可撞城门' : `冲车：还需 ${Math.ceil(RAM_AT - elapsed)} 小时`),
      line(kit.cannons > 0, kit.cannons ? `随军火炮 ${kit.cannons} 门，可轰城门与城墙` : '火炮：无（可在城镇军器局购置）'),
      line(kit.mine, kit.mine ? '地道已挖到城下，开战后点燃火药炸开城墙' : mineLeft >= 0 ? `地道：还需 ${mineLeft} 小时` : '地道：未开挖'),
    ),
    h('p', { class: 'dim' }, `守军约 ${their} 人${inside.length ? `（含${inside.map(p => partyLabel(p)).join('、')}）` : ''}；我军 ${our} 人可战${fol.length ? `（含军团 ${fol.length} 路）` : ''}。${st.kind === 'town' ? '城高池深，' : ''}守城一方占据地利。`),
    h('div', { class: 'menu' },
      ready ? btn('⚔ 亲自率军攻城', () => { closeAll(); startBattle(null, st, true, { kit: siegeKitOf(st) }); }, 'menu-item danger', S.hero.hp < 0.25, S.hero.hp < 0.25 ? '你伤势过重' : '') : btn(`等待准备（${Math.ceil(SIEGE_PREP - elapsed)}小时）`, wait(SIEGE_PREP - elapsed), 'menu-item'),
      ready ? btn('🎲 下令攻城（自动结算）', () => { closeAll(); startBattle(null, st, false, { kit: siegeKitOf(st) }); }, 'menu-item') : null,
      ready && (kit.ladders < 6 || !kit.ram) ? btn('🪓 继续打造器械（8 小时）', wait(8), 'menu-item') : null,
      !st.siege?.mineAt ? btn('⛏ 挖掘地道（约 30 小时，需 40 人）', () => { st.siege!.mineAt = S.time; log(`你命工兵在${st.name}城外挖掘地道。`, 'war'); openSiege(st); }, 'menu-item', healthy(pp.troops) < 40, healthy(pp.troops) < 40 ? '至少需要 40 名健康的部下' : '')
        : !kit.mine ? btn(`⛏ 等待地道挖通（${mineLeft} 小时）`, wait(mineLeft), 'menu-item') : null,
      btn('解除包围', () => { st.siege = null; closeAll(); log(`你解除了对${st.name}的包围。`, 'dim'); }, 'menu-item'),
      btn('暂时离开（保持包围）', () => closeAll(), 'menu-item'),
    ));
  openPanel(`围攻${st.name}`, body);
  void replaceTop; void ll;
}

// ---------- 军器局：火炮 ----------
export const CANNON_PRICE = 850;
function openArsenal(st: Settlement) {
  const pp = player();
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const n = S.cannons ?? 0;
    const price = Math.round(CANNON_PRICE * (st.faction === 'ming' || st.faction === 'jin' ? 1 : 1.25));
    body.append(
      h('p', { class: 'flavor' }, `军器局的工匠正在浇铸炮身，红夷大炮、佛郎机一字排开。“将军要几门？一门炮连炮手、火药、骡车，${price} 两。”`),
      h('p', null, `你现有火炮 ${n} 门（至多 4 门）。每门火炮会让行军略慢一些，攻城时可轰击城门与城墙。`),
      h('div', { class: 'row' },
        btn(`购置一门（${price} 两）`, () => { if (pp.gold < price) return toast('银子不够'); pp.gold -= price; S.cannons = n + 1; sfx('coin'); render(); }, 'primary', n >= 4 || pp.gold < price),
        btn(`变卖一门（${Math.round(price * 0.45)} 两）`, () => { S.cannons = n - 1; pp.gold += Math.round(price * 0.45); sfx('coin'); render(); }, '', n <= 0),
        btn('返回', () => closeTop()),
      ));
  };
  render();
  openPanel('军器局', body);
}
