// 大地图 HUD、悬浮提示、消息栏
import { myFollowers, dismissFollowers } from '../core/war';
import { h, uiRoot, panelOpen, confirmDialog } from './dom';
import { S, player, dateStr, isNight, on, dayOf } from '../core/game';
import { nav } from '../core/sim';
import { count, foodCount, dailyFood, wounded, partySize, healthy } from '../core/party';
import { partyLimit } from '../core/character';
import { soundButton } from '../audio/hooks';
import { weatherAt, weatherName, seasonOf, SEASON_NAME, type Weather } from '../core/weather';

/** 日晷小窗：天色、日月、雨雪 */
function drawDial(cv: HTMLCanvasElement, hour: number, w: Weather) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height, cx = W / 2, cy = H * 0.62, R = W * 0.44;
  c.clearRect(0, 0, W, H);
  c.save(); c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); c.clip();
  // 天色
  const day = hour >= 6 && hour < 18.5, dusk = (hour >= 17 && hour < 20) || (hour >= 4.5 && hour < 7);
  const g = c.createLinearGradient(0, 0, 0, H);
  if (dusk) { g.addColorStop(0, '#3a4a7a'); g.addColorStop(0.6, '#e08a50'); g.addColorStop(1, '#f0c070'); }
  else if (day) { g.addColorStop(0, '#4a8ac8'); g.addColorStop(1, '#bfe0f0'); }
  else { g.addColorStop(0, '#060a20'); g.addColorStop(1, '#1a2850'); }
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (!day && !dusk) { c.fillStyle = 'rgba(255,255,240,0.85)'; for (const [x, y] of [[8, 9], [20, 6], [33, 11], [14, 17], [38, 20], [27, 15]]) c.fillRect(x * W / 44, y * H / 44, 1, 1); }
  if (w.kind !== 'clear' && w.k > 0.1) { c.fillStyle = `rgba(90,100,115,${0.6 * w.k})`; c.fillRect(0, 0, W, H); }
  // 日 / 月：6 时从东方升起，18 时落下
  const isSun = hour >= 5 && hour < 19;
  const f = isSun ? (hour - 5) / 14 : ((hour + 24 - 19) % 24) / 10;
  const a = Math.PI * (1 - f);
  const sx = cx + Math.cos(a) * R * 0.8, sy = cy - Math.sin(a) * R * 0.8;
  if (isSun) {
    const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 9); sg.addColorStop(0, 'rgba(255,240,180,0.9)'); sg.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = sg; c.fillRect(sx - 9, sy - 9, 18, 18);
    c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(sx, sy, 4, 0, Math.PI * 2); c.fill();
  } else {
    c.fillStyle = '#f4f0dc'; c.beginPath(); c.arc(sx, sy, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0c1430'; c.beginPath(); c.arc(sx + 1.8, sy - 1, 3.4, 0, Math.PI * 2); c.fill();
  }
  // 远山
  c.fillStyle = day ? '#4a6a3a' : '#121c18';
  c.beginPath(); c.moveTo(0, H); c.lineTo(0, cy + 2); c.lineTo(W * 0.22, cy - 4); c.lineTo(W * 0.4, cy + 1); c.lineTo(W * 0.62, cy - 6); c.lineTo(W * 0.8, cy); c.lineTo(W, cy - 2); c.lineTo(W, H); c.fill();
  c.fillStyle = day ? '#2e4a28' : '#0a120e';
  c.beginPath(); c.moveTo(0, H); c.lineTo(0, cy + 7); c.lineTo(W * 0.3, cy + 3); c.lineTo(W * 0.55, cy + 8); c.lineTo(W, cy + 4); c.lineTo(W, H); c.fill();
  // 雨雪
  if (w.kind === 'rain' && w.k > 0.1) { c.strokeStyle = 'rgba(220,230,240,0.7)'; c.lineWidth = 1; c.beginPath(); const t = performance.now() / 120; for (let i = 0; i < 9; i++) { const x = (i * 5.3 + t * 3) % W, y = (i * 11.7 + t * 9) % H; c.moveTo(x, y); c.lineTo(x - 1.5, y - 5); } c.stroke(); }
  if (w.kind === 'snow' && w.k > 0.1) { c.fillStyle = '#fff'; const t = performance.now() / 400; for (let i = 0; i < 12; i++) { const x = (i * 7.1 + Math.sin(t + i) * 2) % W, y = (i * 9.3 + t * 4) % H; c.fillRect(x, y, 1.5, 1.5); } }
  c.restore();
  c.strokeStyle = '#c9a24a'; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); c.stroke();
}

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
        h('div', { class: 'hud-date' }, E.dial = h('canvas', { class: 'dial', width: 44, height: 44 }), E.season = h('span', { class: 'season-seal' }, '春'), h('div', { class: 'hud-date-txt' }, E.date = h('span', null, ''), E.weather = h('span', { class: 'hud-weather' }, ''))),
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
          E.army = h('span', { class: 'hud-army', title: '随你出征的军团（点击遣散）', style: { display: 'none', cursor: 'pointer' }, onclick: () => {
            const fol = myFollowers(); if (!fol.length) return;
            confirmDialog('遣散军团', `让随行的${fol.length}路兵马各自归营？`, () => { dismissFollowers(); this.update(true); }, '遣散', '取消');
          } }, '🚩', E.armyN = h('b', null, '')),
        ),
      ),
      E.log = h('div', { class: 'hud-log' }),
      h('div', { class: 'hud-buttons' },
        ...([['character', '角色', 'C'], ['party', '部队', 'P'], ['inventory', '行囊', 'I'], ['factions', '天下', 'F'], ['quests', '任务', 'Q'], ['log', '日志', 'L'], ['menu', '菜单', 'Esc']] as [string, string, string][])
          .map(([k, label, key]) => h('button', { class: 'hbtn', onclick: () => actions[k]?.(), title: `${label} (${key})` }, h('span', null, label), h('kbd', null, key))),
        h('button', { class: 'hbtn', onclick: () => actions.center(), title: '回到我的位置 (Home)' }, h('span', null, '定位'), h('kbd', null, 'H')),
        soundButton('hbtn'),
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
    const wth = weatherAt(pp.x, pp.y, S.time);
    drawDial(E.dial as HTMLCanvasElement, S.time % 24, wth);
    E.season.textContent = SEASON_NAME[seasonOf(S.time)];
    E.weather.textContent = (isNight() ? '夜 · ' : '') + weatherName(wth);
    E.gold.textContent = String(pp.gold);
    const w = wounded(pp.troops);
    E.troops.textContent = `${partySize(S, pp)}/${partyLimit(S)}${w ? ` (${w}伤)` : ''}`;
    const fd = Math.floor(foodCount(pp) / dailyFood(S, pp));
    E.food.textContent = `${fd}天`;
    E.food.className = fd < 2 ? 'bad' : '';
    E.morale.textContent = String(Math.round(S.morale));
    E.morale.className = S.morale < 25 ? 'bad' : S.morale > 70 ? 'good' : '';
    E.renown.textContent = String(S.renown);
    const fol = myFollowers();
    E.army.style.display = fol.length ? '' : 'none';
    if (fol.length) E.armyN.textContent = `${fol.length}路 ${fol.reduce((a, p) => a + healthy(p.troops), 0)}人`;
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
