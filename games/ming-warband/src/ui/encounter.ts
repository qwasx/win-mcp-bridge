// 遭遇、战斗启动与战报
import { weatherAt, snowCover, seasonOf } from '../core/weather';
import { sfx } from '../audio/sfx';
import { h, openPanel, closeTop, closeAll, btn, toast } from './dom';
import type { Party, Settlement, Stack } from '../core/state';
import { S, player, hostile, lordName, changePlayerRel, removeParty, log, isNight, emit, playerSide, atWar } from '../core/game';
import { FACTION } from '../data/world';
import { TROOPS, classLabel } from '../data/troops';
import { count, healthy, partyStrength, removeTroops, describeSize } from '../core/party';
import { playerAutoBattle, applyPlayerBattle, type Outcome, type BattleReport, type WarCtx } from '../core/combat';
import { canRecruitLord, recruitLord, friendlyNear, hostileNear, lordsInside, partyLabel, mergeStacks, splitDown, armyOf, aiArmyBattle, armySiegeAssault, type Part } from '../core/war';
import type { SiegeKit } from '../scenes/battle/siege';
import { terAtXY, Ter } from '../core/terrain';
import { ref } from '../gameRef';
import type { BattleSetup, SideParty } from '../scenes/BattleScene';
import { GOOD } from '../data/items';
import { chance } from '../core/rng';
import { nav } from '../core/sim';

function troopSummary(stacks: Stack[]) {
  const byCls: Record<string, number> = {};
  for (const s of stacks) { const t = TROOPS[s.id]; if (!t) continue; const k = classLabel(t.cls); byCls[k] = (byCls[k] || 0) + s.n - s.w; }
  return Object.entries(byCls).map(([k, v]) => `${k}${v}`).join('　');
}

export function openEncounter(p: Party, forced: boolean) {
  closeAll();
  const pp = player();
  const isHostile = hostile(pp, p);
  if (isHostile) { sfx('drumRoll', { vol: 0.55 }); if (forced) sfx('horn', { vol: 0.4, delay: 0.6 }); }
  const f = FACTION[p.faction];
  const n = count(p.troops);
  const sides = isHostile || forced ? battleSides(p, null) : { allies: [] as Party[], extras: [] as Party[] };
  const ratio = (partyStrength(S, p) + sides.extras.reduce((a, e) => a + partyStrength(S, e), 0)) / Math.max(1, partyStrength(S, pp) + sides.allies.reduce((a, e) => a + partyStrength(S, e), 0));
  const assess = ratio > 1.8 ? '敌众我寡，形势极为不利。' : ratio > 1.15 ? '对方似乎略强于我军。' : ratio > 0.7 ? '双方势均力敌。' : '对方明显弱于我军。';
  const lord = p.lordId ? S.lords[p.lordId] : null;
  let intro = '';
  if (p.kind === 'bandit') intro = forced ? `一伙${p.name}从路旁杀出，拦住了你的去路！“此山是我开……留下买路财！”` : `你追上了一伙${p.name}。`;
  else if (p.kind === 'lord') intro = isHostile ? `${f.name}的${lord!.title}${lord!.name}${forced ? '率军向你杀来！' : '的军队就在眼前。'}` : `你遇到了${f.name}的${lord!.title}${lord!.name}。`;
  else if (p.kind === 'caravan') intro = `一支${p.name}正在赶路，护卫们警惕地看着你。`;
  else intro = `一群${p.name}正赶着牲口去集市。`;

  const menu = h('div', { class: 'menu' });
  const add = (label: string, fn: () => void, cls = '', disabled = false, title = '') => menu.appendChild(btn(label, fn, `menu-item ${cls}`, disabled, title));
  const canFight = healthy(pp.troops) > 0 || S.hero.hp >= 0.25;
  const heroOk = S.hero.hp >= 0.25;

  const attack = (manual: boolean) => {
    if (!isHostile && p.faction !== 'bandit') {
      changePlayerRel(p.faction, p.kind === 'lord' ? -25 : -15);
      if (p.lordId) S.lords[p.lordId].relation -= 15;
    }
    closeAll();
    startBattle(p, null, manual);
  };

  if (isHostile || forced) {
    add(heroOk ? '⚔ 亲自上阵' : '⚔ 指挥作战（你伤势过重，坐镇后方）', () => attack(true), 'danger', !canFight);
    add('🎲 自动结算', () => attack(false), '', !canFight);
    if (forced) {
      const loss = Math.ceil(count(pp.troops) * 0.2);
      add(`🏃 突围（约损失 ${loss} 名部下断后）`, () => {
        let left = loss;
        for (const s of [...pp.troops].sort((a, b) => TROOPS[a.id].tier - TROOPS[b.id].tier)) { if (left <= 0) break; left -= removeTroops(pp.troops, s.id, left); }
        p.ai.mode = 'idle'; p.ai.path = []; p.ai.nextThink = S.time + 3;
        S.morale = Math.max(0, S.morale - 5);
        nav.graceUntil = S.time + 3;
        log(`你留下 ${loss} 人断后，侥幸突围。`, 'bad');
        closeAll();
      }, '', count(pp.troops) === 0 && false);
      if (p.kind === 'bandit' && pp.gold > 0) {
        const pay = Math.round(pp.gold * 0.25) + 10;
        add(`💰 交出买路钱（${Math.min(pay, pp.gold)} 两）`, () => {
          pp.gold = Math.max(0, pp.gold - pay); p.gold += pay;
          p.ai.mode = 'idle'; p.ai.path = []; p.ai.nextThink = S.time + 4;
          nav.graceUntil = S.time + 4;
          log('你交出了买路钱，山贼们哄笑着让开了路。', 'dim'); S.honor -= 1; closeAll();
        });
      }
    } else add('离开', () => closeAll());
  } else {
    if (p.kind === 'lord') add('💬 交谈', () => talkLord(p));
    if (p.kind === 'caravan' || p.kind === 'villager') add('💬 询问消息', () => {
      const goods = Object.keys(p.goods).map(g => GOOD[g]?.name).filter(Boolean).join('、') || '一些杂货';
      openPanel('交谈', h('div', null, h('p', null, `领头的说：“我们${p.kind === 'caravan' ? '运着' : '带着'}${goods}，${p.ai.target && S.settlements[p.ai.target as string] ? `要去${S.settlements[p.ai.target as string].name}` : '正在赶路'}。这年头，路上不太平啊。”`), btn('好', () => closeTop())));
    });
    add(p.kind === 'lord' ? '⚔ 攻击（将与其势力为敌）' : '⚔ 劫掠（将损害关系与荣誉）', () => attack(true), 'danger', !canFight);
    add('离开', () => closeAll());
  }

  openPanel(forced ? '遭遇敌袭！' : '遭遇', h('div', null,
    h('div', { class: 'enc-head' },
      h('div', { class: 'st-flag', style: { background: p.kind === 'bandit' ? '#333' : f.css } }, p.kind === 'bandit' ? '匪' : f.name[0]),
      h('div', null, h('div', { class: 'st-name' }, lord ? `${lord.name}` : p.name), h('div', { class: 'st-sub' }, `${f.name} · ${describeSize(n)} ${n} 人`), h('div', { class: 'st-sub' }, troopSummary(p.troops))),
    ),
    h('p', { class: 'flavor' }, intro),
    h('p', { class: ratio > 1.15 ? 'bad' : ratio < 0.7 ? 'good' : 'warn' }, assess, ` 我军可战 ${healthy(pp.troops)} 人。`),
    sides.allies.length ? h('p', { class: 'good' }, `友军助战：${sides.allies.map(a => `${partyLabel(a)}（${healthy(a.troops)}人）`).join('、')}`) : null,
    sides.extras.length ? h('p', { class: 'bad' }, `敌军援兵：${sides.extras.map(a => `${partyLabel(a)}（${healthy(a.troops)}人）`).join('、')}`) : null,
    menu,
  ), { noClose: forced });
}

function talkLord(p: Party) {
  const l = S.lords[p.lordId!];
  const f = FACTION[l.faction];
  const mood = l.relation > 10 ? '热情地招呼你' : l.relation < -5 ? '冷淡地瞥了你一眼' : '向你点头致意';
  const doing = p.ai.mode === 'siege' ? `正要去攻打${S.settlements[p.ai.target as string]?.name ?? '敌城'}` : p.ai.mode === 'raid' ? '正在扫荡敌境' : p.ai.mode === 'recruit' ? '正回去整补兵员' : p.ai.mode === 'chase' ? '正在追击敌军' : '正在巡视防区';
  const enemies = S.wars.filter(k => k.includes(l.faction)).map(k => k.split('|').find(x => x !== l.faction)!).filter(x => FACTION[x]).map(x => FACTION[x].name);
  const side = playerSide();
  const sameSide = side === l.faction;
  openPanel(`${l.title}${l.name}`, h('div', null,
    h('p', { class: 'flavor' }, `${l.name}${mood}。“我${doing}。${enemies.length ? `${enemies.join('、')}与我${f.name}为敌，` : ''}${sameSide ? '同袍之谊，望你多多出力。' : S.renown > 100 ? `${S.hero.name}，你的名声我也听说过。` : '这乱世，各自珍重吧。'}”`),
    h('p', { class: 'dim' }, `${l.name}对你的看法：${l.relation} · 性格：${({ brave: '勇猛', cautious: '谨慎', greedy: '贪婪', honorable: '正直' } as Record<string, string>)[l.trait]}`),
    (() => {
      const mine = p.ai.mode === 'follow' && p.ai.target === player().id;
      if (mine) return h('div', { class: 'menu' },
        btn(`随军中（还剩 ${Math.max(0, Math.ceil(((p.ai.until ?? S.time) - S.time) / 24))} 天）· 请其离队`, () => { p.ai.mode = 'idle'; p.ai.target = undefined; p.ai.path = []; log(`${partyLabel(p)}离开了你的军团。`, 'dim'); closeAll(); }, 'menu-item'));
      const c = canRecruitLord(p);
      if (!p.lordId || !sameSide) return null;
      return h('div', { class: 'menu' },
        btn('🚩 “请将军随我出征。”（合兵 6 天）', () => { recruitLord(p, 6); closeAll(); toast(`${l.name}的兵马加入了你的军团`); }, 'menu-item', !c.ok, c.why));
    })(),
    btn('告辞', () => { closeAll(); }),
  ));
}

// ---------- 战斗 ----------
export interface BattleOpts { defendOf?: Settlement | null; kit?: SiegeKit; extraAllies?: Party[] }

/** 战斗双方的全部参战部队 */
export function battleSides(enemy: Party | null, siege: Settlement | null, opt: BattleOpts = {}) {
  const allies = [...new Set([...(opt.extraAllies ?? []), ...friendlyNear(enemy)])].filter(p => p !== enemy);
  const extras = enemy ? hostileNear(enemy).filter(p => !allies.includes(p)) : siege ? lordsInside(siege) : [];
  if (opt.defendOf) for (const l of lordsInside(opt.defendOf)) if (!allies.includes(l)) allies.push(l);
  return { allies, extras };
}

export function startBattle(enemy: Party | null, siege: Settlement | null, manual: boolean, opt: BattleOpts = {}) {
  const pp = player();
  const defendOf = opt.defendOf ?? null;
  const { allies, extras } = battleSides(enemy, siege, opt);
  const enemyStacks = enemy ? enemy.troops : siege!.garrison;
  const enemyName = enemy ? (enemy.lordId ? `${S.lords[enemy.lordId].name}部` : enemy.name) : `${siege!.name}守军`;
  const enemyFaction = enemy ? enemy.faction : siege!.faction;
  const mainPid = enemy ? String(enemy.id) : 'g';
  const eParts: SideParty[] = [{ pid: mainPid, name: enemyName, stacks: enemyStacks }, ...extras.map(e => ({ pid: String(e.id), name: partyLabel(e), stacks: e.troops }))];
  const aParts: SideParty[] = [...allies.map(a => ({ pid: String(a.id), name: partyLabel(a), stacks: a.troops })), ...(defendOf ? [{ pid: 'g', name: `${defendOf.name}守军`, stacks: defendOf.garrison }] : [])];
  const ctx: WarCtx = { extraEnemies: extras, allies, defendOf };
  if (eParts.every(p => healthy(p.stacks) <= 0)) {
    const out: Outcome = { win: true, ourDown: {}, enemyDown: {}, heroDown: false, compDown: [] };
    return finishBattle(enemy, siege, out, ctx);
  }
  const kit: SiegeKit = opt.kit ?? { ladders: 3, ram: false, cannons: 0, mine: false };
  const fortK = (st: Settlement) => (st.kind === 'town' ? 1.5 : 1.7) + (st.isPass ? 0.15 : 0);
  if (!manual) {
    // 自动结算：合并各部
    let eMult = 1, oMult = 1;
    if (siege) eMult = Math.max(1.12, fortK(siege) - (kit.ram ? 0.12 : 0) - kit.cannons * 0.06 - (kit.mine ? 0.18 : 0) - Math.max(0, kit.ladders - 3) * 0.03);
    if (defendOf) oMult = fortK(defendOf);
    const ourParts: Part[] = [{ pid: 'p', stacks: pp.troops }, ...aParts];
    const enemyLords = eParts.length - 1 + (enemy?.kind === 'lord' || siege ? 1 : 0);
    const out = playerAutoBattle(mergeStacks(eParts), eMult, enemyLords * 8, mergeStacks(ourParts), oMult, allies.length * 8);
    const so = splitDown(out.ourDown, ourParts), se = splitDown(out.enemyDown, eParts);
    out.downBy = { ...so, ...se };
    out.ourDown = so.p ?? {};
    return finishBattle(enemy, siege, out, ctx);
  }
  const game = ref.game!;
  const at = defendOf ?? siege ?? pp;
  let ter = terAtXY(at.x, at.y);
  if (ter === Ter.Sea || ter === Ter.Plateau) ter = Ter.Plain;
  const copy = (ps: SideParty[]) => ps.map(p => ({ ...p, stacks: p.stacks.map(s => ({ ...s })) }));
  const fort = siege ?? defendOf;
  const setup: BattleSetup = {
    ours: pp.troops.map(s => ({ ...s })), theirs: enemyStacks.map(s => ({ ...s })), enemyName: eParts.length > 1 ? `${enemyName}等${eParts.length}部` : enemyName, enemyFaction,
    terrain: ter, siege: !!fort, defend: !!defendOf, town: fort ? fort.kind === 'town' : undefined,
    kit: siege ? kit : defendOf ? aiKit(enemy, defendOf) : undefined,
    defGuns: fort ? (fort.kind === 'town' ? 2 : 1) + (fort.isPass ? 1 : 0) : undefined,
    night: isNight(), heroFights: S.hero.hp >= 0.25,
    weather: weatherAt(at.x, at.y, S.time), snow: snowCover(at.x, at.y, S.time), season: seasonOf(S.time),
    allies: aParts.length ? copy(aParts) : undefined, enemyParts: copy(eParts), enemyPid: mainPid,
    onEnd: out => finishBattle(enemy, siege, out, ctx),
  };
  game.scene.sleep('World');
  game.scene.start('Battle', setup);
}

/** AI 攻城方的器械：视兵力与势力而定 */
function aiKit(enemy: Party | null, st: Settlement): SiegeKit {
  const n = enemy ? healthy(enemy.troops) : 60;
  const gunFaction = enemy && (enemy.faction === 'jin' || enemy.faction === 'ming');
  return { ladders: Math.min(6, 2 + Math.floor(n / 50)), ram: n > 50, cannons: gunFaction && S.time > 24 * 90 ? Math.min(3, Math.floor(n / 80)) : 0, mine: n > 120 && st.kind === 'town' && chance(0.5) };
}

function finishBattle(enemy: Party | null, siege: Settlement | null, out: Outcome, ctx: WarCtx = {}) {
  const rep = applyPlayerBattle(enemy, siege, out, ctx);
  nav.graceUntil = S.time + 3;
  if (enemy && S.parties.includes(enemy)) { enemy.ai.mode = 'idle'; enemy.ai.path = []; enemy.ai.nextThink = S.time + 3; }
  for (const e of ctx.extraEnemies ?? []) if (S.parties.includes(e)) { e.ai.mode = 'idle'; e.ai.path = []; e.ai.nextThink = S.time + 3; }
  if (siege && !out.win) siege.siege = null;
  if (ctx.defendOf) { S.pendingDefense = null; if (out.win || out.retreat) ctx.defendOf.siege = out.win ? null : ctx.defendOf.siege; }
  emit('ownerChanged');
  showReport(rep);
  if (!out.win && !out.retreat) {
    const pp = player();
    pp.ai.path = [];
  }
  void toast; void removeParty; void lordName; void atWar; void chance;
}

// ---------- 助战与守城 ----------
export function openJoinBattle(friend: Party, foe: Party) {
  closeAll();
  sfx('drumRoll', { vol: 0.5 });
  const fn = partyLabel(friend), en = partyLabel(foe);
  openPanel('前方激战', h('div', null,
    h('p', { class: 'flavor' }, `前方烟尘大起——${fn}（${healthy(friend.troops)}人）正与${en}（${healthy(foe.troops)}人）鏖战！`),
    h('p', { class: 'dim' }, '你可以率部杀入战团，与友军并肩作战。'),
    h('div', { class: 'menu' },
      btn(S.hero.hp >= 0.25 ? '⚔ 杀入战团（亲自上阵）' : '⚔ 杀入战团（坐镇指挥）', () => { closeAll(); startBattle(foe, null, true, { extraAllies: [friend] }); }, 'menu-item danger'),
      btn('🎲 助战（自动结算）', () => { closeAll(); startBattle(foe, null, false, { extraAllies: [friend] }); }, 'menu-item'),
      btn('袖手旁观', () => { closeAll(); nav.graceUntil = S.time + 2; aiArmyBattle(friend, foe); emit('ownerChanged'); }, 'menu-item'),
    )), { noClose: true });
}

export function openDefendPrompt(st: Settlement, foe: Party) {
  closeAll();
  sfx('horn', { vol: 0.5 }); sfx('drumRoll', { vol: 0.5, delay: 0.4 });
  const army = armyOf(foe, 60);
  const n = army.reduce((a, p) => a + healthy(p.troops), 0);
  const inside = lordsInside(st);
  const def = healthy(st.garrison) + inside.reduce((a, p) => a + healthy(p.troops), 0);
  const fn = army.length > 1 ? `${partyLabel(foe)}等${army.length}路大军` : partyLabel(foe);
  const giveUp = () => { S.pendingDefense = null; closeAll(); armySiegeAssault(foe, st); emit('ownerChanged'); };
  openPanel(`${st.name}告急`, h('div', null,
    h('p', { class: 'flavor' }, `城外号角连营——${fn}共 ${n} 人竖起云梯，向${st.name}发起总攻！`),
    h('p', { class: 'warn' }, `城中守军 ${def} 人${inside.length ? `（含${inside.map(p => partyLabel(p)).join('、')}）` : ''}，你部可战 ${healthy(player().troops)} 人。`),
    h('div', { class: 'menu' },
      btn(S.hero.hp >= 0.25 ? '🏯 登城死守（亲自上阵）' : '🏯 登城死守（坐镇指挥）', () => { closeAll(); startBattle(foe, null, true, { defendOf: st, extraAllies: army.length > 1 ? [] : [] }); }, 'menu-item danger'),
      btn('🎲 协助守城（自动结算）', () => { closeAll(); startBattle(foe, null, false, { defendOf: st }); }, 'menu-item'),
      btn('弃城而走（守军独自应战）', giveUp, 'menu-item'),
    )), { noClose: true });
}

export function showReport(rep: BattleReport) {
  closeAll();
  openPanel(rep.title, h('div', { class: `report ${rep.win ? 'win' : 'lose'}` },
    h('div', { class: 'report-title' }, rep.title),
    ...rep.lines.map(l => h('p', null, l)),
    rep.loot.length ? h('div', { class: 'card' }, h('b', null, '战利品'), h('p', null, rep.loot.join('、'))) : null,
    rep.captured ? h('p', { class: 'gold' }, `${rep.captured.name}已归你所有。你可以进入据点管理守军。`) : null,
    h('div', { class: 'row end' }, btn('确定', () => closeAll(), 'primary')),
  ));
}
