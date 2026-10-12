// 大地图上进行中的实时战斗：标记点击后的加入面板
import { h, openPanel, closeAll, btn, toast } from './dom';
import { NET } from '../net/client';
import { NETH } from '../net/hooks';
import { FACTION } from '../data/world';
import { player } from '../core/game';
import { setPlayerTarget } from '../core/sim';
import type { BattleMark } from '../net/protocol';

const JOIN_RANGE = 90;

export function battleAt(x: number, y: number, r: number): BattleMark | null {
  let best: BattleMark | null = null, bd = r;
  for (const b of NET.battles) { const d = Math.hypot(b.x - x, b.y - 8 - y); if (d < bd) { bd = d; best = b; } }
  return best;
}

export function openBattleJoin(b: BattleMark) {
  const pp = player();
  const d = Math.hypot(pp.x - b.x, pp.y - b.y);
  const fname = (f: string) => FACTION[f]?.name ?? (f === 'bandit' ? '盗匪' : f);
  const side = (s: 0 | 1) => h('div', null,
    h('b', null, b.names[s]), h('p', { class: 'dim' }, `${fname(b.f[s])} · 场上约 ${b.n[s]} 人`),
    btn(`助${b.names[s].split('、')[0]}一臂之力`, async () => {
      const r = await NETH.req('bjoin', { bid: b.bid, side: s });
      if (!r.ok) { toast(r.err ?? '无法加入'); return; }
      closeAll(); toast('率部杀入战场！');
    }, 'primary', d > JOIN_RANGE, d > JOIN_RANGE ? '离战场太远' : undefined));
  openPanel('⚔ 战场', h('div', { class: 'mp-battle-pop' },
    h('p', { class: 'flavor' }, '烟尘蔽日，杀声震天——两军正在此地鏖战。你可以率部加入任意一方（需与另一方为敌）。'),
    h('div', { class: 'bjoin-sides' }, side(0), side(1)),
    d > JOIN_RANGE ? h('p', { class: 'warn' }, `你距战场约 ${Math.round(d)} 里，需靠近到 ${JOIN_RANGE} 里以内才能加入。`) : null,
    h('div', { class: 'row end' },
      d > JOIN_RANGE ? btn('前往战场', () => { closeAll(); setPlayerTarget({ kind: 'point', x: b.x - 30, y: b.y }); }, 'primary') : null,
      btn('离开', () => closeAll())),
  ));
}
