// 遭遇、战斗启动与战报
import { h, openPanel, closeTop, closeAll, btn, toast } from './dom';
import type { Party, Settlement, Stack } from '../core/state';
import { S, player, hostile, lordName, changePlayerRel, removeParty, log, isNight, emit, playerSide, atWar } from '../core/game';
import { FACTION } from '../data/world';
import { TROOPS, classLabel } from '../data/troops';
import { count, healthy, partyStrength, removeTroops, describeSize } from '../core/party';
import { playerAutoBattle, applyPlayerBattle, type Outcome, type BattleReport } from '../core/combat';
import { terAtXY, Ter } from '../core/terrain';
import { ref } from '../gameRef';
import type { BattleSetup } from '../scenes/BattleScene';
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
  const f = FACTION[p.faction];
  const n = count(p.troops);
  const ratio = partyStrength(S, p) / Math.max(1, partyStrength(S, pp));
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
    btn('告辞', () => { closeAll(); }),
  ));
}

// ---------- 战斗 ----------
export function startBattle(enemy: Party | null, siege: Settlement | null, manual: boolean) {
  const pp = player();
  const enemyStacks = enemy ? enemy.troops : siege!.garrison;
  const enemyName = enemy ? (enemy.lordId ? `${S.lords[enemy.lordId].name}部` : enemy.name) : `${siege!.name}守军`;
  const enemyFaction = enemy ? enemy.faction : siege!.faction;
  if (healthy(enemyStacks) <= 0) {
    // 无人防守
    const out: Outcome = { win: true, ourDown: {}, enemyDown: {}, heroDown: false, compDown: [] };
    return finishBattle(enemy, siege, out);
  }
  if (!manual) {
    const out = playerAutoBattle(enemyStacks, siege ? (siege.kind === 'town' ? 1.5 : 1.7) : 1, siege ? 8 : enemy?.kind === 'lord' ? 8 : 0);
    return finishBattle(enemy, siege, out);
  }
  const game = ref.game!;
  let ter = terAtXY(pp.x, pp.y);
  if (ter === Ter.Sea || ter === Ter.Plateau) ter = Ter.Plain;
  const setup: BattleSetup = {
    ours: pp.troops.map(s => ({ ...s })), theirs: enemyStacks.map(s => ({ ...s })), enemyName, enemyFaction,
    terrain: ter, siege: !!siege, night: isNight(), heroFights: S.hero.hp >= 0.25,
    onEnd: out => finishBattle(enemy, siege, out),
  };
  game.scene.sleep('World');
  game.scene.start('Battle', setup);
}

function finishBattle(enemy: Party | null, siege: Settlement | null, out: Outcome) {
  const rep = applyPlayerBattle(enemy, siege, out);
  nav.graceUntil = S.time + 3;
  if (enemy && S.parties.includes(enemy)) { enemy.ai.mode = 'idle'; enemy.ai.path = []; enemy.ai.nextThink = S.time + 3; }
  if (siege && !out.win) siege.siege = null;
  emit('ownerChanged');
  showReport(rep);
  if (!out.win && !out.retreat) {
    // 被俘后从最近友方城镇附近出现
    const pp = player();
    pp.ai.path = [];
  }
  void toast; void removeParty; void lordName; void atWar; void chance;
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
