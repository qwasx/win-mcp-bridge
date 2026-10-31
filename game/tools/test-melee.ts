// 第三十九步：混战测试——派系互斗、索敌分流、同阵不伤你、NPC 互杀不算你的、前线两阵对垒、异宝出世
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { cultivator, newTeam } = await import('../src/world/melee');
const { WARS } = await import('../src/world/war') as any;
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === 'qixuan')!;
g.hero.realm = 2; g.hero.stage = 1;
const X0 = l.x * WORLD_SCALE + 1400, Y0 = l.y * WORLD_SCALE + 900;
g.teleport(X0, Y0);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); g.paused = false;
const c = g.combat, p = g.player, h = g.hero;
let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const reset = () => { c.enemies.length = 0; c.allies.length = 0; c.projs.length = 0; c.foe.hz.length = 0; g.teleport(X0, Y0); h.hp = 1; h.dead = false; };
// 计数器
let nanN = 0; let npcHits = 0, allyHurtsP = 0, pHits = 0, npcKills = 0, renderErr = 0;
const oNpc = c.npcHit.bind(c); c.npcHit = (...a: any[]) => { npcHits++; return oNpc(...a); };
const oHp = c.hitPlayer.bind(c); c.hitPlayer = (raw: number, r: number, st: any, fx: number, fy: number, src?: any) => { pHits++; if (src?.ally) allyHurtsP++; return oHp(raw, r, st, fx, fy, src); };
const oNK = c.onNpcKill; c.onNpcKill = (e: any, by: any) => { npcKills++; oNK?.(e, by); };
const run = (sec: number, each?: () => void) => { for (let i = 0; i < sec * 30; i++) { g.modal = null; h.hp = Math.max(h.hp, 0.6); h.dead = false; c.invulnT = 99; g.update(1 / 30); each?.(); for (const u of c.units) if (!(u.x === u.x && u.y === u.y) && !(u as any)._nanRep) { (u as any)._nanRep = 1; nanN++; console.log('NaN unit', u.name, u.ally, u.team, u.def.id, u.cast?.sk?.k, u.kx, u.ky, u.mvx, u.hp, u.tgE?.name); } if (i % 30 === 0) { try { g.renderer.render(1 / 30); } catch (e) { renderErr++; if (renderErr < 3) console.log('render err', e); } } } };
const mkC = (dx: number, dy: number, team: string | undefined, r = 2, st = 1, sch = 'sanxiu') => { const e = cultivator(p.x + dx, p.y + dy, r, st, sch, team ?? '野修'); e.team = team; e.aggro = true; c.enemies.push(e); return e; };

// 1) 两路人马 + 你：彼此厮杀，不是都冲你
reset(); npcHits = 0; pHits = 0; npcKills = 0;
const A = newTeam('a'), B = newTeam('b');
const ta = [mkC(-420, -60, A, 2, 1, 'huangfeng'), mkC(-460, 80, A, 2, 0, 'huangfeng')];
const tb = [mkC(420, -40, B, 2, 1, 'guiling'), mkC(460, 90, B, 2, 0, 'guiling')];
let onP = 0, samples = 0, firstDeath = -1, tt = 0;
const kills0 = h.kills ?? 0;
run(45, () => { tt += 1 / 30; const both = ta.some((e) => !e.dead) && tb.some((e) => !e.dead); if (both) for (const e of [...ta, ...tb]) if (!e.dead && e.aggro) { samples++; if (e.tgP) onP++; } if (firstDeath < 0 && [...ta, ...tb].some((e) => e.dead)) firstDeath = tt; });
const hurtA = ta.some((e) => e.hp < e.maxHp || e.dead), hurtB = tb.some((e) => e.hp < e.maxHp || e.dead);
console.log(`  NPC互击 ${npcHits} 次，打你 ${pHits} 次；锁你的比例 ${(onP / Math.max(1, samples) * 100).toFixed(0)}%；首个阵亡 ${firstDeath.toFixed(1)}s；NPC 互杀 ${npcKills}`);
ok(npcHits > 20, '两派修士彼此出手（NPC 互击）');
ok(hurtA && hurtB, '双方都挂了彩');
ok(onP / Math.max(1, samples) < 0.6, '不是所有人都冲着你（锁你的时间 < 60%）');
ok(firstDeath > 0 && firstDeath < 45, `混战能分出死伤（${firstDeath.toFixed(1)}s）`);
ok((h.kills ?? 0) === kills0, 'NPC 互杀不记作你的击杀');

// 2) 野怪（未编派系、未发怒）不会被卷进来；同派系不互打
reset(); npcHits = 0;
const t1 = newTeam('t');
const m1 = mkC(-200, 0, t1), m2 = mkC(200, 0, t1);
run(6);
ok(npcHits === 0, '同一派系的人不互相出手');
ok(!c.hostile(m1, m2), 'hostile(同派) = false');

// 3) 同阵修士：跟着你、打敌人、绝不伤你，也不在你的索敌列表里
reset(); npcHits = 0; allyHurtsP = 0;
const al = [0, 1, 2].map((i) => { const e = cultivator(p.x - 200 + i * 60, p.y + 120, 2, 1, 'huangfeng', '同门'); return c.addAlly(e); });
ok(al.every((e: any) => !c.enemies.includes(e)), '同阵修士不在 enemies 里（你的法术 / 法宝 / 灵宠碰不到）');
ok(c.aim(600).target == null, '没有敌人时不会锁到同阵');
g.teleport(p.x + 900, p.y); run(4);
const follow = al.filter((e: any) => Math.hypot(e.x - p.x, e.y - p.y) < 700).length;
ok(follow >= 2, `没仗打时跟在你身边（${follow}/3 已跟上）`);
const foes = [mkC(500, 0, undefined, 2, 1, 'guiling'), mkC(560, 120, undefined, 2, 0, 'guiling'), mkC(540, -120, undefined, 2, 0, 'hehuan')];
run(40);
const allyDmg = foes.filter((e: any) => e.hp < e.maxHp || e.dead).length;
console.log(`  同阵出手 ${npcHits} 次，敌人受伤 ${allyDmg}/3，同阵伤你 ${allyHurtsP} 次`);
ok(npcHits > 10 && allyDmg >= 2, '同阵修士与敌人交手');
ok(allyHurtsP === 0, '同阵修士的招式从不伤你');

// 4) 前线两阵对垒
reset(); npcHits = 0;
const w = WARS[0]; const W: any = g.war; const s = W.st(w.id); s.side = 0; s.phase = 'battle'; s.start = g.day; s.end = g.day + 9999;
const fr = w.front(); g.teleport(fr.x + 200, fr.y + 200); h.hp = 1;
W.startBattle(w, s);
const Bt = W.battle;
console.log(`  前线：敌 ${Bt.foes.length} 人，我方 ${Bt.allies.length} 人`);
ok(Bt.foes.length >= 5 && Bt.allies.length >= 3, '前线接战：敌我双方都有人马');
let foeOnP = 0, fs = 0;
{ let k = 0; run(25, () => { if (Bt.allies.filter((x: any) => !x.dead && !x.gone).length >= 2) for (const e of Bt.foes) if (!e.dead && e.aggro) { fs++; if (e.tgP) foeOnP++; } if (process.env.DBG && ++k % 75 === 0) console.log('   w', (k / 30).toFixed(1), npcHits, [...Bt.foes, ...Bt.allies].filter((e: any) => !e.dead && !e.gone).map((e: any) => `${e.ally ? 'A' : 'F'}${e.realm}->${e.tgP ? 'P' : e.tgE ? (e.tgE.ally ? 'A' : 'F') + e.tgE.realm : '-'} (${Math.round(e.x - p.x)},${Math.round(e.y - p.y)})${e.aggro ? '' : ' idle'}${e.cast ? ' c:' + e.cast.sk.k : ''}${e.retreatT > 0 ? ' R' : ''}`).join(' ')); }); }
console.log(`  前线互击 ${npcHits} 次；敌人锁你的比例 ${(foeOnP / Math.max(1, fs) * 100).toFixed(0)}%`);
ok(npcHits > 20, '两阵修士互相厮杀');
ok(foeOnP / Math.max(1, fs) < 0.6, '敌军不是全冲你一个');
ok(foeOnP / Math.max(1, fs) > 0.1, '但仍有敌将专冲你来（不至于没人理你）');
const merit0 = W.merit; for (const e of Bt.foes) if (!e.dead) { c.npcHit(Bt.allies[0], e, 1e9, 9, undefined, e.x, e.y); }
run(0.2);
ok(W.merit - merit0 < 30, `同袍斩的敌人不记你的战功（+${W.merit - merit0}）`);

// 5) 异宝出世：三路以上派系
reset(); npcHits = 0;
const f = g.ws.flags; f.herald = { map: (await import('../src/data/world')).ACTIVE_MAP, x: p.x + 900, y: p.y, day: g.day, tier: 2, rival: '某散修' }; f.heraldNext = g.day + 999;
g.happen.chkT = 0; (g.happen as any).heraldTick(0.6);
const teams = new Set(c.enemies.filter((e: any) => e.tag?.startsWith('herald')).map((e: any) => e.team));
console.log(`  异宝：${c.enemies.filter((e: any) => e.tag?.startsWith('herald')).length} 人 / ${teams.size} 路`);
ok(teams.size >= 3, '镇宝兽与争宝修士分属多路人马');
{ let k = 0; run(30, () => { if (process.env.DBG && ++k % 90 === 0) console.log('   h', (k / 30).toFixed(0), npcHits, c.enemies.filter((e: any) => e.tag?.startsWith('herald')).map((e: any) => `${e.name.slice(0, 4)}[${e.team?.slice(-2)}]${e.dead ? '†' : ''} ->${e.tgP ? 'P' : e.tgE?.name.slice(0, 4)} d${Math.round(Math.hypot(e.x - p.x, e.y - p.y))} ag${e.aggro ? 1 : 0}${e.cast ? ' c:' + e.cast.sk.k : ''}`).join(' | ')); }); }
ok(npcHits > 10, '争宝的人彼此厮杀');
ok(renderErr === 0, '混战渲染无报错');
ok(nanN === 0, '没有单位坐标变成 NaN');
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
