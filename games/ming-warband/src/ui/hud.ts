// 大地图 HUD、悬浮提示、消息栏
import { h, uiRoot, panelOpen } from './dom';
import { S, player, dateStr, isNight, on, dayOf } from '../core/game';
import { nav } from '../core/sim';
import { count, foodCount, dailyFood, wounded, partySize } from '../core/party';
import { partyLimit } from '../core/character';

let tip: HTMLElement | null = null;
export function showTooltip(ev: MouseEvent | undefined, html: string) {
  if (!ev) return;
  if (!tip) { tip = h('div', { id: 'tooltip' }); document.body.appendChild(tip); }
  tip.innerHTML = html;
  tip.style.display = 'block';
  const x = ev.clientX + 16, y = ev.clientY + 14;
  const w = tip.offsetWidth, hgt = tip.offsetHeight;
  tip.style.left = `${Math.min(x, window.innerWidth - w - 8)}px`;
  tip.style.top = `${Math.min(y, window.innerHeight - hgt - 8)}px`;
}
export function hideTooltip() { if (tip) tip.style.display = 'none'; }

class Hud {
  root: HTMLElement | null = null;
  els: Record<string, HTMLElement> = {};
  last = 0;
  actions: Record<string, () => void> = {};

  mount(actions: Record<string, () => void>) {
    this.unmount();
    this.actions = actions;
    const E = this.els = {} as Record<string, HTMLElement>;
    const spd = (n: number, label: string, title: string) => h('button', { class: 'spd', 'data-s': n, title, onclick: () => { S.speed = n; this.update(true); } }, label);
    this.root = h('div', { id: 'hud' },
      h('div', { class: 'hud-top' },
        h('div', { class: 'hud-date' }, E.sun = h('span', { class: 'sun' }, '☀'), E.date = h('span', null, '')),
        h('div', { class: 'hud-speed' },
          E.wait = h('button', { class: 'spd wait', title: '扎营等待 / 停止 (空格)', onclick: () => actions.toggleWait() }, '扎营'),
          spd(1, '▶', '常速 (1)'), spd(2, '▶▶', '两倍速 (2)'), spd(4, '▶▶▶', '四倍速 (3)'),
          E.state = h('span', { class: 'hud-state' }, ''),
        ),
        h('div', { class: 'hud-stats' },
          h('span', { title: '银两' }, '💰', E.gold = h('b', null, '')),
          h('span', { title: '部队人数 / 上限（负伤）' }, '⚔', E.troops = h('b', null, '')),
          h('span', { title: '粮食可维持天数' }, '🌾', E.food = h('b', null, '')),
          h('span', { title: '士气' }, '🔥', E.morale = h('b', null, '')),
          h('span', { title: '声望' }, '★', E.renown = h('b', null, '')),
        ),
      ),
      E.log = h('div', { class: 'hud-log' }),
      h('div', { class: 'hud-buttons' },
        ...([['character', '角色', 'C'], ['party', '部队', 'P'], ['inventory', '行囊', 'I'], ['factions', '天下', 'F'], ['quests', '任务', 'Q'], ['log', '日志', 'L'], ['menu', '菜单', 'Esc']] as [string, string, string][])
          .map(([k, label, key]) => h('button', { class: 'hbtn', onclick: () => actions[k]?.(), title: `${label} (${key})` }, h('span', null, label), h('kbd', null, key))),
        h('button', { class: 'hbtn', onclick: () => actions.center(), title: '回到我的位置 (Home)' }, h('span', null, '定位'), h('kbd', null, 'H')),
      ),
    );
    uiRoot().appendChild(this.root);
    for (const e of S.log.slice(-6)) this.pushLog(e.msg, e.cls ?? '', true);
    this.update(true);
  }
  unmount() { this.root?.remove(); this.root = null; }

  pushLog(msg: string, cls: string, instant = false) {
    if (!this.els.log) return;
    const el = h('div', { class: `logline ${cls}` }, msg);
    this.els.log.appendChild(el);
    while (this.els.log.children.length > 7) this.els.log.firstChild!.remove();
    if (!instant) setTimeout(() => el.classList.add('old'), 12000);
    else el.classList.add('old');
  }

  update(force = false) {
    if (!this.root) return;
    const now = performance.now();
    if (!force && now - this.last < 200) return;
    this.last = now;
    const pp = player();
    const E = this.els;
    E.date.textContent = dateStr();
    E.sun.textContent = isNight() ? '☾' : '☀';
    E.gold.textContent = String(pp.gold);
    const w = wounded(pp.troops);
    E.troops.textContent = `${partySize(S, pp)}/${partyLimit(S)}${w ? ` (${w}伤)` : ''}`;
    const fd = Math.floor(foodCount(pp) / dailyFood(S, pp));
    E.food.textContent = `${fd}天`;
    E.food.className = fd < 2 ? 'bad' : '';
    E.morale.textContent = String(Math.round(S.morale));
    E.morale.className = S.morale < 25 ? 'bad' : S.morale > 70 ? 'good' : '';
    E.renown.textContent = String(S.renown);
    const moving = !!nav.target, waiting = nav.waiting;
    E.wait.classList.toggle('on', waiting);
    E.wait.textContent = waiting ? '起营' : '扎营';
    E.state.textContent = panelOpen() ? '' : moving ? '行军中' : waiting ? '扎营等待中…' : '已暂停';
    this.root.querySelectorAll<HTMLElement>('[data-s]').forEach(b => b.classList.toggle('sel', Number(b.dataset.s) === S.speed));
    void count; void dayOf;
  }
}
export const hud = new Hud();

on('log', (msg: string, cls: string) => hud.pushLog(msg, cls));
