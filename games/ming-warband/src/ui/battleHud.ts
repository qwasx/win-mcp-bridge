// 战斗界面
import { h } from './dom';
import type { BattleScene } from '../scenes/BattleScene';

class BattleHud {
  root: HTMLElement | null = null;
  scene: BattleScene | null = null;
  pointerOverUi = false;
  last = 0;
  els: Record<string, HTMLElement> = {};

  open(scene: BattleScene) {
    this.close();
    this.scene = scene;
    const E = this.els = {} as Record<string, HTMLElement>;
    const groupBtn = (g: string, label: string, key: string) => h('button', { class: 'bbtn', 'data-g': g, onclick: () => scene.select(g as any) }, h('kbd', null, key), label, E[`o_${g}`] = h('small', null, ''));
    const orderBtn = (o: string, label: string, key: string) => h('button', { class: 'bbtn', onclick: () => scene.order(o as any) }, h('kbd', null, key), label);
    this.root = h('div', { id: 'battle-hud' },
      h('div', { class: 'b-top' },
        h('div', { class: 'b-side ours' }, h('b', null, '我军'), E.ourN = h('span', null, ''), E.ourM = h('div', { class: 'mbar' }, h('i'))),
        h('div', { class: 'b-vs' }, '对阵'),
        h('div', { class: 'b-side theirs' }, h('b', null, scene.setup.enemyName), E.theirN = h('span', null, ''), E.theirM = h('div', { class: 'mbar' }, h('i'))),
      ),
      E.msgs = h('div', { class: 'b-msgs' }),
      h('div', { class: 'b-bottom ui-hit' },
        h('div', { class: 'b-hero' }, E.hp = h('div', { class: 'hpbar' }, h('i'), h('span', null, '')), E.weapon = h('div', { class: 'b-weapon' }, '')),
        h('div', { class: 'b-cmd' },
          h('div', { class: 'row' }, groupBtn('all', '全军', '1'), groupBtn('inf', '步兵', '2'), groupBtn('rng', '远程', '3'), groupBtn('cav', '骑兵', '4')),
          h('div', { class: 'row' }, orderBtn('charge', '冲锋', 'Z'), orderBtn('hold', '坚守', 'X'), orderBtn('follow', '跟随', 'C'), h('button', { class: 'bbtn', onclick: () => scene.toggleWeapon() }, h('kbd', null, 'Q'), '换武器')),
        ),
        h('div', { class: 'b-actions' },
          h('button', { class: 'btn', onclick: () => scene.autoFinish(), title: '用自动结算完成剩下的战斗' }, '自动结算'),
          h('button', { class: 'btn danger', onclick: () => scene.retreat(), title: '撤出战场（会损失部分部下）' }, '撤退'),
        ),
      ),
    );
    this.root.querySelectorAll('.ui-hit').forEach(el => {
      el.addEventListener('mouseenter', () => this.pointerOverUi = true);
      el.addEventListener('mouseleave', () => this.pointerOverUi = false);
    });
    document.getElementById('ui')!.appendChild(this.root);
    this.refresh();
  }

  refresh() {
    const s = this.scene; if (!s || !this.root) return;
    this.root.querySelectorAll<HTMLElement>('[data-g]').forEach(b => b.classList.toggle('sel', b.dataset.g === s.selected));
    const on: Record<string, string> = { hold: '坚守', follow: '跟随', charge: '冲锋' };
    for (const g of ['inf', 'rng', 'cav']) this.els[`o_${g}`].textContent = on[s.orders[g as 'inf']];
    this.els.o_all.textContent = '';
    const hero = s.hero;
    if (!hero) this.els.weapon.textContent = '你没有亲自上阵';
    else if (hero.dead) this.els.weapon.textContent = '你已倒下 —— 可用 WASD 移动视角';
    else this.els.weapon.textContent = s.heroMode === 'ranged' ? `远程（剩余 ${hero.ammo}）` : `近战${hero.mounted ? ' · 骑乘' : ''}${hero.rng ? `（远程 ${hero.ammo}）` : ''}`;
  }

  tick() {
    const now = performance.now();
    if (now - this.last < 150 || !this.scene) return;
    this.last = now;
    const s = this.scene;
    this.els.ourN.textContent = ` ${s.activeCount(0)} 人`;
    this.els.theirN.textContent = ` ${s.activeCount(1)} 人`;
    (this.els.ourM.firstChild as HTMLElement).style.width = `${Math.max(0, Math.min(100, s.sideMorale(0)))}%`;
    (this.els.theirM.firstChild as HTMLElement).style.width = `${Math.max(0, Math.min(100, s.sideMorale(1)))}%`;
    const hero = s.hero;
    if (hero) {
      const f = Math.max(0, hero.hp / hero.maxHp);
      (this.els.hp.firstChild as HTMLElement).style.width = `${f * 100}%`;
      (this.els.hp.lastChild as HTMLElement).textContent = `生命 ${Math.max(0, Math.round(hero.hp))}/${Math.round(hero.maxHp)}`;
      if (s.heroMode === 'ranged' || hero.rng) this.refresh();
    }
  }

  message(t: string) {
    if (!this.els.msgs) return;
    const m = h('div', { class: 'b-msg' }, t);
    this.els.msgs.appendChild(m);
    while (this.els.msgs.children.length > 6) this.els.msgs.firstChild!.remove();
    setTimeout(() => m.classList.add('fade'), 5000);
  }

  showEnd(win: boolean, retreat: boolean, cb: () => void) {
    if (!this.root) return;
    const title = retreat ? '撤出战场' : win ? '大获全胜！' : '兵败如山倒';
    const box = h('div', { class: `b-end ${win ? 'win' : 'lose'}` },
      h('div', { class: 'b-end-title' }, title),
      h('button', { class: 'btn primary', onclick: () => cb() }, '返回大地图'),
    );
    this.root.appendChild(box);
  }

  close() { this.root?.remove(); this.root = null; this.scene = null; this.pointerOverUi = false; }
}

export const battleHud = new BattleHud();
