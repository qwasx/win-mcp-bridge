// 实时战斗执行器：在一个线程（worker 或主线程）里以 20Hz 推进若干场战斗，产出每个玩家的下行帧
import { BattleCore, TICK, type CoreOpts, type PartyIn, type HeroInput, type Group, type Order, type Form, type CmdResult, type CoreResult } from '../src/battle/core';

/** 主线程 → 执行器 */
export type RunIn =
  | { k: 'new'; bid: number; opts: CoreOpts; parts: PartyIn[]; total: number }
  | { k: 'join'; bid: number; part: PartyIn }
  | { k: 'in'; bid: number; acct: string; inp: HeroInput }
  | { k: 'cmd'; bid: number; acct: string; c: { o?: Order; f?: Form; g?: Group; gs?: Group[]; mv?: [number, number] } }
  | { k: 'view'; bid: number; acct: string; v: [number, number, number, number] }
  | { k: 'online'; bid: number; acct: string; on: boolean }
  | { k: 'retreat'; bid: number; acct: string }
  | { k: 'resync'; bid: number; acct: string }
  | { k: 'abort'; bid: number };

/** 执行器 → 主线程 */
export type RunOut =
  | { k: 'json'; bid: number; to: string[]; m: any }
  | { k: 'bin'; bid: number; acct: string; buf: Uint8Array }
  | { k: 'left'; bid: number; res: CmdResult }
  | { k: 'end'; bid: number; res: CoreResult }
  | { k: 'stat'; bid: number; n: [number, number]; ms: number; units: number; bytes: number };

export class BattleRunner {
  cores = new Map<number, BattleCore>();
  timer: ReturnType<typeof setInterval> | null = null;
  last = 0;
  acc = 0;
  statT = 0;
  costMs = new Map<number, number>();
  constructor(public emit: (batch: RunOut[]) => void) { }

  handle(m: RunIn, out: RunOut[] = []) {
    if (m.k === 'new') {
      const core = new BattleCore(m.opts, m.total);
      core.start(m.parts);
      this.cores.set(m.bid, core);
      for (const c of core.cmds.values()) if (c.online) out.push({ k: 'json', bid: m.bid, to: [c.acct], m: { t: 'bstart', bid: m.bid, init: core.initMsg(c.acct) } });
      this.ensureTimer();
      return out;
    }
    const core = this.cores.get(m.bid);
    if (!core) return out;
    switch (m.k) {
      case 'join': {
        if (!core.join(m.part)) break;
        const sp = core.endTick();
        this.flushOut(m.bid, core, sp, out);
        if (m.part.acct && m.part.online) out.push({ k: 'json', bid: m.bid, to: [m.part.acct], m: { t: 'bstart', bid: m.bid, init: core.initMsg(m.part.acct), joined: true } });
        break;
      }
      case 'in': core.input(m.acct, m.inp); break;
      case 'cmd': {
        const c = m.c; const gs = (c.gs ?? ['inf', 'rng', 'cav']).filter(g => g === 'inf' || g === 'rng' || g === 'cav');
        if (c.o) core.order(m.acct, gs, c.o);
        else if (c.mv) core.moveOrder(m.acct, gs, c.mv[0], c.mv[1]);
        else if (c.f && c.g) core.setForm(m.acct, c.g, c.f);
        break;
      }
      case 'view': core.setView(m.acct, m.v[0], m.v[1], m.v[2], m.v[3]); break;
      case 'online': core.setOnline(m.acct, m.on); if (m.on) out.push({ k: 'json', bid: m.bid, to: [m.acct], m: { t: 'bstart', bid: m.bid, init: core.initMsg(m.acct), resume: true } }); break;
      case 'resync': core.cmds.get(m.acct)?.viewer?.reset(); out.push({ k: 'json', bid: m.bid, to: [m.acct], m: { t: 'bstart', bid: m.bid, init: core.initMsg(m.acct), resume: true } }); break;
      case 'retreat': { const r = core.retreat(m.acct); if (r) out.push({ k: 'left', bid: m.bid, res: r }); core.checkEnd(); this.checkDone(m.bid, core, out); break; }
      case 'abort': core.autoFinish(); this.checkDone(m.bid, core, out); break;
    }
    return out;
  }

  ensureTimer() {
    if (this.timer) return;
    this.last = performance.now(); this.acc = 0;
    this.timer = setInterval(() => this.loop(), 25);
  }

  loop() {
    const now = performance.now();
    this.acc += Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (this.acc < TICK) return;
    const out: RunOut[] = [];
    let steps = 0;
    while (this.acc >= TICK && steps < 3) {
      this.acc -= TICK; steps++;
      for (const [bid, core] of this.cores) {
        const a = performance.now();
        core.step(TICK);
        const sp = core.endTick();
        this.flushOut(bid, core, sp, out);
        // 每个在线玩家的增量帧
        for (const c of core.cmds.values()) {
          if (!c.online || c.left) continue;
          const f = core.frameFor(c);
          if (f) out.push({ k: 'bin', bid, acct: c.acct, buf: f });
        }
        this.costMs.set(bid, (this.costMs.get(bid) ?? 0) * 0.9 + (performance.now() - a) * 0.1);
        this.checkDone(bid, core, out);
      }
    }
    if (this.acc > TICK * 3) this.acc = 0; // 过载：丢弃积压，宁慢勿卡
    this.statT -= steps * TICK;
    if (this.statT <= 0) {
      this.statT = 2;
      for (const [bid, core] of this.cores) {
        let units = 0; for (const u of core.units) if (!u.dead && !u.fled) units++;
        let bytes = 0; for (const c of core.cmds.values()) { bytes += c.viewer?.bytes ?? 0; if (c.viewer) c.viewer.bytes = 0; }
        out.push({ k: 'stat', bid, n: [core.activeCount(0), core.activeCount(1)], ms: +(this.costMs.get(bid) ?? 0).toFixed(2), units, bytes });
      }
    }
    if (out.length) this.emit(out);
    if (!this.cores.size && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  flushOut(bid: number, core: BattleCore, sp: ReturnType<BattleCore['endTick']>, out: RunOut[]) {
    const live = [...core.cmds.values()].filter(c => c.online && !c.left).map(c => c.acct);
    if (sp.spawned.length && live.length) out.push({ k: 'json', bid, to: live, m: { t: 'bspawn', u: sp.spawned } });
    for (const o of sp.out) {
      const to = o.to === null ? live : live.includes(o.to) ? [o.to] : [];
      if (to.length) out.push({ k: 'json', bid, to, m: o.m });
    }
  }

  checkDone(bid: number, core: BattleCore, out: RunOut[]) {
    if (!core.finished || !core.result) return;
    const sp = core.endTick();
    this.flushOut(bid, core, sp, out);
    out.push({ k: 'end', bid, res: core.result });
    this.cores.delete(bid);
    this.costMs.delete(bid);
  }
}
