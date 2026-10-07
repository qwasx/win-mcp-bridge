// 角色、部队、行囊、势力、任务、日志面板
import { h, openPanel, closeTop, btn, toast, bar, replaceTop } from './dom';
import { S, player, log, lordName, dateStr, fiefsOf, factionSettlements, atWar, playerHostileTo, playerSide } from '../core/game';
import { ATTRS, SKILLS, skillCap, xpForLevel, heroMaxHp, heroArmor, partyLimit, prisonerLimit, partySkill, horseRidingReq } from '../core/character';
import { TROOPS, UPGRADE_XP, upgradeCost, classLabel } from '../data/troops';
import { ITEMS, SLOT_LABEL, GOOD, type Slot } from '../data/items';
import { FACTION, FACTIONS, MAJOR_FACTIONS, COMPANIONS } from '../data/world';
import { count, wounded, healthy, weeklyWages, foodCount, dailyFood, canUpgrade, addTroops, removeTroops, mapSpeed, sortStacks, cargoCount, cargoLimit, partySize } from '../core/party';
import { isNight } from '../core/game';
import { skillCn } from './settlement';
import { chance } from '../core/rng';

// ---------- 角色 ----------
export function openCharacter() {
  const hero = S.hero;
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const need = xpForLevel(hero.level);
    body.append(
      h('div', { class: 'row between' }, h('div', null, h('div', { class: 'st-name' }, hero.name), h('div', { class: 'st-sub' }, `${hero.level} 级 · 声望 ${S.renown} · 荣誉 ${S.honor}`)),
        h('div', { style: { width: '220px' } }, bar(hero.xp / need, '#c9a24a', `经验 ${hero.xp}/${need}`))),
      h('div', { class: 'cols' },
        h('div', null,
          h('h4', null, `属性（可用 ${hero.attrPts} 点）`),
          ...ATTRS.map(a => h('div', { class: 'trow', title: a.desc }, h('span', null, `${a.name}　`, h('b', null, hero.attrs[a.id])), h('span', { class: 'dim small' }, a.desc),
            btn('+', () => { hero.attrPts--; hero.attrs[a.id]++; if (a.id === 'int') hero.skillPts++; render(); }, 'sm', hero.attrPts <= 0))),
          h('h4', null, '状态'),
          h('div', { class: 'stats' },
            stat('生命', `${Math.round(hero.hp * heroMaxHp(hero))}/${heroMaxHp(hero)}`),
            stat('护甲', heroArmor(hero)),
            stat('部队上限', partyLimit(S)),
            stat('俘虏上限', prisonerLimit(S)),
            stat('已击倒敌人', S.stats.kills),
            stat('胜 / 负', `${S.stats.won} / ${S.stats.lost}`),
          ),
        ),
        h('div', null,
          h('h4', null, `技能（可用 ${hero.skillPts} 点）`),
          ...SKILLS.map(s => {
            const cap = skillCap(hero, s.id);
            const ps = partySkill(S, s.id);
            return h('div', { class: 'trow', title: `${s.desc}（上限取决于${ATTRS.find(a => a.id === s.attr)!.name}）` },
              h('span', null, `${s.name}　`, h('b', null, hero.skills[s.id]), ps > hero.skills[s.id] ? h('small', { class: 'good' }, `（队伍 ${ps}）`) : null),
              h('span', { class: 'dim small' }, s.desc),
              btn('+', () => { hero.skillPts--; hero.skills[s.id]++; render(); }, 'sm', hero.skillPts <= 0 || hero.skills[s.id] >= cap, hero.skills[s.id] >= cap ? `上限 ${cap}，需提升${ATTRS.find(a => a.id === s.attr)!.name}` : ''));
          }),
        ),
      ),
    );
  };
  render();
  openPanel('角色', body, { wide: true });
}
function stat(k: string, v: any) { return h('div', { class: 'stat' }, h('span', null, k), h('b', null, String(v))); }

// ---------- 部队 ----------
export function openParty() {
  const pp = player();
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    sortStacks(pp.troops);
    const food = foodCount(pp), per = dailyFood(S, pp);
    body.append(h('div', { class: 'stats' },
      stat('人数', `${partySize(S, pp)}/${partyLimit(S)}`), stat('负伤', wounded(pp.troops)), stat('周饷', `${weeklyWages(S, pp)}两`),
      stat('粮食', `${food}（${Math.floor(food / per)}天）`), stat('士气', Math.round(S.morale)), stat('行军速度', mapSpeed(S, pp, isNight()).toFixed(1)),
    ));
    // 同伴
    if (S.companions.length) {
      body.append(h('h4', null, '同伴'));
      for (const c of S.companions) {
        const d = COMPANIONS.find(x => x.id === c.id)!;
        body.append(h('div', { class: 'trow' }, h('span', null, h('b', null, d.name), h('small', null, ` ${d.title}`), c.wounded > 0 ? h('span', { class: 'bad' }, ` 负伤（${Math.ceil(c.wounded)}小时）`) : null),
          h('span', { class: 'dim small' }, Object.entries(d.skills).map(([k, v]) => `${skillCn(k)}${v}`).join(' ')),
          btn('遣散', () => { if (confirm(`确定让${d.name}离队吗？`)) { S.companions = S.companions.filter(x => x !== c); log(`${d.name}离开了队伍。`, 'dim'); render(); } }, 'sm')));
      }
    }
    body.append(h('h4', null, `兵员（${count(pp.troops)}）`));
    if (!pp.troops.length) body.append(h('p', { class: 'dim' }, '你还没有任何部下。去村庄招募乡勇，或者去酒馆雇佣兵吧。'));
    for (const st of pp.troops) {
      const t = TROOPS[st.id];
      const need = UPGRADE_XP[t.tier];
      const ready = canUpgrade(st);
      const xpPer = st.n ? st.xp / st.n : 0;
      const ups = t.upgrades.map(uid => {
        const u = TROOPS[uid];
        const cost = upgradeCost(t.tier);
        const n = Math.min(ready, Math.floor(pp.gold / cost));
        return btn(`→ ${u.name}${n ? ` ×${n}` : ''}（${cost}两/人）`, () => {
          removeTroops(pp.troops, st.id, n);
          st.xp -= n * need;
          addTroops(pp.troops, uid, n);
          const ns = pp.troops.find(x => x.id === uid)!;
          pp.gold -= n * cost;
          void ns;
          log(`${n} 名${t.name}晋升为${u.name}。`, 'good');
          render();
        }, 'sm up', n <= 0, `${u.name}：${classLabel(u.cls)} 生命${u.hp} 攻${u.atk} 甲${u.def}${u.rng ? ` 远程${u.rng}` : ''}`);
      });
      body.append(h('div', { class: 'troop' },
        h('div', { class: 'troop-main' },
          h('span', { class: `cls cls-${t.cls}` }, classLabel(t.cls)),
          h('b', { title: t.desc }, t.name), h('small', { class: 'tier' }, '★'.repeat(t.tier)),
          h('span', null, ` ×${st.n}`), st.w ? h('span', { class: 'bad' }, `（${st.w}伤）`) : null,
          h('span', { class: 'dim small' }, ` 生命${t.hp} 攻${t.atk} 甲${t.def}${t.rng ? ` 远${t.rng}` : ''} 饷${t.wage}`),
          h('span', { class: 'grow' }),
          btn('遣散1', () => { removeTroops(pp.troops, st.id, 1); render(); }, 'sm ghost'),
        ),
        t.upgrades.length ? h('div', { class: 'troop-up' }, h('div', { style: { width: '160px' } }, bar(Math.min(1, (xpPer % need) / need + (ready > 0 ? 1 : 0)), ready ? '#5fb85f' : '#8a7a5a', ready ? `可晋升 ${ready} 人` : `经验 ${Math.floor(xpPer)}/${need}`)), ...ups) : null,
      ));
    }
    // 俘虏
    body.append(h('h4', null, `俘虏（${count(pp.prisoners)}/${prisonerLimit(S)}）`));
    if (!pp.prisoners.length) body.append(h('p', { class: 'dim' }, '没有俘虏。在战斗中获胜可以俘获敌兵，到城镇酒馆找牙人换钱，或者招降他们。'));
    for (const st of pp.prisoners) {
      const t = TROOPS[st.id];
      const chanceP = Math.min(0.85, 0.25 + S.hero.attrs.cha * 0.03 + S.hero.skills.leadership * 0.03 - t.tier * 0.04);
      body.append(h('div', { class: 'trow' }, h('span', null, `${t.name} ×${st.n}`),
        h('span', null,
          btn(`招降（成功率${Math.round(chanceP * 100)}%）`, () => {
            const space = partyLimit(S) - partySize(S, pp);
            if (space <= 0) return toast('部队已满');
            let ok = 0; const tries = Math.min(st.n, space);
            for (let i = 0; i < tries; i++) if (chance(chanceP)) ok++;
            removeTroops(pp.prisoners, st.id, tries);
            if (t.culture !== 'bandit' && t.culture !== 'civ') addTroops(pp.troops, st.id, ok);
            else addTroops(pp.troops, 'ming_soldier', ok);
            S.morale = Math.max(0, S.morale - 2);
            toast(`${ok} 人归顺，${tries - ok} 人趁乱逃走。`);
            render();
          }, 'sm'),
          btn('释放', () => { removeTroops(pp.prisoners, st.id, st.n); S.honor += 1; render(); }, 'sm ghost'))));
    }
  };
  render();
  openPanel('部队', body, { wide: true });
}

// ---------- 行囊 ----------
export function openInventory() {
  const hero = S.hero;
  const pp = player();
  const body = h('div');
  const desc = (id: string | null) => {
    if (!id) return '（空）';
    const it = ITEMS[id];
    const s = it.slot === 'melee' ? `伤害${it.dmg} 距离${it.reach}` : it.slot === 'ranged' ? `伤害${it.dmg} 射程${it.range} 弹药${it.ammo}` : it.slot === 'horse' ? `速度${it.horseSpeed} 需骑术${horseRidingReq(id)}` : `护甲${it.armor}`;
    return `${it.name}（${s}）`;
  };
  const render = () => {
    body.innerHTML = '';
    const slots: Slot[] = ['melee', 'ranged', 'armor', 'helm', 'horse'];
    body.append(h('div', { class: 'cols' },
      h('div', null, h('h4', null, '装备'),
        ...slots.map(s => h('div', { class: 'trow' }, h('span', null, h('b', null, `${SLOT_LABEL[s]}　`), desc(hero.equip[s])),
          btn('卸下', () => { hero.inventory.push(hero.equip[s]!); hero.equip[s] = null; render(); }, 'sm ghost', !hero.equip[s]))),
        h('h4', null, `货物（${cargoCount(pp)}/${cargoLimit(S, pp)}）`),
        Object.keys(pp.goods).length ? h('div', null, ...Object.entries(pp.goods).map(([g, n]) => h('span', { class: 'chip' }, `${GOOD[g]?.name} ×${n}`))) : h('p', { class: 'dim' }, '没有货物。'),
      ),
      h('div', null, h('h4', null, `行囊（${hero.inventory.length}）`),
        hero.inventory.length ? hero.inventory.map((id, idx) => {
          const it = ITEMS[id];
          const req = it.slot === 'horse' ? horseRidingReq(id) : 0;
          return h('div', { class: 'trow' }, h('span', null, `${SLOT_LABEL[it.slot]}：${desc(id)}`),
            btn('装备', () => {
              const old = hero.equip[it.slot];
              hero.equip[it.slot] = id; hero.inventory.splice(idx, 1);
              if (old) hero.inventory.push(old);
              if (req > hero.skills.riding) toast(`骑术不足（需要 ${req}），战斗中无法骑乘`);
              render();
            }, 'sm'));
        }) : h('p', { class: 'dim' }, '行囊空空。可在城镇铁匠铺购买装备，或在战斗中缴获。')),
    ));
  };
  render();
  openPanel('行囊', body, { wide: true });
}

// ---------- 天下大势 ----------
export function openFactions() {
  const body = h('div');
  const side = playerSide();
  body.append(h('p', null, side === null ? '你目前不效忠任何势力。' : S.playerFaction ? `你是${FACTION[S.playerFaction].name}的封臣。` : S.mercOf ? `你正受雇于${FACTION[S.mercOf].name}（契约剩余 ${Math.max(0, Math.ceil((S.mercUntil - S.time) / 24))} 天）。` : `你自立为${S.ownFactionName}之主。`));
  const fs = [...MAJOR_FACTIONS.filter(f => S.alive[f]), ...(side === 'player' ? ['player'] : [])] as string[];
  const rows = fs.map(f => {
    const fd = FACTION[f];
    const sts = factionSettlements(f);
    const towns = sts.filter(s => s.kind === 'town').length, castles = sts.filter(s => s.kind === 'castle').length, vills = sts.filter(s => s.kind === 'village').length;
    const lords = Object.values(S.lords).filter(l => l.faction === f && !l.dead);
    const enemies = fs.filter(o => o !== f && atWar(f, o)).map(o => FACTION[o].name);
    const rel = f === 'player' ? '-' : String(S.playerRel[f] ?? 0);
    return h('tr', null,
      h('td', null, h('b', { style: { color: fd.css } }, f === 'player' ? S.ownFactionName : fd.name)),
      h('td', null, f === 'player' ? S.hero.name : `${fd.rulerTitle}${fd.ruler}`),
      h('td', { class: 'num' }, `${towns}/${castles}/${vills}`),
      h('td', { class: 'num' }, f === 'player' ? '-' : lords.length),
      h('td', null, enemies.join('、') || '无'),
      h('td', { class: 'num' }, rel, f !== 'player' && playerHostileTo(f) ? h('span', { class: 'bad' }, ' 敌对') : null),
    );
  });
  body.append(h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ...['势力', '君主', '城/堡/村', '领主', '交战', '与你关系'].map(x => h('th', null, x)))), h('tbody', null, rows)));
  // 领主名录
  const lordRows = Object.values(S.lords).filter(l => !l.dead).map(l => {
    const p = l.partyId ? S.parties.find(x => x.id === l.partyId) : null;
    const fiefs = fiefsOf(l.id).filter(s => s.kind !== 'village').map(s => s.name).join('、') || '无';
    return h('tr', null, h('td', null, h('span', { style: { color: FACTION[l.faction].css } }, FACTION[l.faction].name)), h('td', null, `${l.title}${l.name}`), h('td', null, fiefs), h('td', { class: 'num' }, p ? count(p.troops) : '败逃中'), h('td', { class: 'num' }, l.relation));
  });
  body.append(h('details', null, h('summary', null, '领主名录'), h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ...['势力', '领主', '封地', '兵力', '对你'].map(x => h('th', null, x)))), h('tbody', null, lordRows))));
  const mine = fiefsOf('player');
  body.append(h('h4', null, '你的封地'), mine.length ? h('div', null, ...mine.map(s => h('span', { class: 'chip' }, `${s.name}（${s.kind === 'town' ? '城' : s.kind === 'castle' ? '堡' : '村'}）`))) : h('p', { class: 'dim' }, '暂无封地。成为封臣或攻占城池即可获得封地。'));
  openPanel('天下大势', body, { wide: true });
  void FACTIONS; void lordName;
}

// ---------- 任务 ----------
export function openQuests() {
  const body = h('div');
  if (!S.quests.length) body.append(h('p', { class: 'dim' }, '没有进行中的任务。可以去城镇衙门或村长处接取差事。'));
  for (const q of S.quests) {
    body.append(h('div', { class: 'card' }, h('b', null, q.title), h('p', null, q.desc),
      h('p', { class: 'dim' }, `委托人：${q.giverName} · 剩余 ${Math.max(0, Math.ceil((q.deadline - S.time) / 24))} 天 · 报酬 ${q.reward} 两`)));
  }
  openPanel('任务', body);
}

// ---------- 日志 ----------
export function openLog() {
  const body = h('div', { class: 'logpanel' });
  for (const e of [...S.log].reverse().slice(0, 150)) body.append(h('div', { class: `logline ${e.cls ?? ''}` }, h('small', null, dateStr(e.t).replace(/ \S+时$/, '') + '　'), e.msg));
  openPanel('日志', body, { wide: true });
}

export function helpContent() {
  return h('div', { class: 'help' },
    h('h4', null, '基本操作'),
    h('ul', null,
      h('li', null, '左键点击地图：行军；点击城镇/村庄：前往并进入；点击部队：追击/接触。'),
      h('li', null, '拖动地图或 WASD/方向键：平移视角；滚轮：缩放；H：回到自己的位置。'),
      h('li', null, '空格：扎营等待（时间流逝）/ 停止。1/2/3：游戏速度。'),
      h('li', null, 'C 角色　P 部队　I 行囊　F 天下大势　Q 任务　L 日志　Esc 菜单/关闭。'),
    ),
    h('h4', null, '战斗操作'),
    h('ul', null,
      h('li', null, 'WASD 移动，鼠标瞄准，左键攻击（近战挥砍 / 远程射击），Q 切换近战/远程。'),
      h('li', null, '1 全军、2 步兵、3 远程、4 骑兵 选择编组；Z 冲锋、X 原地坚守、C 跟随我。'),
      h('li', null, '骑马高速冲撞可造成巨额伤害；长枪兵克制骑兵；鸟铳威力大但装填慢；士气崩溃的部队会溃逃。'),
    ),
    h('h4', null, '发展之路'),
    h('ul', null,
      h('li', null, '起步：到村庄招募乡勇，剿灭附近的山贼积累经验、银两与声望。'),
      h('li', null, '赚钱：低买高卖贩运货物（特产便宜、紧缺货贵）、贩卖俘虏、做衙门的差事。'),
      h('li', null, '壮大：兵员积累经验后在部队界面花钱晋升；去酒馆招揽身怀绝技的同伴。'),
      h('li', null, '声望 30 可以签订雇佣兵契约；声望 120 可以在都城向君主宣誓效忠，获得封地。'),
      h('li', null, '攻城：在敌方城池选择围攻，打造云梯后攻城；攻下的城池归你所有，可派兵驻守。'),
      h('li', null, '最终目标：助你的势力（或你自立的势力）夺取天下所有城镇，一统天下！'),
    ),
  );
}
export { replaceTop, closeTop, healthy };
