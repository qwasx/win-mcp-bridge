// 第十六步：三图往来
// - 天南 ⇄ 大晋：走到天南北缘（慕兰草原尽头）/ 大晋南缘（天澜草原），横穿草原，耗时约四个月
// - 天南 ⇄ 乱星海：越京城外灵石矿洞的上古传送阵 ⇄ 魁星岛的上古传送阵；须持“大挪移令”并灌注灵石（原著设定）
// - 换图 = 把目标图与落脚点写进存档，重新载入（所有地形、植被、NPC 缓存都按新图重建，最稳妥）
import type { Game } from './game';
import {
  ACTIVE_MAP, MAP_NAME, MAP_EXITS, EDGE_BLOCK_TEXT, PORTALS, MapId, LocDef, locHere, LOC_BY_ID,
  WORLD_SCALE, WORLD_W, WORLD_H, fromMap, toMap, mapSize,
} from '../data/world';
import * as C from './cultivation';
import type { Msg } from './cultivation';
import type { DNode } from './modal';

export interface TravelPending { map: MapId; x: number; y: number; via: 'portal' | 'edge' }

// ---------- 迷雾存档：行程编码（'r' 前缀；旧存档为逐格 0/1 字符串） ----------
export function encodeFog(a: Uint8Array): string {
  let out = 'r', cur = 0, run = 0;
  for (let i = 0; i < a.length; i++) { const v = a[i] ? 1 : 0; if (v === cur) run++; else { out += run.toString(36) + ','; cur = v; run = 1; } }
  return out + run.toString(36);
}
export function decodeFog(s: string | undefined, into: Uint8Array) {
  into.fill(0);
  if (!s) return;
  if (s[0] !== 'r') { for (let i = 0; i < Math.min(s.length, into.length); i++) into[i] = s[i] === '1' ? 1 : 0; return; }
  let i = 0, v = 0;
  for (const part of s.slice(1).split(',')) { const n = parseInt(part, 36) || 0; if (v) into.fill(1, i, Math.min(into.length, i + n)); i += n; v ^= 1; }
}

export class Travel {
  game: Game;
  pending: TravelPending | null = null;
  /** 最近一帧的移动方向（由 Game 写入） */
  dir = { x: 0, y: 0 };
  private edgeT = 0; private hintT = 0; private hinted = '';
  constructor(game: Game) { this.game = game; }

  update(dt: number) {
    const g = this.game, p = g.player;
    if (g.halted || this.pending) return;
    // 地图边缘：持续朝外走 0.7 秒 → 询问 / 提示
    const m = 360, d = this.dir;
    const edge = !p.moving ? null : p.y < m && d.y < -0.3 ? 'n' : p.y > WORLD_H - m && d.y > 0.3 ? 's' : p.x < m && d.x < -0.3 ? 'w' : p.x > WORLD_W - m && d.x > 0.3 ? 'e' : null;
    if (edge) this.edgeT += dt; else this.edgeT = Math.min(0, this.edgeT + dt);
    if (edge && this.edgeT > 0.7) { this.edgeT = -4; this.onEdge(edge); }
    // 走近传送阵：提示一次
    this.hintT -= dt;
    if (this.hintT <= 0) {
      this.hintT = 1;
      const pt = this.nearPortal();
      if (pt && this.hinted !== pt.here.id) { this.hinted = pt.here.id; g.toast(`此地有一座上古传送阵——按 T 或 G 上前查看。`, 'good'); }
      if (!pt) this.hinted = '';
    }
  }

  // ---------------------------------------------------------------- 边缘
  private onEdge(edge: 'n' | 's' | 'e' | 'w') {
    const g = this.game;
    const ex = MAP_EXITS[ACTIVE_MAP].find((e) => e.edge === edge);
    if (!ex) { g.toast(EDGE_BLOCK_TEXT[ACTIVE_MAP], 'warn'); return; }
    if (g.pursuit?.active) { g.toast('身后追兵未甩脱，此时远行无异于引狼入室。', 'warn'); return; }
    const weak = ex.to === 'dajin' && g.hero.realm < 3;
    g.openDialog({
      speaker: ex.title, title: `${MAP_NAME[ACTIVE_MAP]} → ${MAP_NAME[ex.to]}`, mood: 'mystic',
      text: ex.text + (weak ? '\n\n（以你现在的修为，草原上随便一位法士都能取你性命——想清楚了再走。）' : ''),
      options: [
        { label: `启程（约 ${ex.days} 日）`, tone: 'gold', act: () => { this.crossEdge(ex.to, ex.days); return null; } },
        { label: '暂且不去', act: () => null },
      ],
    });
  }
  /** 横穿边境：落在目标图相对应的边缘，经度对齐 */
  crossEdge(to: MapId, days: number) {
    const p = this.game.player;
    const [lx] = fromMap(ACTIVE_MAP, p.x / WORLD_SCALE, p.y / WORLD_SCALE);
    const [tx] = toMap(to, lx, 0);
    const S = mapSize(to);
    const north = ACTIVE_MAP === 'tiannan';   // 天南 → 大晋：落在大晋南缘；反之落在天南北缘
    const x = Math.min(S.W - 4, Math.max(4, tx)) * WORLD_SCALE, y = (north ? S.H - 5 : 5) * WORLD_SCALE;
    this.go(to, x, y, days, 'edge');
  }

  // ---------------------------------------------------------------- 传送阵
  nearPortal(): { def: typeof PORTALS[number]; here: LocDef; there: LocDef } | null {
    const p = this.game.player;
    for (const def of PORTALS) {
      const a = locHere(def.a), b = locHere(def.b), here = a ?? b;
      if (!here) continue;
      const there = LOC_BY_ID.get(a ? def.b : def.a); if (!there) continue;
      if (Math.hypot(here.x * WORLD_SCALE - p.x, here.y * WORLD_SCALE - p.y) < 1500) return { def, here, there };
    }
    return null;
  }
  /** T / G：在传送阵旁则打开传送阵对话，返回 true */
  tryPortal(): boolean {
    const pt = this.nearPortal(); if (!pt) return false;
    this.game.openDialog(this.portalNode(pt));
    return true;
  }
  private portalNode(pt: NonNullable<ReturnType<Travel['nearPortal']>>): DNode {
    const g = this.game, h = g.hero, f = g.ws.flags as any, { def, here, there } = pt;
    const head = { speaker: here.name, title: `上古传送阵 · 通往${MAP_NAME[there.map]}`, mood: 'mystic' as const };
    if (h.realm < def.minRealm) return { ...head, text: '阵台由整块青灰古玉砌成，阵纹古拙繁复，层层禁制若隐若现。\n\n以你炼气期的修为，连阵眼在何处都看不出来，更别说催动它了。（需筑基期）', options: [{ label: '离开', act: () => null }] };
    if (!C.bagCount(h, def.token)) {
      if (here.id === 'chuansong' && !f.danuoyi) {
        return { ...head, text: '矿洞最深处，阵台旁倚着一具枯骨，衣衫早已朽烂，指骨却仍死死攥着一块巴掌大的古朴令牌，令上“大挪移”三字隐隐生光。\n\n看骨骼形制，此人生前修为极高，却身负重伤，似是从远方传送而来，终究没能撑过去。', options: [
          { label: '取下令牌', tone: 'gold', act: () => { C.addItem(h, def.token, 1); f.danuoyi = 1; g.toast('获得「大挪移令」——开启上古传送阵的钥匙。', 'good'); g.news('韩立在灵石矿洞深处得到了一块大挪移令。', 'personal'); return this.portalNode(pt); } },
          { label: '离开', act: () => null },
        ] };
      }
      return { ...head, text: '阵台中央有一处令牌形状的凹槽。没有“大挪移令”，这座古阵便只是一堆死物。', options: [{ label: '离开', act: () => null }] };
    }
    const have = C.bagCount(h, 'mat_lingshi'), chased = !!g.pursuit?.active;
    return { ...head, text: `大挪移令嵌入阵眼，阵纹一道道亮起。要催动这座古阵，须灌注 ${def.cost} 块下品灵石。\n\n阵光的另一端，是${MAP_NAME[there.map]}的「${there.name}」——${there.desc.slice(0, 40)}……${chased ? '\n\n（身后追兵转瞬即至——此刻正是脱身的良机！）' : ''}`, options: [
      { label: `开启传送阵（${def.cost} 灵石，你有 ${have}）`, tone: 'gold', disabled: have < def.cost, act: () => { C.removeItem(h, 'mat_lingshi', def.cost); if (chased) g.pursuit.reset(); this.go(there.map, there.x * WORLD_SCALE, there.y * WORLD_SCALE, 0, 'portal'); return null; } },
      { label: '离开', act: () => null },
    ] };
  }

  // ---------------------------------------------------------------- 动身
  go(to: MapId, x: number, y: number, days: number, via: 'portal' | 'edge') {
    const g = this.game;
    if (days > 0) {
      const msgs: Msg[] = [];
      C.passDays(g.hero, days, false, 1, msgs);
      g.day += days; g.npcs.daily(days);
    }
    this.pending = { map: to, x, y, via };
    g.combat.reset(); g.pursuit?.reset();
    g.save(0);
    g.news(via === 'portal' ? `韩立催动上古传送阵，远赴${MAP_NAME[to]}。` : `韩立${to === 'dajin' ? '横穿天澜草原，北上大晋' : '穿越草原，回到天南'}。`, 'personal');
    g.save(0);
    if (g.onTravel) g.onTravel(to, via);
    else g.switchMap(to);
  }
}
