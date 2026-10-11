// 长城：关隘、城墙格、通行规则、缺口、烽火
import type { GameState, Party, Settlement } from './state';
import {
  GREAT_WALL, CELL, GW, GH, ll, buildGrid, wallSeg, gateCell, regionGrid, setWallRule, grid, TER_SPEED, cellIndex, nearestPassable,
} from './terrain';
import { S, log, factionHostileToSettlement, playerHostileToSettlement, player, isNight, lordName, playerSide, settlementList } from './game';
import { FACTION } from '../data/world';
import { count, healthy } from './party';

type P = [number, number];

/** 关隘：existing 表示沿用原有城堡 */
export const PASSES: { id: string; name: string; lon: number; existing?: boolean; desc: string }[] = [
  { id: 'jiayu', name: '嘉峪关', lon: 98.2, desc: '天下第一雄关，扼河西走廊西端。' },
  { id: 'huama', name: '花马池', lon: 107.3, desc: '宁夏东路要隘，套虏入寇必经之地。' },
  { id: 'yulin', name: '榆林', lon: 109.73, existing: true, desc: '九边重镇，镇北台雄踞长城之上。' },
  { id: 'piantou', name: '偏头关', lon: 111.5, desc: '外三关之首，黄河在此入塞。' },
  { id: 'shahu', name: '杀虎口', lon: 112.4, desc: '晋北锁钥，西口古道由此出塞。' },
  { id: 'zhangjia', name: '张家口', lon: 114.88, desc: '宣府北门，茶马互市之所。' },
  { id: 'juyong', name: '居庸关', lon: 116.1, desc: '太行八陉之一，京师北门。' },
  { id: 'gubei', name: '古北口', lon: 117.15, desc: '燕山要冲，京师东北屏障。' },
  { id: 'xifeng', name: '喜峰口', lon: 118.4, desc: '滦河谷口，昔年金兵入塞之路。' },
  { id: 'shanhai', name: '山海关', lon: 119.75, existing: true, desc: '天下第一关，京师与辽东之咽喉。' },
];

const SEG = 64; // 每段城墙长度（像素）
export interface WallSegInfo { x: number; y: number; nx: number; ny: number; gate: number }
export const SEGS: WallSegInfo[] = [];
let built = false;

/** 在长城折线上取某经度处的点 */
export function wallPointAtLon(lon: number): P {
  for (let i = 0; i < GREAT_WALL.length - 1; i++) {
    const [a, b] = [GREAT_WALL[i], GREAT_WALL[i + 1]];
    if ((lon - a[0]) * (lon - b[0]) <= 0) { const t = (lon - a[0]) / (b[0] - a[0] || 1); return ll(lon, a[1] + (b[1] - a[1]) * t); }
  }
  return ll(GREAT_WALL[0][0], GREAT_WALL[0][1]);
}

export function buildWall() {
  if (built) return;
  buildGrid();
  built = true;
  const pts = GREAT_WALL.map(([lo, la]) => ll(lo, la));
  // 栅格化（保证四连通，阻断八方向移动）
  let acc = 0, prev = -1;
  const mark = (gx: number, gy: number, seg: number) => { if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return; const i = gy * GW + gx; if (wallSeg[i] < 0) wallSeg[i] = seg; };
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 2);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const seg = Math.floor((acc + L * t) / SEG);
      while (SEGS.length <= seg) SEGS.push({ x, y, nx: -(y1 - y0) / L, ny: (x1 - x0) / L, gate: -1 });
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), ci = gy * GW + gx;
      if (prev >= 0 && ci !== prev) {
        const px = prev % GW, py = (prev / GW) | 0;
        if (px !== gx && py !== gy) mark(px, gy, seg);
      }
      mark(gx, gy, seg);
      prev = ci;
    }
    acc += L;
  }
  // 段中心
  const sums = SEGS.map(() => [0, 0, 0]);
  for (let i = 0; i < GW * GH; i++) if (wallSeg[i] >= 0) { const s = sums[wallSeg[i]]; s[0] += (i % GW) * CELL + CELL / 2; s[1] += ((i / GW) | 0) * CELL + CELL / 2; s[2]++; }
  sums.forEach((s, k) => { if (s[2]) { SEGS[k].x = s[0] / s[2]; SEGS[k].y = s[1] / s[2]; } });
  // 关隘门洞
  PASSES.forEach((ps, k) => {
    const [px, py] = wallPointAtLon(ps.lon);
    for (let i = 0; i < GW * GH; i++) {
      if (wallSeg[i] < 0) continue;
      const cx = (i % GW) * CELL + CELL / 2, cy = ((i / GW) | 0) * CELL + CELL / 2;
      if (Math.hypot(cx - px, cy - py) < CELL * 1.6) { gateCell[i] = k; SEGS[wallSeg[i]].gate = k; }
    }
  });
  // 关内/关外：从开封出发洪水填充
  const [kx, ky] = ll(114.3, 34.8);
  const start = cellIndex(kx, ky);
  const q = [start]; regionGrid[start] = 1;
  while (q.length) {
    const c = q.pop()!, cx = c % GW, cy = (c / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const ni = ny * GW + nx;
      if (regionGrid[ni] || wallSeg[ni] >= 0 || TER_SPEED[grid[ni]] <= 0) continue;
      if (dx && dy && (wallSeg[cy * GW + nx] >= 0 || wallSeg[ny * GW + cx] >= 0)) continue;
      regionGrid[ni] = 1; q.push(ni);
    }
  }
  for (let i = 0; i < GW * GH; i++) if (!regionGrid[i] && wallSeg[i] < 0 && TER_SPEED[grid[i]] > 0) regionGrid[i] = 2;
  setWallRule(rule);
}

// ---------- 通行规则 ----------
export interface Who { f: string; player: boolean; sneak: boolean; army?: boolean }
export function whoOf(p: Party): Who {
  return { f: p.kind === 'player' ? (playerSide() ?? 'player') : p.faction, player: p.kind === 'player', sneak: (p.kind === 'player' || p.kind === 'bandit') && count(p.troops) <= 30, army: p.kind === 'lord' };
}
export function passSettlement(k: number): Settlement | undefined { return S.settlements[PASSES[k]?.id]; }
export function gateOpenFor(k: number, who: Who) {
  const st = passSettlement(k);
  if (!st) return true;
  if (who.player) return !playerHostileToSettlement(st);
  if (who.army) return st.faction === who.f; // 关门只为自家兵马而开：外邦大军即便未曾交战也不得入关
  return !factionHostileToSettlement(who.f, st);
}
/** 缺口修到三成以上才算堵上（约三日） */
export const BREACH_OPEN = 30;
export function isBreached(k: number) { const h = S.wallHp?.[k]; return h !== undefined && h < BREACH_OPEN; }
function rule(ci: number, w: unknown): number {
  const who = w as Who;
  const sg = wallSeg[ci];
  if (sg < 0) return 1;
  const k = gateCell[ci];
  if (k >= 0) return gateOpenFor(k, who) ? 1 : 0;
  if (isBreached(sg)) return 1;
  return who.sneak ? 2 : 0;
}

export function regionAt(x: number, y: number) { const ci = cellIndex(x, y); return ci < 0 ? 0 : regionGrid[ci]; }
/** 势力 f 能否从 a 走到 b（粗略：同侧，或有打开的关隘/缺口） */
export function reachableFor(who: Who, ax: number, ay: number, bx: number, by: number) {
  const ra = regionAt(ax, ay), rb = regionAt(bx, by);
  if (!ra || !rb || ra === rb) return true;
  if (S.wallHp?.some(h => h < BREACH_OPEN)) return true;
  return PASSES.some((_, k) => gateOpenFor(k, who));
}

// ---------- 状态 ----------
export function ensureWall(s: GameState) {
  buildWall();
  if (!s.wallHp || s.wallHp.length !== SEGS.length) s.wallHp = SEGS.map(() => 100);
  s.beacons ||= [];
}
export function breaches() { return (S.wallHp ?? []).map((h, i) => (h < BREACH_OPEN ? i : -1)).filter(i => i >= 0); }
export function nearestPassName(x: number, y: number) {
  let best = PASSES[0].name, bd = Infinity;
  for (const ps of PASSES) { const [px, py] = wallPointAtLon(ps.lon); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = ps.name; } }
  return best;
}
/** 拥有这段城墙的势力（最近关隘的主人） */
export function wallOwnerAt(x: number, y: number): string {
  let best: Settlement | undefined, bd = Infinity;
  PASSES.forEach((ps, k) => { const st = passSettlement(k); if (!st) return; const [px, py] = wallPointAtLon(ps.lon); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = st; } });
  return best?.faction ?? 'ming';
}
export function breachWall(seg: number, by?: Party) {
  if (!S.wallHp || S.wallHp[seg] === undefined || isBreached(seg) || SEGS[seg].gate >= 0) return;
  S.wallHp[seg] = 0;
  const sg = SEGS[seg];
  lightBeacon(sg.x, sg.y, 72);
  log(`${by ? (by.lordId ? `${FACTION[by.faction]?.name ?? ''}${lordName(by.lordId)}` : by.name) : '敌军'}在${nearestPassName(sg.x, sg.y)}附近拆毁边墙，打开了一道缺口！`, 'war');
}
export function repairSegment(seg: number) { if (S.wallHp) S.wallHp[seg] = 100; }
export function lightBeacon(x: number, y: number, hours = 48) {
  S.beacons ||= [];
  if (S.beacons.some(b => Math.hypot(b.x - x, b.y - y) < 80 && b.until > S.time)) return;
  S.beacons.push({ x, y, until: S.time + hours });
}
/** 找一段可拆的城墙（离关隘较远、离 p 最近），返回段号与本侧的站位 */
export function pickBreachSeg(p: Party): { seg: number; x: number; y: number } | null {
  const myReg = regionAt(p.x, p.y);
  let best = -1, bd = Infinity;
  SEGS.forEach((sg, k) => {
    if (sg.gate >= 0 || isBreached(k)) return;
    const d = Math.hypot(sg.x - p.x, sg.y - p.y);
    if (d < bd) { bd = d; best = k; }
  });
  if (best < 0 || bd > 900) return null;
  const sg = SEGS[best];
  for (const side of [1, -1]) {
    const [x, y] = nearestPassable(sg.x + sg.nx * 26 * side, sg.y + sg.ny * 26 * side);
    if (regionAt(x, y) === myReg) return { seg: best, x, y };
  }
  return null;
}

/** 每小时：烽火（敌军入塞）、清理过期烽火 */
export function wallHourly() {
  if (!S.beacons) return;
  S.beacons = S.beacons.filter(b => b.until > S.time);
  for (const p of S.parties) {
    if (p.inside) continue;
    const r = regionAt(p.x, p.y);
    if (!r) continue;
    const prev = p.reg;
    p.reg = r;
    if (prev === 2 && r === 1 && p.kind === 'lord') {
      const owner = wallOwnerAt(p.x, p.y);
      if (owner === p.faction) continue;
      lightBeacon(p.x, p.y - 30, 48);
      const pp = player();
      const near = Math.hypot(pp.x - p.x, pp.y - p.y) < 900;
      const side = playerSide();
      if (near || side === owner || owner === 'player') {
        const gate = settlementList().find(s => s.isPass && Math.hypot(s.x - p.x, s.y - p.y) < 45);
        const how = gate ? `经由${gate.name}` : `从${nearestPassName(p.x, p.y)}附近的边墙破口`;
        log(`烽火台狼烟四起——${FACTION[p.faction]?.name ?? ''}${lordName(p.lordId ?? null)}部${count(p.troops)}人${how}入塞了！`, 'bad');
      }
    }
  }
}
/** 每日：边墙自行修缮（无敌军在旁时，十日修好一段） */
export function wallDaily() {
  if (!S.wallHp) return;
  S.wallHp.forEach((h, k) => {
    if (h > 0 && h >= 100) return;
    const sg = SEGS[k];
    const owner = wallOwnerAt(sg.x, sg.y);
    const enemyNear = S.parties.some(p => !p.inside && p.kind === 'lord' && Math.hypot(p.x - sg.x, p.y - sg.y) < 160 && p.faction !== owner);
    if (!enemyNear) S.wallHp![k] = Math.min(100, h + 10);
  });
}
/** 关隘关税：玩家拥有的关隘每周收入 */
export function passToll(): { name: string; gold: number }[] {
  const out: { name: string; gold: number }[] = [];
  PASSES.forEach((ps, k) => { const st = passSettlement(k); if (st && st.owner === 'player') out.push({ name: ps.name, gold: 160 + Math.round(st.prosperity * 2) }); });
  return out;
}
/** 夜间潜越提示（玩家被城墙挡住） */
export function sneakHint(p: Party) { return p.kind === 'player' && !isNight() && whoOf(p).sneak; }
void healthy;
