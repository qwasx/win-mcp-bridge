// 战斗界面：兵力、指令、阵型、布阵、小地图、攻城状态
import { h } from './dom';
import { soundButton } from '../audio/hooks';
import type { BattleScene, Group, Form } from '../scenes/BattleScene';
import { FORM_NAME, ORDER_NAME } from '../scenes/BattleScene';

const GNAME: Record<Group, string> = { inf: '步兵', rng: '远程', cav: '骑兵' };

class BattleHud {
  root: HTMLElement | null = null;
  scene: BattleScene | null = null;
  pointerOverUi = false;
  last = 0;
  lastMap = 0;
  els: Record<string, HTMLElement> = {};
  mapCv: HTMLCanvasElement | null = null;
  mapBg: HTMLCanvasElement | null = null;

  open(scene: BattleScene) {
    this.close();
    this.scene = scene;
    const E = this.els = {} as Record<string, HTMLElement>;
    const groupBtn = (g: string, label: string, key: string) => h('button', { class: 'bbtn', 'data-g': g, onclick: () => scene.select(g as any) }, h('kbd', null, key), label, E[`o_${g}`] = h('small', null, ''));
    const orderBtn = (o: string, label: string, key: string) => h('button', { class: 'bbtn', 'data-o': o, onclick: () => scene.order(o as any) }, h('kbd', null, key), label);
    const st = scene.setup;
    this.root = h('div', { id: 'battle-hud' },
      h('div', { class: 'b-top' },
        h('div', { class: 'b-side ours' }, h('b', null, st.allies?.length ? '我军与友军' : '我军'), E.ourN = h('span', null, ''), E.ourM = h('div', { class: 'mbar' }, h('i'))),
        h('div', { class: 'b-vs' }, st.arena ? '比武' : '对阵'),
        h('div', { class: 'b-side theirs' }, h('b', null, st.enemyName), E.theirN = h('span', null, ''), E.theirM = h('div', { class: 'mbar' }, h('i'))),
      ),
      E.siege = h('div', { class: 'b-siege' }),
      E.msgs = h('div', { class: 'b-msgs' }),
      E.mapWrap = h('div', { class: 'b-map ui-hit' }),
      E.deploy = h('div', { class: 'b-deploy ui-hit' }),
      h('div', { class: 'b-bottom ui-hit' },
        h('div', { class: 'b-hero' }, E.hp = h('div', { class: 'hpbar' }, h('i'), h('span', null, '')), E.weapon = h('div', { class: 'b-weapon' }, '')),
        h('div', { class: 'b-cmd' },
          h('div', { class: 'row' }, groupBtn('all', '全军', '1'), groupBtn('inf', '步兵', '2'), groupBtn('rng', '远程', '3'), groupBtn('cav', '骑兵', '4')),
          h('div', { class: 'row' }, orderBtn('charge', '冲锋', 'Z'), orderBtn('hold', '坚守', 'X'), orderBtn('follow', '跟随', 'C'), orderBtn('advance', '推进', 'V'),
            h('button', { class: 'bbtn', onclick: () => scene.cycleForm() }, h('kbd', null, 'F'), E.form = h('span', null, '阵型')),
            h('button', { class: 'bbtn', onclick: () => scene.toggleWeapon() }, h('kbd', null, 'Q'), '换武器')),
        ),
        h('div', { class: 'b-actions' },
          h('button', { class: 'btn', onclick: () => scene.autoFinish(), title: '用自动结算完成剩下的战斗' }, '自动结算'),
          h('button', { class: 'btn danger', onclick: () => scene.retreat(), title: '撤出战场（会损失部分部下）' }, '撤退'),
          soundButton('btn'),
        ),
      ),
    );
    this.root.querySelectorAll('.ui-hit').forEach(el => {
      el.addEventListener('mouseenter', () => this.pointerOverUi = true);
      el.addEventListener('mouseleave', () => this.pointerOverUi = false);
    });
    this.makeMap();
    document.getElementById('ui')!.appendChild(this.root);
    this.refresh();
  }

  makeMap() {
    const s = this.scene!;
    const W = 200, H = Math.round(200 * s.H / s.W);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'b-map-cv';
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    try {
      const c = bg.getContext('2d')!;
      if (s.groundCanvas) c.drawImage(s.groundCanvas, 0, 0, W, H);
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 0, W, H);
      const k = W / s.W;
      // 树林、民居、城墙
      c.fillStyle = 'rgba(30,60,25,0.55)';
      for (const g of s.F.groves) { c.beginPath(); c.arc(g.x * k, g.y * k, g.r * k, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(70,50,40,0.9)';
      for (const b of s.F.boxes) c.fillRect((b.x - b.w / 2) * k, (b.y - b.h) * k, b.w * k, b.h * k);
      const sg = s.F.siege;
      if (sg) { c.fillStyle = '#d8c8a0'; c.fillRect((sg.wallX - 14) * k, 0, Math.max(2, 28 * k), H); }
    } catch { /* 测试环境 */ }
    this.mapBg = bg; this.mapCv = cv;
    const wrap = this.els.mapWrap;
    wrap.appendChild(cv);
    const pt = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * s.W, (e.clientY - r.top) / r.height * s.H]; };
    cv.addEventListener('mousedown', e => {
      const [x, y] = pt(e);
      if (e.button === 2 || (s.phase === 'deploy' && e.button === 0 && e.shiftKey)) s.moveOrder(x, y);
      else s.lookAt(x, y);
      e.preventDefault();
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    wrap.appendChild(h('div', { class: 'b-map-tip' }, '点击：查看 · 右键：令所选部队前往'));
  }

  drawMap() {
    const s = this.scene, cv = this.mapCv; if (!s || !cv) return;
    const c = cv.getContext('2d'); if (!c) return;
    const W = cv.width, H = cv.height, k = W / s.W;
    c.clearRect(0, 0, W, H);
    if (this.mapBg) c.drawImage(this.mapBg, 0, 0);
    const sg = s.F.siege;
    if (sg) {
      c.fillStyle = '#5a3a1e';
      for (const sec of sg.sections) if (sec.broken) { c.fillStyle = '#3a2e20'; c.fillRect((sg.wallX - 16) * k, sec.y0 * k + 2, 32 * k + 1, (sec.y1 - sec.y0) * k - 4); }
      if (!s.siegeCtl?.gate.broken && !s.siegeCtl?.gate.opened) { c.fillStyle = '#6a4020'; c.fillRect((sg.wallX - 14) * k, sg.gateY0 * k, Math.max(2, 28 * k), (sg.gateY1 - sg.gateY0) * k); }
    }
    const col = ['#' + s.colors[0].toString(16).padStart(6, '0'), '#' + s.colors[1].toString(16).padStart(6, '0'), '#' + s.allyColor.toString(16).padStart(6, '0')];
    for (const u of s.units) {
      if (u.dead || u.fled) continue;
      c.fillStyle = u.routed ? '#999' : u.ally ? col[2] : col[u.side];
      const r = u.mounted ? 1.6 : 1.1;
      c.fillRect(u.x * k - r, u.y * k - r, r * 2, r * 2);
    }
    if (s.hero && !s.hero.dead) { c.fillStyle = '#fff'; c.beginPath(); c.arc(s.hero.x * k, s.hero.y * k, 2.6, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); }
    const v = s.cameras.main.worldView;
    c.strokeStyle = 'rgba(255,255,230,0.9)'; c.lineWidth = 1; c.strokeRect(v.x * k, v.y * k, v.width * k, v.height * k);
  }

  refresh() {
    const s = this.scene; if (!s || !this.root) return;
    this.root.querySelectorAll<HTMLElement>('[data-g]').forEach(b => b.classList.toggle('sel', b.dataset.g === s.selected));
    for (const g of ['inf', 'rng', 'cav'] as Group[]) this.els[`o_${g}`].textContent = ORDER_NAME[s.psq[g].order];
    this.els.o_all.textContent = '';
    const g0 = s.selected === 'all' ? 'inf' : s.selected;
    this.els.form.textContent = FORM_NAME[s.psq[g0].form];
    const hero = s.hero;
    if (!hero) this.els.weapon.textContent = '你坐镇后方指挥 —— WASD 移动视角';
    else if (hero.dead) this.els.weapon.textContent = '你已倒下 —— 可用 WASD 移动视角';
    else this.els.weapon.textContent = s.heroMode === 'ranged' ? `远程（剩余 ${hero.ammo}）` : `近战${hero.mounted ? ' · 骑乘' : ''}${hero.rng ? `（远程 ${hero.ammo}）` : ''}${hero.onWall ? ' · 城头' : ''}`;
    this.renderDeploy();
  }

  renderDeploy() {
    const s = this.scene!, el = this.els.deploy;
    el.innerHTML = '';
    if (s.phase !== 'deploy') { el.style.display = 'none'; return; }
    el.style.display = '';
    const forms: Form[] = ['line', 'block', 'wedge', 'loose'];
    const rows = (['inf', 'rng', 'cav'] as Group[]).map(g => {
      const n = s.psq[g].members.filter(u => !u.dead).length;
      return h('div', { class: `bd-row ${s.selected === g ? 'sel' : ''}` },
        h('b', { onclick: () => s.select(g) }, `${GNAME[g]} ${n}`),
        ...forms.map(f => h('button', { class: `bbtn sm ${s.psq[g].form === f ? 'on' : ''}`, onclick: () => s.setForm(g, f) }, FORM_NAME[f])),
      );
    });
    el.append(
      h('div', { class: 'bd-title' }, '布 阵'),
      h('div', { class: 'bd-tip' }, s.setup.defend ? '守城：弓手与部分步兵已登城，其余在城门内待命。可调整城内部队位置。' : '选择部队后在金色区域内点击放置。阵型：横阵火力最强，方阵抵御骑兵，锋矢冲锋更猛，疏阵少受箭伤。'),
      ...rows,
      h('button', { class: 'btn primary bd-go', onclick: () => s.startFight() }, '⚔ 开战（空格）'),
    );
  }

  tick() {
    const now = performance.now();
    const s = this.scene; if (!s) return;
    if (now - this.lastMap > 200) { this.lastMap = now; this.drawMap(); }
    if (now - this.last < 150) return;
    this.last = now;
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
    const ctl = s.siegeCtl;
    if (ctl) {
      const g = ctl.gate;
      const gate = g.broken ? '城门：已攻破' : g.opened ? '城门：已打开' : `城门 ${Math.max(0, Math.round(g.hp / g.max * 100))}%`;
      const ups = ctl.ladders.filter(l => l.state === 'up').length;
      const br = s.F.siege!.sections.filter(x => x.broken).length;
      const parts = [gate, `云梯 ${ups}/${ctl.ladders.length}`];
      if (ctl.ram) parts.push(ctl.ram.dead ? '冲车：已毁' : `冲车 ${Math.round(ctl.ram.hp / ctl.ram.max * 100)}%`);
      if (br) parts.push(`缺口 ${br}`);
      const myGuns = ctl.guns.filter(x => x.side === s.att && x.hp > 0).length;
      if (myGuns && s.att === 0) parts.push(`火炮 ${myGuns}：${{ gate: '打城门', wall: '打城墙', troops: '打守军' }[ctl.aim]}（B）`);
      if (ctl.mine) parts.push(`地道 ${Math.max(0, Math.ceil(ctl.mine.t))} 秒`);
      this.els.siege.textContent = parts.join(' · ');
      this.els.siege.style.display = '';
    } else this.els.siege.style.display = 'none';
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

  close() { this.root?.remove(); this.root = null; this.scene = null; this.pointerOverUi = false; this.mapCv = null; this.mapBg = null; }
}

export const battleHud = new BattleHud();
