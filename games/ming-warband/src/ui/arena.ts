// 武举校场：五轮比武，可押注，夺魁者为武状元
import { h, openPanel, closeTop, closeAll, btn, toast } from './dom';
import { S, player, log, changePlayerRel, playerSide, isNight } from '../core/game';
import { TROOPS } from '../data/troops';
import { Ter } from '../core/terrain';
import { ref } from '../gameRef';
import { sfx } from '../audio/sfx';
import type { BattleSetup } from '../scenes/BattleScene';
import type { Settlement, Stack } from '../core/state';
import { pick } from '../core/rng';

const ROUNDS = [
  { n: 1, tier: [2, 2], name: '初试 · 单挑', prize: 40 },
  { n: 2, tier: [2, 3], name: '复试 · 以一敌二', prize: 80 },
  { n: 3, tier: [3, 3], name: '会试 · 以一敌三', prize: 150 },
  { n: 4, tier: [3, 4], name: '殿试 · 四面受敌', prize: 260 },
  { n: 5, tier: [4, 5], name: '夺魁 · 群雄逐鹿', prize: 500 },
];
let round = 0; // 当前进行到第几轮（0 = 尚未开始）
let bet = 0;
let atTown = '';

function opponents(r: number): Stack[] {
  const R = ROUNDS[r];
  const pool = Object.values(TROOPS).filter(t => t.tier >= R.tier[0] && t.tier <= R.tier[1] && t.culture !== 'bandit' as any);
  const out: Stack[] = [];
  for (let i = 0; i < R.n; i++) {
    let t = pick(pool);
    if (r < 3) for (let k = 0; k < 6 && (t.cls === 'cav' || t.cls === 'hca'); k++) t = pick(pool); // 前几轮不出骑兵
    const ex = out.find(s => s.id === t.id); if (ex) ex.n++; else out.push({ id: t.id, n: 1, w: 0, xp: 0 } as Stack);
  }
  return out;
}

export function openArena(st: Settlement) {
  if (atTown !== st.id) { round = 0; bet = 0; atTown = st.id; }
  const pp = player();
  const R = ROUNDS[round];
  const body = h('div', { class: 'arena' });
  body.append(
    h('p', { class: 'flavor' }, `${st.name}校场上旌旗猎猎，兵部主事端坐看台。各地武生披挂上阵，以木刀钝枪较量——刀枪无眼，但不致伤命。`),
    h('div', { class: 'card' },
      h('div', null, '🏆 历来最好成绩：', h('b', null, S.arenaBest ? `第 ${S.arenaBest} 轮${S.arenaBest >= 5 ? '（武状元）' : ''}` : '尚无')),
      h('div', null, `当前：`, h('b', null, round === 0 ? '尚未报名' : `已过 ${round} 轮`)),
    ),
  );
  if (round >= ROUNDS.length) {
    body.append(h('p', { class: 'good' }, '你已夺得本届武举魁首！'), btn('离开', () => { round = 0; closeTop(); }, 'primary'));
    openPanel(`${st.name} · 武举校场`, body); return;
  }
  const bets = [0, 50, 100, 300].filter(b => b <= pp.gold);
  body.append(
    h('h4', null, `第 ${round + 1} 轮：${R.name}`),
    h('p', null, `对手：${R.n} 名武生（${R.tier[0] === R.tier[1] ? R.tier[0] : R.tier.join('~')} 阶）。胜者赏银 ${R.prize} 两、声望 +${round + 1}。`),
    h('div', { class: 'row' }, h('span', null, '押注：'), ...bets.map(b => btn(b ? `${b} 两` : '不押', () => { bet = b; openArenaRefresh(st); }, `sm ${bet === b ? 'primary' : ''}`))),
    h('p', { class: 'dim' }, bet ? `押 ${bet} 两，赢则得 ${Math.round(bet * (1.5 + round * 0.5))} 两。` : '押注越到后面赔率越高。'),
    h('div', { class: 'row' },
      btn('⚔ 上场比武', () => fight(st), 'primary', S.hero.hp < 0.5, S.hero.hp < 0.5 ? '你伤势未愈，需休养至五成以上' : ''),
      btn(round ? '见好就收（领赏离开）' : '离开', () => { round = 0; closeTop(); }),
    ),
  );
  openPanel(`${st.name} · 武举校场`, body);
}
function openArenaRefresh(st: Settlement) { closeTop(); openArena(st); }

function fight(st: Settlement) {
  const pp = player();
  if (bet > pp.gold) bet = 0;
  pp.gold -= bet;
  const hpBefore = S.hero.hp;
  const r = round;
  const setup: BattleSetup = {
    ours: [], theirs: opponents(r), enemyName: `${ROUNDS[r].n}名武生`, enemyFaction: 'none',
    terrain: Ter.Plain, siege: false, night: false, heroFights: true, arena: true,
    onEnd: out => {
      S.hero.hp = Math.max(hpBefore * 0.85, S.hero.hp, 0.3); // 钝器比武，伤势不重
      if (out.win) {
        const win = ROUNDS[r].prize + (bet ? Math.round(bet * (1.5 + r * 0.5)) : 0);
        pp.gold += win; S.renown += r + 1;
        round = r + 1;
        S.arenaBest = Math.max(S.arenaBest ?? 0, round);
        log(`武举第 ${round} 轮获胜！得赏银 ${win} 两。`, 'good');
        if (round >= ROUNDS.length) {
          S.renown += 25;
          if (!S.flags?.zhuangyuan) { (S.flags ||= {}).zhuangyuan = true; S.hero.attrs && (S.hero.attrs.str = (S.hero.attrs.str ?? 0) + 1); }
          if (playerSide() === 'ming' || !playerSide()) changePlayerRel('ming', 5);
          log(`你在${st.name}武举中力压群雄，被钦点为“武状元”！声望大振。`, 'gold');
          sfx('gong');
        }
      } else {
        log(`你在武举第 ${r + 1} 轮落败${bet ? `，押注的 ${bet} 两打了水漂` : ''}。`, 'bad');
        round = 0;
      }
      bet = 0;
      setTimeout(() => { closeAll(); if (round > 0 || out.win) openArena(st); else openArena(st); }, 60);
    },
  };
  void isNight;
  closeAll();
  const game = ref.game!;
  game.scene.sleep('World');
  game.scene.start('Battle', setup);
  toast(`第 ${r + 1} 轮开始！`);
}
