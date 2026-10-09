// 攻城战：云梯、冲车、火炮、地道、城门与城墙、滚木礌石与金汁、马道
import Phaser from 'phaser';
import type { BattleScene, Unit } from '../BattleScene';
import type { Section } from './field';
import { WALL_H } from '../../art/battleArt';
import { sfx } from '../../audio/sfx';

export interface SiegeKit { ladders: number; ram: boolean; cannons: number; mine: boolean }

interface Ladder { i: number; y: number; x: number; state: 'carry' | 'raise' | 'up' | 'down'; t: number; crew: Unit[]; busy: number; push: number; g: Phaser.GameObjects.Graphics; queued: number; threat: number }
interface Ram { x: number; y: number; hp: number; max: number; crew: Unit[]; cd: number; dead: boolean; g: Phaser.GameObjects.Graphics; burn: number }
interface Gun { x: number; y: number; cd: number; side: 0 | 1; wall: boolean; hp: number; recoil: number; g: Phaser.GameObjects.Graphics | null }
interface Ball { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; side: 0 | 1; aim: 'gate' | 'sec' | 'pt' | 'gun'; sec?: Section; gun?: Gun; z0: number; z1: number }
export type CannonAim = 'gate' | 'wall' | 'troops';

export class SiegeCtl {
  B: BattleScene;
  att: 0 | 1; def: 0 | 1;
  gate = { hp: 1000, max: 1000, broken: false, opened: false };
  ladders: Ladder[] = [];
  ram: Ram | null = null;
  guns: Gun[] = [];
  balls: Ball[] = [];
  mine: { t: number; sec: Section } | null = null;
  oilCd = 4;
  winch = 0;
  aim: CannonAim = 'gate';
  gateG: Phaser.GameObjects.Graphics | null = null;
  secImgs = new Map<Section, Phaser.GameObjects.Image>();
  started = false;
  needUp = 0;

  constructor(B: BattleScene, att: 0 | 1) {
    this.B = B; this.att = att; this.def = (1 - att) as 0 | 1;
    const sg = B.F.siege!;
    this.gate.max = this.gate.hp = sg.town ? 1300 : 950;
  }
  get sg() { return this.B.F.siege!; }

  setup(kit: SiegeKit, defenderGuns: number) {
    const B = this.B, sg = this.sg;
    // 云梯：避开城门，均匀分布在两侧
    const n = Math.max(0, Math.min(6, kit.ladders));
    const ys: number[] = [];
    const cands = sg.sections.map(s => (s.y0 + s.y1) / 2).sort((a, b) => Math.abs(a - sg.gateMid) - Math.abs(b - sg.gateMid));
    for (let i = 0; i < cands.length && ys.length < n; i++) if (i % 2 === 0 || cands.length < n * 2) ys.push(cands[i]);
    const startX = sg.wallX - 640;
    ys.forEach((y, i) => this.ladders.push({ i, y, x: startX + (i % 2) * 20, state: 'carry', t: 0, crew: [], busy: 0, push: 0, g: B.add.graphics(), queued: 0, threat: 0 }));
    if (kit.ram) this.ram = { x: startX - 40, y: sg.gateMid, hp: 420, max: 420, crew: [], cd: 2, dead: false, g: B.add.graphics(), burn: 0 };
    for (let i = 0; i < Math.min(4, kit.cannons); i++) {
      const y = sg.gateMid + (i - (kit.cannons - 1) / 2) * 120;
      this.guns.push({ x: sg.wallX - 760, y, cd: 4 + i * 1.7, side: this.att, wall: false, hp: 520, recoil: 0, g: B.add.graphics() });
    }
    // 城头火炮（架在敌楼上）
    const towers = [...sg.towers].sort((a, b) => Math.abs(a - sg.gateMid) - Math.abs(b - sg.gateMid));
    for (let i = 0; i < Math.min(defenderGuns, towers.length); i++) this.guns.push({ x: sg.wallX, y: towers[i], cd: 8 + i * 3, side: this.def, wall: true, hp: 999, recoil: 0, g: null });
    if (kit.mine) {
      const secs = sg.sections.filter(s => Math.abs((s.y0 + s.y1) / 2 - sg.gateMid) > 200);
      const sec = secs[Math.floor(secs.length * 0.3)] ?? sg.sections[0];
      if (sec) this.mine = { t: 55 + Math.random() * 15, sec };
    }
    this.gateG = B.add.graphics().setDepth(B.dy(sg.gateY1) - 0.001);
    this.assignCrews();
  }

  // ---------- 工具 ----------
  alive(u: Unit) { return !u.dead && !u.fled && !u.routed; }
  freeInf(near: { x: number; y: number }, n: number) {
    const c = this.B.units.filter(u => u.side === this.att && !u.hero && !u.comp && this.alive(u) && !u.task && !u.onWall && !u.trans && u.group === 'inf' && !u.mounted && u.x < this.sg.wallX - 20);
    c.sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y));
    return c.slice(0, n);
  }
  assignCrews() {
    for (const L of this.ladders) if (L.state === 'carry') { L.crew = this.freeInf(L, 4); for (const u of L.crew) u.task = { kind: 'ladder', ref: L }; }
    if (this.ram) { this.ram.crew = this.freeInf(this.ram, 6); for (const u of this.ram.crew) u.task = { kind: 'ram', ref: this.ram }; }
  }
  laneSegs() {
    // 城头被缺口截断后的各段
    const segs: [number, number][] = [];
    let y0 = 14;
    for (const s of [...this.sg.sections].filter(s => s.broken).sort((a, b) => a.y0 - b.y0)) { segs.push([y0, s.y0 + 14]); y0 = s.y1 - 14; }
    segs.push([y0, this.B.F.H - 14]);
    return segs;
  }
  segOf(y: number) { for (const s of this.laneSegs()) if (y >= s[0] - 1 && y <= s[1] + 1) return s; return [y, y] as [number, number]; }
  laneClamp(y0: number, y1: number) { const s = this.segOf(y0); return Math.max(s[0], Math.min(s[1], y1)); }
  passageCount() { return this.B.passN; }
  laneAtt = 0; laneDef = 0;

  // ---------- 每帧 ----------
  update(dt: number) {
    const B = this.B, sg = this.sg;
    if (!this.started) return;
    this.laneAtt = 0; this.laneDef = 0;
    for (const L of this.ladders) L.threat = 0;
    for (const u of B.units) {
      if (!this.alive(u)) continue;
      if (u.onWall) { if (u.side === this.att) this.laneAtt++; else this.laneDef++; }
      else if (u.side === this.att && u.x < sg.wallX && u.x > sg.wallX - 80) for (const L of this.ladders) if (Math.abs(u.y - L.y) < 60) L.threat++;
    }
    // 云梯
    for (const L of this.ladders) {
      L.busy -= dt;
      if (L.state === 'carry') {
        L.crew = L.crew.filter(u => this.alive(u));
        if (!L.crew.length) { L.crew = this.freeInf(L, 3); for (const u of L.crew) u.task = { kind: 'ladder', ref: L }; }
        const near = L.crew.filter(u => Math.hypot(u.x - L.x, u.y - L.y) < 46).length;
        const tx = sg.wallX - 26, ty = L.y;
        const d = Math.hypot(tx - L.x, ty - L.y);
        if (near && d > 3) { const sp = 48 * Math.min(1, near / 3) * dt; L.x += (tx - L.x) / d * Math.min(sp, d); L.y += (ty - L.y) / d * Math.min(sp, d); }
        if (d <= 3) { L.state = 'raise'; L.t = 2; B.snd('fall', L.x, L.y, 0.6); }
      } else if (L.state === 'raise') {
        L.t -= dt;
        if (L.t <= 0) { L.state = 'up'; for (const u of L.crew) u.task = undefined; L.crew = []; B.snd('clash', L.x, L.y, 0.5); B.msgOnce('ladder', '云梯架上城头了！'); }
      } else if (L.state === 'down') {
        L.t -= dt;
        if (L.t <= 0) {
          const helpers = B.units.filter(u => u.side === this.att && this.alive(u) && !u.onWall && Math.hypot(u.x - L.x, u.y - L.y) < 90).length;
          if (helpers >= 2) { L.state = 'raise'; L.t = 2.5; }
        }
      } else if (L.state === 'up') {
        // 守军推倒云梯
        let defN = 0, attN = 0;
        for (const u of B.units) {
          if (!u.onWall || !this.alive(u) || u.trans) continue;
          const dy = Math.abs(u.y - L.y);
          if (u.side === this.def && dy < 22) defN++;
          else if (u.side === this.att && dy < 30) attN++;
        }
        const loaded = B.units.some(u => u.trans && u.trans.ref === L);
        if (defN >= 2 && attN === 0) L.push += dt * Math.min(4, defN) * (loaded ? 0.15 : 0.4); else L.push = Math.max(0, L.push - dt);
        if (L.push > 8) this.pushDown(L);
      }
      L.queued = 0;
    }
    // 冲车
    const ram = this.ram;
    if (ram && !ram.dead) {
      ram.crew = ram.crew.filter(u => this.alive(u));
      if (ram.crew.length < 3) { const more = this.freeInf(ram, 6 - ram.crew.length); for (const u of more) { u.task = { kind: 'ram', ref: ram }; ram.crew.push(u); } }
      const near = ram.crew.filter(u => Math.hypot(u.x - ram.x, u.y - ram.y) < 50).length;
      const tx = sg.wallX - 38, d = tx - ram.x;
      if (!this.gate.broken && !this.gate.opened) {
        if (d > 2 && near >= 2) ram.x += Math.min(d, 26 * Math.min(1, near / 4) * dt);
        else if (d <= 2 && near >= 2) {
          ram.cd -= dt;
          if (ram.cd <= 0) {
            ram.cd = 2.4;
            this.damageGate(46 + 16 * Math.min(6, near));
            B.snd('fall', sg.wallX, sg.gateMid, 1.2); B.snd('drum', sg.wallX, sg.gateMid, 1);
            B.shakeAt(sg.wallX, sg.gateMid, 80, 0.004);
            B.debris(sg.wallX - 12, sg.gateMid, 5, 0x5a3a1e);
          }
        }
      } else { for (const u of ram.crew) u.task = undefined; ram.crew = []; }
      if (ram.burn > 0) { ram.burn -= dt; ram.hp -= 6 * dt; if (Math.random() < dt * 8) B.fireAt(ram.x + (Math.random() - 0.5) * 30, ram.y - 10, 1); }
      if (ram.hp <= 0) { ram.dead = true; for (const u of ram.crew) u.task = undefined; ram.crew = []; B.msg('冲车被守军焚毁了！'); B.snd('fall', ram.x, ram.y, 1); }
    }
    // 金汁/火油：城门前有敌军聚集或冲车靠近时
    this.oilCd -= dt;
    if (this.oilCd <= 0) {
      this.oilCd = 1;
      const pourers = B.units.filter(u => u.side === this.def && u.onWall && this.alive(u) && !u.trans && Math.abs(u.y - sg.gateMid) < 80);
      const victims = B.units.filter(u => u.side === this.att && this.alive(u) && !u.onWall && Math.abs(u.x - (sg.wallX - 40)) < 46 && Math.abs(u.y - sg.gateMid) < 70);
      const ramThere = ram && !ram.dead && ram.x > sg.wallX - 60;
      if (pourers.length && (victims.length >= 4 || ramThere) && !this.gate.broken) {
        this.oilCd = 7 + Math.random() * 3;
        for (const v of victims) B.hurt(v, 14 + Math.random() * 22, pourers[0]);
        if (ramThere) { ram!.hp -= 70; ram!.burn = 6; }
        for (let i = 0; i < 18; i++) B.fireAt(sg.wallX - 30 - Math.random() * 30, sg.gateMid + (Math.random() - 0.5) * 100, i % 3 === 0 ? 2 : 1);
        B.snd('gun', sg.wallX, sg.gateMid, 0.4); B.snd('death', sg.wallX - 30, sg.gateMid, 1);
        B.msgOnce('oil', '守军从城门楼上倾下滚烫的金汁！');
      }
    }
    // 滚木礌石
    for (const u of B.units) {
      if (u.side !== this.def || !u.onWall || !this.alive(u) || u.trans) continue;
      if (u.rng > 0 && u.ammo > 0) continue;
      u.rockCd = (u.rockCd ?? Math.random() * 3) - dt;
      if (u.rockCd > 0) continue;
      u.rockCd = 6 + Math.random() * 4;
      let best: Unit | null = null;
      for (const o of B.units) {
        if (o.side !== this.att || !this.alive(o) || o.onWall) continue;
        if (Math.abs(o.y - u.y) > 46) continue;
        if (o.trans?.kind === 'climb' || (o.x > sg.wallX - 70 && o.x < sg.wallX - 12)) { best = o; if (o.trans) break; }
      }
      if (best) { B.dropRock(u, best); }
    }
    // 城内绞盘：攻方从城内打开城门
    if (!this.gate.broken && !this.gate.opened) {
      const wx = sg.wallX + 40, wy = sg.gateMid;
      let a = 0, d = 0;
      for (const u of B.units) {
        if (!this.alive(u) || u.onWall) continue;
        const dd = Math.hypot(u.x - wx, u.y - wy);
        if (u.side === this.att && dd < 46) a++;
        else if (u.side === this.def && dd < 80) d++;
      }
      if (a && !d) { this.winch += dt; if (this.winch > 4) this.openGate(); } else this.winch = Math.max(0, this.winch - dt * 0.5);
    }
    // 火炮
    for (const g of this.guns) {
      g.recoil = Math.max(0, g.recoil - dt * 3);
      if (g.hp <= 0) continue;
      g.cd -= dt;
      if (g.cd > 0) continue;
      this.fireGun(g);
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.t += dt;
      if (b.t >= b.dur) { this.impact(b); this.balls.splice(i, 1); }
    }
    // 地道
    if (this.mine) {
      this.mine.t -= dt;
      if (this.mine.t < 8 && this.mine.t + dt >= 8) B.msg('城下传来闷响……地道快挖到城墙底下了！');
      if (this.mine.t <= 0) {
        const s = this.mine.sec; this.mine = null;
        const y = (s.y0 + s.y1) / 2;
        for (let k = 0; k < 3; k++) B.snd('cannon', sg.wallX, y, 1.4);
        sfx('thunder', { vol: 0.6 });
        B.shakeAt(sg.wallX, y, 600, 0.02);
        for (const u of B.units) if (this.alive(u) && Math.hypot(u.x - sg.wallX, u.y - y) < 80) B.hurt(u, 40 + Math.random() * 60, null);
        for (let k = 0; k < 40; k++) B.debris(sg.wallX + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 120, 1, 0x8a7e66);
        B.explosion(sg.wallX, y, 3);
        this.breakSection(s);
        B.msg('轰——！地道中的火药引爆，城墙崩塌了一大段！');
      }
    }
    this.needUp = 0;
    this.render();
  }

  pushDown(L: Ladder) {
    const B = this.B;
    L.state = 'down'; L.t = 7; L.push = 0;
    for (const u of B.units) if (u.trans && u.trans.ref === L) {
      u.trans = undefined; u.x = this.sg.wallX - 34 - Math.random() * 10; u.y = L.y + (Math.random() - 0.5) * 16;
      B.hurt(u, 20 + Math.random() * 35, null);
    }
    B.snd('fall', L.x, L.y, 1.1); B.snd('death', L.x, L.y, 0.8);
    B.msg('守军推倒了一架云梯！');
  }

  damageGate(n: number) {
    if (this.gate.broken || this.gate.opened) return;
    this.gate.hp -= n;
    if (this.gate.hp <= 0) {
      this.gate.broken = true;
      this.B.F.openGate();
      const sg = this.sg;
      this.B.snd('fall', sg.wallX, sg.gateMid, 1.5); this.B.snd('crowd', sg.wallX, sg.gateMid, 1.2);
      for (let k = 0; k < 30; k++) this.B.debris(sg.wallX + (Math.random() - 0.5) * 30, sg.gateMid + (Math.random() - 0.5) * 100, 1, 0x5a3a1e);
      this.B.shakeAt(sg.wallX, sg.gateMid, 300, 0.01);
      this.B.msg('城门被攻破了！');
      this.B.onBreach();
    }
  }
  openGate() {
    this.gate.opened = true; this.B.F.openGate();
    this.B.msg('城门从里面被打开了！');
    this.B.snd('crowd', this.sg.wallX, this.sg.gateMid, 1.2);
    this.B.onBreach();
  }
  damageSection(s: Section, n: number) {
    if (s.broken) return;
    s.hp -= n;
    if (s.hp <= 0) { this.breakSection(s); this.B.msg('城墙被轰塌了一段！'); }
  }
  breakSection(s: Section) {
    const B = this.B, sg = this.sg;
    s.hp = 0;
    B.F.openBreach(s);
    const img = this.secImgs.get(s); if (img) img.setVisible(false);
    B.stampRubble(sg.wallX, s.y0, s.y1);
    // 城头上的人摔下
    for (const u of B.units) if (u.onWall && this.alive(u) && u.y > s.y0 + 10 && u.y < s.y1 - 10) { u.onWall = false; u.x = sg.wallX + (u.side === this.att ? -30 : 30); B.hurt(u, 30 + Math.random() * 40, null); }
    B.onBreach();
  }

  fireGun(g: Gun) {
    const B = this.B, sg = this.sg;
    g.cd = (g.wall ? 11 : 9) + Math.random() * 3;
    let tx = 0, ty = 0, aim: Ball['aim'] = 'pt';
    let sec: Section | undefined, tgun: Gun | undefined;
    if (g.side === this.att) {
      const mode = this.B.att === 0 ? this.aim : (this.gate.broken || this.gate.opened ? 'troops' : 'gate');
      if (mode === 'gate' && !this.gate.broken && !this.gate.opened) { tx = sg.wallX - 6; ty = sg.gateMid + (Math.random() - 0.5) * 70; aim = 'gate'; }
      else if (mode === 'wall' || (mode === 'gate')) {
        const cand = sg.sections.filter(s => !s.broken).sort((a, b) => (a.hp - b.hp) || (Math.abs(a.y0 - g.y) - Math.abs(b.y0 - g.y)));
        sec = cand[0]; if (!sec) { g.cd = 3; return; }
        tx = sg.wallX - 4; ty = (sec.y0 + sec.y1) / 2 + (Math.random() - 0.5) * 70; aim = 'sec';
      } else {
        const t = this.densest(this.def, true); if (!t) { g.cd = 3; return; }
        tx = t.x; ty = t.y; aim = 'pt';
      }
    } else {
      // 城头火炮：优先轰击攻方火炮，否则打人群
      const enemyGun = this.guns.find(o => o.side === this.att && o.hp > 0);
      if (enemyGun && Math.random() < 0.35) { tx = enemyGun.x; ty = enemyGun.y; aim = 'gun'; tgun = enemyGun; }
      else { const t = this.densest(this.att, false); if (!t) { g.cd = 4; return; } tx = t.x; ty = t.y; }
    }
    const spread = Math.hypot(tx - g.x, ty - g.y) * (g.wall ? 0.09 : 0.04);
    tx += (Math.random() - 0.5) * spread; ty += (Math.random() - 0.5) * spread;
    const dist = Math.hypot(tx - g.x, ty - g.y);
    const z0 = g.wall ? WALL_H + 6 : 10;
    this.balls.push({ x0: g.x + (g.side === 0 ? 14 : -14) * (g.wall ? 0 : 1), y0: g.y, x1: tx, y1: ty, t: 0, dur: Math.max(0.5, dist / 650), side: g.side, aim, sec, gun: tgun, z0, z1: aim === 'pt' || aim === 'gun' ? 0 : WALL_H * 0.6 });
    g.recoil = 1;
    B.snd('cannon', g.x, g.y, 1.3);
    B.shakeAt(g.x, g.y, 120, 0.004);
    B.muzzle(g.x + (g.x < sg.wallX ? 16 : -16), g.y - z0, g.x < sg.wallX ? 0 : Math.PI);
  }
  densest(side: 0 | 1, wallOnly: boolean): Unit | null {
    const B = this.B;
    let best: Unit | null = null, bn = 0;
    const cand = B.units.filter(u => u.side === side && this.alive(u) && (!wallOnly || u.onWall));
    for (let k = 0; k < Math.min(24, cand.length); k++) {
      const u = cand[Math.floor(Math.random() * cand.length)];
      let n = 0; for (const o of cand) if (Math.abs(o.x - u.x) < 50 && Math.abs(o.y - u.y) < 50) n++;
      if (n > bn) { bn = n; best = u; }
    }
    return best;
  }
  impact(b: Ball) {
    const B = this.B, sg = this.sg;
    B.snd('fall', b.x1, b.y1, 1.2);
    B.explosion(b.x1, b.y1 - b.z1, 1);
    if (b.aim === 'gate' && Math.abs(b.y1 - sg.gateMid) < 60) { this.damageGate(150); B.debris(sg.wallX - 10, b.y1, 8, 0x5a3a1e); }
    else if (b.aim === 'sec' && b.sec) { this.damageSection(b.sec, 140); B.debris(sg.wallX - 10, b.y1 - WALL_H * 0.5, 8, 0x8a7e66); }
    else if (b.aim === 'gun' && b.gun && Math.hypot(b.gun.x - b.x1, b.gun.y - b.y1) < 40) { b.gun.hp -= 120; if (b.gun.hp <= 0) B.msg('一门火炮被城头炮火击毁！'); }
    // 溅射
    const onWallHit = b.aim === 'sec' || b.aim === 'gate';
    for (const u of B.units) {
      if (!this.alive(u)) continue;
      if (onWallHit ? !(u.onWall || Math.abs(u.x - sg.wallX) < 40) : u.onWall) continue;
      const d = Math.hypot(u.x - b.x1, u.y - b.y1);
      if (d < 34) B.hurt(u, (1 - d / 40) * 90 + 20, null);
    }
    if (!onWallHit && b.aim !== 'gun') B.crater(b.x1, b.y1);
  }

  // ---------- 单位行为 ----------
  /** 处理攻城战中的特殊行为；返回 true 表示已处理 */
  brain(u: Unit, dt: number): boolean {
    const B = this.B, sg = this.sg;
    if (u.trans) { this.stepTrans(u, dt); return true; }
    const ranged = u.rng > 0 && u.ammo > 0;
    if (u.task) {
      const r = u.task.ref as { x: number; y: number };
      const k = u.uid % 6;
      const ox = u.task.kind === 'ram' ? -16 + (k % 3) * 16 : -10 + (k % 2) * 20, oy = u.task.kind === 'ram' ? (k < 3 ? -14 : 14) : (k < 2 ? -10 : 10);
      B.steer(u, r.x + ox, r.y + oy, dt, 0.9);
      return true;
    }
    const isAtt = u.side === B.att;
    const order = B.orderOf(u);
    if (u.onWall) return this.laneBrain(u, dt, isAtt, ranged);
    if (ranged) return false;
    const inside = u.x > sg.wallX + 10;
    const open = this.passageCount() > 0;
    if (isAtt) {
      if (order === 'hold' && !u.sq.ai) return false;
      if (order === 'follow' && B.hero && !B.hero.dead && !B.hero.onWall) return false;
      if (u.mounted) {
        if (!open && !inside) { B.steer(u, sg.wallX - 560, u.sq.ay + ((u.uid % 9) - 4) * 20, dt, 0.6); return true; }
        return false;
      }
      if (inside) {
        // 城内：去开城门，或与守军厮杀
        if (!this.gate.broken && !this.gate.opened) {
          const e = B.nearestEnemy(u, 140, o => !o.onWall);
          if (!e) { B.steer(u, sg.wallX + 40 + (u.uid % 5) * 4, sg.gateMid + ((u.uid % 7) - 3) * 8, dt); return true; }
        }
        if (!B.nearestEnemy(u, 2000, o => !o.onWall)) return this.toStairs(u, dt, true);
        return false;
      }
      const e = B.nearestEnemy(u, 180, o => !o.onWall && o.x < sg.wallX);
      if (e) return false;
      if (open) {
        // 有通道：若城下已无可战之敌，则冲进城去登城
        if (!B.nearestEnemy(u, 3000, o => !o.onWall)) return this.toStairs(u, dt, false);
        return false;
      }
      return this.toLadder(u, dt);
    }
    // 守方
    if (order === 'hold' && !u.sq.ai) return false;
    if (u.mounted) {
      const e = B.nearestEnemy(u, 400, o => !o.onWall && o.x > sg.wallX - 200);
      if (e) return false;
      B.steer(u, sg.wallX + 260 + (u.uid % 5) * 12, sg.gateMid + ((u.uid % 11) - 5) * 18, dt, 0.6); return true;
    }
    if (inside) {
      // 城头告急：上城增援
      const laneAtt = this.laneAtt, laneDef = this.laneDef;
      if (laneAtt > 0 && laneAtt * 1.3 >= laneDef && u.uid % 3 !== 0 && !B.nearestEnemy(u, 120, o => !o.onWall)) return this.toStairs(u, dt, true);
      const ps = B.F.passages();
      const e = B.nearestEnemy(u, ps.length ? 420 : 260, o => !o.onWall);
      if (e) return false;
      if (ps.length) {
        const p = ps[u.uid % ps.length];
        B.steer(u, p.x + 54 + (u.uid % 4) * 14, p.y + ((u.uid % 9) - 4) * 12, dt, 0.8); return true;
      }
      B.steer(u, u.postX ?? sg.wallX + 90, u.postY ?? sg.gateMid, dt, 0.6);
      return true;
    }
    return false;
  }

  laneBrain(u: Unit, dt: number, isAtt: boolean, ranged: boolean): boolean {
    const B = this.B, sg = this.sg;
    const seg = this.segOf(u.y);
    const e = B.nearestEnemy(u, 1000, o => o.onWall && !o.trans && o.y >= seg[0] - 2 && o.y <= seg[1] + 2);
    if (ranged && (!e || Math.abs(e.y - u.y) > 60)) return false; // 弓手照常放箭
    if (e) {
      u.target = e;
      const d = Math.abs(e.y - u.y);
      if (d < u.reach + e.r + 2) { B.meleeHit(u, e); B.slow(u, 0.5); }
      else this.moveLane(u, e.y, dt);
      return true;
    }
    if (isAtt) {
      // 城头已无敌：下城
      return this.toStairs(u, dt, true);
    }
    // 守方：去最危险的云梯口或城门楼
    let gy = u.postY ?? u.y;
    let best = 0;
    for (const L of this.ladders) {
      if (L.state === 'down') continue;
      if (L.y < seg[0] || L.y > seg[1]) continue;
      const threat = (L.state === 'up' ? 3 : 1) + L.threat;
      const dd = Math.abs(L.y - u.y);
      if (dd < 380 && threat / (1 + dd / 200) > best) { best = threat / (1 + dd / 200); gy = L.y + ((u.uid % 5) - 2) * 7; }
    }
    this.moveLane(u, gy, dt);
    return true;
  }
  moveLane(u: Unit, ty: number, dt: number) {
    const B = this.B;
    const dy = ty - u.y;
    if (Math.abs(dy) < 2) { u.vx = u.vy = 0; return; }
    const sp = u.speed * 0.8 * dt;
    const ny = this.laneClamp(u.y, u.y + Math.sign(dy) * Math.min(Math.abs(dy), sp));
    u.vy = (ny - u.y) / Math.max(dt, 1e-3); u.vx = 0;
    u.face = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
    u.y = ny; u.x = this.sg.wallX + (u.side === B.att ? -3 : 3);
  }

  toLadder(u: Unit, dt: number): boolean {
    const B = this.B, sg = this.sg;
    let best: Ladder | null = null, bs = Infinity;
    for (const L of this.ladders) {
      if (L.state !== 'up') continue;
      const s = Math.abs(L.y - u.y) + L.queued * 40 + Math.max(0, sg.wallX - u.x) * 0.2;
      if (s < bs) { bs = s; best = L; }
    }
    if (!best) {
      // 等待：跟在云梯后面，或在城外列队
      const L = this.ladders.find(l => l.state === 'carry' || l.state === 'raise' || l.state === 'down');
      if (L) { const k = u.uid % 12; B.steer(u, L.x - 60 - (k % 4) * 14, L.y + (Math.floor(k / 4) - 1) * 18, dt, 0.8); }
      else if (this.ram && !this.ram.dead) B.steer(u, this.ram.x - 70 - (u.uid % 5) * 12, this.ram.y + ((u.uid % 9) - 4) * 18, dt, 0.8);
      else B.steer(u, sg.wallX - 330, u.sq.ay + ((u.uid % 15) - 7) * 16, dt, 0.7);
      return true;
    }
    best.queued++;
    const bx = sg.wallX - 32, by = best.y;
    const d = Math.hypot(u.x - bx, u.y - by);
    if (d < 16 && best.busy <= 0) {
      best.busy = 0.9;
      u.trans = { kind: 'climb', t: 0, dur: 2.4, x0: u.x, y0: u.y, x1: sg.wallX - 3, y1: by, wall: true, ref: best };
      return true;
    }
    B.steer(u, bx - (d < 40 ? 0 : 6), by + ((u.uid % 5) - 2) * (d < 40 ? 2 : 6), dt);
    return true;
  }

  /** 溃兵从城头逃离：攻方顺云梯滑下，守方走马道 */
  fleeWall(u: Unit, dt: number) {
    if (u.side === this.B.att) {
      const seg = this.segOf(u.y);
      let best: Ladder | null = null, bd = Infinity;
      for (const L of this.ladders) if (L.state === 'up' && L.y >= seg[0] && L.y <= seg[1] && Math.abs(L.y - u.y) < bd) { bd = Math.abs(L.y - u.y); best = L; }
      if (best) {
        if (bd < 6) { u.trans = { kind: 'climb', t: 0, dur: 1.6, x0: u.x, y0: u.y, x1: this.sg.wallX - 34, y1: best.y + ((u.uid % 3) - 1) * 6, wall: false, ref: best }; return; }
        this.moveLane(u, best.y, dt); return;
      }
    }
    this.toStairs(u, dt, true);
  }

  /** 走向马道并上/下城墙。down=true 表示从城头下到城内（或城内的人向上走） */
  toStairs(u: Unit, dt: number, fromInside: boolean): boolean {
    const B = this.B, sg = this.sg;
    if (u.onWall) {
      const seg = this.segOf(u.y);
      const st = sg.stairs.filter(y => y >= seg[0] && y <= seg[1]).sort((a, b) => Math.abs(a - u.y) - Math.abs(b - u.y))[0];
      if (st === undefined) { u.vx = u.vy = 0; return true; }
      if (Math.abs(u.y - st) < 6) { u.trans = { kind: 'stair', t: 0, dur: 1.3, x0: u.x, y0: u.y, x1: sg.wallX + 46, y1: st + 10, wall: false }; return true; }
      this.moveLane(u, st, dt);
      return true;
    }
    if (!fromInside && u.x < sg.wallX) {
      // 先从通道进城
      const ps = B.F.passages(); if (!ps.length) return this.toLadder(u, dt);
      const p = ps[u.uid % ps.length];
      B.steer(u, p.x + 60, p.y, dt);
      return true;
    }
    const st = [...sg.stairs].sort((a, b) => Math.abs(a - u.y) - Math.abs(b - u.y))[0];
    const bx = sg.wallX + 46, by = st + 10;
    if (Math.hypot(u.x - bx, u.y - by) < 12) { u.trans = { kind: 'stair', t: 0, dur: 1.3, x0: u.x, y0: u.y, x1: sg.wallX + (u.side === B.att ? -3 : 3), y1: st, wall: true }; return true; }
    B.steer(u, bx, by, dt);
    return true;
  }

  stepTrans(u: Unit, dt: number) {
    const tr = u.trans!;
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.dur);
    u.x = tr.x0 + (tr.x1 - tr.x0) * k; u.y = tr.y0 + (tr.y1 - tr.y0) * k;
    u.vx = u.vy = 0;
    if (k >= 1) {
      u.trans = undefined; u.onWall = tr.wall;
      if (tr.wall && tr.kind === 'climb') u.foot = this.B.elapsed + 1.5; // 立足：刚登城的人短时更难被击中
      if (tr.wall) u.y = this.laneClamp(u.y, u.y);
    }
  }
  /** 正在攀爬/上下马道的单位的抬升高度 */
  liftOf(u: Unit) {
    const tr = u.trans;
    if (tr) { const k = Math.min(1, tr.t / tr.dur); return tr.wall ? WALL_H * (tr.kind === 'climb' ? k : k) : WALL_H * (1 - k); }
    return u.onWall ? WALL_H : 0;
  }

  // ---------- 绘制 ----------
  render() {
    const B = this.B, sg = this.sg;
    const now = B.time.now;
    for (const L of this.ladders) {
      const g = L.g; g.clear();
      const wood = 0x8a6236, dark = 0x3a2412;
      if (L.state === 'carry' || L.state === 'down') {
        g.setDepth(B.dy(L.y) - 0.0004);
        const x0 = L.x - 30, x1 = L.x + 30;
        g.fillStyle(0x000000, 0.2); g.fillRect(x0, L.y + 2, 60, 6);
        g.lineStyle(2.2, dark, 1); g.lineBetween(x0, L.y - 4, x1, L.y - 4); g.lineBetween(x0, L.y + 3, x1, L.y + 3);
        g.lineStyle(1.4, wood, 1); g.lineBetween(x0, L.y - 4, x1, L.y - 4); g.lineBetween(x0, L.y + 3, x1, L.y + 3);
        for (let x = x0 + 4; x < x1; x += 7) g.lineBetween(x, L.y - 4, x, L.y + 3);
      } else {
        const k = L.state === 'raise' ? 1 - L.t / 2 : 1;
        g.setDepth(B.dy(L.y) + 0.0003);
        const bx = sg.wallX - 34, topX = bx + (sg.wallX - 14 - bx) * k, topY = L.y - WALL_H * k - 4;
        for (const off of [-5, 5]) { g.lineStyle(2.6, dark, 1); g.lineBetween(bx, L.y + off, topX, topY + off); g.lineStyle(1.5, wood, 1); g.lineBetween(bx, L.y + off, topX, topY + off); }
        for (let t = 0.08; t < 1; t += 0.1) { const x = bx + (topX - bx) * t, y = L.y + (topY - L.y) * t; g.lineStyle(1.2, wood, 1); g.lineBetween(x, y - 5, x, y + 5); }
        if (L.push > 0.5) { g.lineStyle(2, 0xff5040, 0.5 + 0.5 * Math.sin(now / 80)); g.strokeCircle(topX, topY, 9); }
      }
    }
    const r = this.ram;
    if (r) {
      const g = r.g; g.clear(); g.setDepth(B.dy(r.y) + 0.0002);
      const x = r.x, y = r.y;
      g.fillStyle(0x000000, 0.25); g.fillEllipse(x + 4, y + 16, 76, 14);
      if (r.dead) {
        g.fillStyle(0x2a1a10, 1); g.fillRect(x - 32, y - 10, 64, 18);
        g.fillStyle(0x111111, 0.8); g.fillRect(x - 26, y - 16, 40, 8);
      } else {
        // 撞木
        const hit = this.gate.broken || this.gate.opened ? 0 : Math.max(0, 1 - (r.cd / 2.4)) ;
        const swing = r.x > sg.wallX - 42 ? Math.sin(Math.min(1, hit) * Math.PI) * 8 : 0;
        g.fillStyle(0x5a3a1e, 1); g.fillRect(x - 20 + swing, y - 6, 66, 9);
        g.fillStyle(0x9a9aa0, 1); g.fillRect(x + 40 + swing, y - 7, 8, 11);
        // 轮子
        g.fillStyle(0x2a1a0c, 1); for (const wx of [-24, 0, 24]) { g.fillCircle(x + wx, y + 12, 6); }
        g.fillStyle(0x6a4a2a, 1); for (const wx of [-24, 0, 24]) g.fillCircle(x + wx, y + 12, 2.5);
        // 棚顶（牛皮）
        g.fillStyle(0x6a4a30, 1); g.fillTriangle(x - 36, y + 2, x + 36, y + 2, x, y - 30);
        g.fillStyle(0x8a6040, 1); g.fillTriangle(x - 30, y, x + 30, y, x, y - 26);
        g.lineStyle(1, 0x2a1a0c, 1); g.strokeTriangle(x - 36, y + 2, x + 36, y + 2, x, y - 30);
        for (let k2 = -2; k2 <= 2; k2++) g.lineBetween(x + k2 * 12, y + 1, x + k2 * 4, y - 22);
        if (r.hp < r.max) { g.fillStyle(0x000000, 0.6); g.fillRect(x - 20, y - 40, 40, 4); g.fillStyle(0xd0a040, 1); g.fillRect(x - 20, y - 40, 40 * r.hp / r.max, 4); }
      }
    }
    for (const gn of this.guns) {
      if (!gn.g) continue;
      const g = gn.g; g.clear(); g.setDepth(B.dy(gn.y) + 0.0002);
      const x = gn.x - gn.recoil * 6, y = gn.y;
      g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y + 9, 50, 10);
      if (gn.hp <= 0) { g.fillStyle(0x2a2420, 1); g.fillRect(x - 18, y - 4, 30, 8); continue; }
      g.fillStyle(0x4a2e18, 1); g.fillRect(x - 16, y - 2, 28, 8);
      g.fillStyle(0x2a1a0c, 1); g.fillCircle(x - 10, y + 7, 6); g.fillCircle(x + 8, y + 7, 6);
      g.fillStyle(0x3a3c40, 1); g.fillRoundedRect(x - 14, y - 10, 38, 9, 4);
      g.fillStyle(0x5a5c62, 1); g.fillRect(x - 12, y - 9, 34, 2);
      g.fillStyle(0x222428, 1); g.fillCircle(x + 24, y - 5.5, 4);
      // 炮手
      g.fillStyle(0x000000, 0.3); g.fillEllipse(x - 24, y + 6, 10, 4);
    }
    // 城门
    const gg = this.gateG;
    if (gg) {
      gg.clear();
      const y0 = sg.gateY0, y1 = sg.gateY1, x = sg.wallX - 12;
      if (this.gate.broken) {
        gg.fillStyle(0x3a2412, 1);
        for (let k = 0; k < 6; k++) gg.fillRect(x - 8 + k * 5, y0 + 8 + k * 15, 14, 5);
      } else if (this.gate.opened) {
        gg.fillStyle(0x5a3a1e, 1); gg.fillRect(x + 4, y0 - 2, 22, 8); gg.fillRect(x + 4, y1 - 6, 22, 8);
      } else {
        gg.fillStyle(0x4a2c16, 1); gg.fillRect(x, y0, 12, y1 - y0);
        gg.fillStyle(0x6a4226, 1); gg.fillRect(x + 2, y0 + 2, 8, y1 - y0 - 4);
        gg.fillStyle(0xb8a070, 1); for (let yy = y0 + 8; yy < y1 - 4; yy += 10) { gg.fillCircle(x + 4, yy, 1.2); gg.fillCircle(x + 8, yy + 5, 1.2); }
        gg.lineStyle(1, 0x1c130b, 1); gg.strokeRect(x, y0, 12, y1 - y0);
        if (this.gate.hp < this.gate.max) {
          const f = this.gate.hp / this.gate.max;
          gg.fillStyle(0x000000, 0.6); gg.fillRect(sg.wallX - 30, y0 - 60, 60, 5);
          gg.fillStyle(f > 0.5 ? 0xd0a040 : 0xd04030, 1); gg.fillRect(sg.wallX - 30, y0 - 60, 60 * f, 5);
        }
      }
      if (this.winch > 0) { gg.lineStyle(3, 0xffe080, 0.9); gg.beginPath(); gg.arc(sg.wallX + 40, sg.gateMid, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.winch / 4)); gg.strokePath(); }
      // 受损城段
      for (const s of sg.sections) if (!s.broken && s.hp < s.max) {
        const f = s.hp / s.max;
        gg.fillStyle(0x000000, 0.55); gg.fillRect(sg.wallX - 40, (s.y0 + s.y1) / 2 - WALL_H - 14, 26, 4);
        gg.fillStyle(f > 0.5 ? 0xd0a040 : 0xd04030, 1); gg.fillRect(sg.wallX - 40, (s.y0 + s.y1) / 2 - WALL_H - 14, 26 * f, 4);
      }
    }
  }
  /** 炮弹（在投射物层绘制） */
  drawBalls(g: Phaser.GameObjects.Graphics) {
    for (const b of this.balls) {
      const k = b.t / b.dur;
      const x = b.x0 + (b.x1 - b.x0) * k, y = b.y0 + (b.y1 - b.y0) * k;
      const arc = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * 0.12;
      const z = b.z0 + (b.z1 - b.z0) * k + arc * 4 * k * (1 - k);
      g.fillStyle(0x000000, 0.3); g.fillEllipse(x, y, 6, 3);
      g.fillStyle(0x1a1a1c, 1); g.fillCircle(x, y - z, 3.2);
      g.fillStyle(0x6a6a70, 1); g.fillCircle(x - 1, y - z - 1, 1.1);
    }
  }
}
