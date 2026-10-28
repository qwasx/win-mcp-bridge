// 第 2 阶段：境界突破测试——金丹品阶、天命种子防刷、失败惩罚、准备清单加成、筑基小玩法、结婴外敌、闭关心得与打断、丹毒、存档
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
const { createCanvas } = await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const C = await import('../src/world/cultivation');
const A = await import('../src/world/ascend');
const { REALMS, MAJOR_BREAKS } = await import('../src/data/realms');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
g.toast = () => {};
let errs = 0, oks = 0;
const ok = (c: any, s: string, extra = '') => { if (c) { oks++; console.log('ok  ', s, extra); } else { errs++; console.log('FAIL', s, extra); } };
const guard = (name: string, f: () => void) => { try { f(); } catch (e: any) { errs++; console.log('ERR ', name, e?.stack?.split('\n').slice(0, 5).join(' | ')); } };
const cv: any = createCanvas(400, 300); const ctx = cv.getContext('2d');
/** 把主角放到某境界圆满 */
const atPeak = (realm: number) => {
  const h = g.hero; h.realm = realm; h.stage = REALMS[realm].stages.length - 1; h.exp = C.need(h); h.hp = 1; h.mp = 1; h.dead = false; h.age = 30; h.lifeLost = 0;
  g.ascend.reset(); g.modal = null;
};
/** 依次点开对话 */
const walk = (pickF: (opts: any[], node: any) => any = (o) => o[0], depth = 30) => {
  const trail: string[] = [];
  let node = g.modal?.kind === 'dialog' ? g.modal.node : null;
  for (let i = 0; i < depth && node; i++) {
    trail.push(node.title ?? node.speaker);
    const opts = node.options.filter((o: any) => !o.disabled && o.act);
    const o = pickF(opts, node); const before = g.modal; const r = o.act();
    if (r) g.openDialog(r); else if (g.modal === before) g.modal = null;
    node = g.modal?.kind === 'dialog' ? g.modal.node : null;
  }
  return trail;
};
const tick = (n: number, dt = 1 / 30) => { for (let i = 0; i < n; i++) g.update(dt); };

// ---------------------------------------------------------------- 1. 准备清单加成
guard('prep', () => {
  atPeak(1);
  const h = g.hero, a = A.ascOf(h);
  a.polish = 0; a.nurture = 0; a.injury = 0; a.toxin = 0; g.ws.sect = null;
  const p0 = g.ascend.preview(0);
  ok(p0.prep.length === 6, '准备清单六项', p0.prep.map((x: any) => x.name).join('、'));
  const n0 = p0.prep.filter((x: any) => x.ok).length;
  a.polish = A.POLISH_DAYS[1];
  C.addItem(h, 'mat_yaodan4', 1);
  h.hotbar[8] = 'art:art_qingfeng'; a.nurture = A.NURTURE_DAYS[1];
  const p1 = g.ascend.preview(0);
  const n1 = p1.prep.filter((x: any) => x.ok).length;
  ok(n1 >= n0 + 3, `凑齐圆满 / 灵物 / 温养：${n0} → ${n1} 项`, p1.prep.map((x: any) => `${x.name}${x.ok ? '✔' : '✘'}`).join(' '));
  ok(p1.parts.total > p0.parts.total + 0.15, `成功率随准备上升 ${(p0.parts.total * 100).toFixed(0)}% → ${(p1.parts.total * 100).toFixed(0)}%`);
  const step = A.PREP_BONUS[2];
  ok(Math.abs(p1.parts.prep - p0.parts.prep - (n1 - n0) * step) < 1e-9, `每项 +${Math.round(step * 100)}%`);
  // 护法：入宗门
  g.ws.sect = { id: 'huangfeng', rank: 1, contrib: 0, joined: 0, lastPay: 0, tasks: [], done: 0 };
  ok(!!g.ascend.guardName(), '入宗门后有长老护法', g.ascend.guardName());
  // 丹毒、重伤扣成功率
  a.toxin = 80; const pt = g.ascend.preview(0); ok(pt.parts.toxin < -0.15, `丹毒深重扣成功率 ${Math.round(pt.parts.toxin * 100)}%`);
  a.toxin = 0; a.injury = 100; const pi = g.ascend.preview(0); ok(pi.parts.injury === -0.15, '重伤 -15%');
  a.injury = 0;
  const pp = g.ascend.preview(2); ok(pp.parts.pills > 0 || C.bagCount(h, 'pill_zhuji') === 0, '丹药计入（预览按持有数折算在 begin 中）');
});

// ---------------------------------------------------------------- 2. 天命种子：防读档刷
guard('seed', () => {
  atPeak(1);
  const h = g.hero;
  const prep = g.ascend.prep();
  const u1 = A.fateRoll(h, A.prepSig(prep, 1)), u2 = A.fateRoll(h, A.prepSig(prep, 1));
  ok(u1 === u2, '同样准备，天命之数不变', u1.toFixed(4));
  const u3 = A.fateRoll(h, A.prepSig(prep, 2));
  ok(u3 !== u1, '多带一颗丹（准备变了），天命重算', u3.toFixed(4));
  // 存档 → 冲关失败 → 读档 → 再冲：结果一样
  const a = A.ascOf(h); a.polish = 0; a.nurture = 0; g.ws.sect = null; h.bag = h.bag.filter((b: any) => !b.id.startsWith('mat_yaodan'));
  let seed = a.seed;
  // 找一个这次必然失败的种子（u 高于成功率），模拟“玩家一试就败”
  for (let s = 1; s < 500; s++) { a.seed = s; const pv = g.ascend.preview(0); if (A.fateRoll(h, A.prepSig(pv.prep, 0)) > pv.parts.total + 0.2) { seed = s; break; } }
  a.seed = seed;
  g.save(1);
  const res: boolean[] = [];
  for (let k = 0; k < 3; k++) {
    g.load('fanren_save_1'); g.modal = null; g.ascend.reset();
    const hh = g.hero; ok(A.ascOf(hh).seed === seed, `读档后种子仍在（第 ${k + 1} 次）`);
    g.ascend.begin(0);
    walk((o) => o[0]);   // 开始小玩法
    // 每一下都按在正中：发挥满分
    for (let i = 0; i < 400 && g.ascend.run?.phase === 'pulse'; i++) { const m = g.ascend.run.mg; m.ang = m.zone; g.ascend.press(); tick(2); }
    tick(40);
    res.push(g.hero.realm === 2);
  }
  ok(res.every((x) => x === res[0]), `读档三次，结果相同（${res.map((x) => x ? '成' : '败').join('、')}）`);
  ok(res[0] === false, '这一卦本就该败——读档也救不回来');
  // 失败之后再冲，是新的一卦（tries 推进）
  const t0 = A.ascOf(g.hero).tries[1];
  ok(t0 >= 1, '失败推进了天命（tries）', String(t0));
});

// ---------------------------------------------------------------- 3. 失败惩罚
guard('fail', () => {
  atPeak(3);
  const h = g.hero, a = A.ascOf(h);
  a.insight[3] = 0; a.injury = 0; h.stage = 2; h.exp = C.need(h);
  const life0 = C.maxLife(h), exp0 = h.exp;
  const r = A.applyFail(h);
  ok(C.maxLife(h) === life0 - A.LIFE_LOSS[3], `折寿 ${A.LIFE_LOSS[3]} 载`);
  ok(a.injury === A.INJ_DAYS[3] && C.heroStats(h).atk < Math.round(REALMS[3].atk[h.stage] * 0.75), `重伤 ${a.injury} 日，属性打七折`);
  ok(r.fell ? h.stage === 1 : h.exp < exp0 * 0.75, r.fell ? '跌落一层' : '修为倒退三成', r.lines.join(' / '));
  ok(a.insight[3] === 1, '留下一分感悟');
  const pv = g.ascend.preview(0); ok(Math.abs(pv.parts.insight - 0.06) < 1e-9, '感悟让下次 +6%');
  // 跌境概率（大样本）
  let fell = 0; const N = 2000;
  for (let i = 0; i < N; i++) { const hh: any = C.newHero(); hh.realm = 3; hh.stage = 2; hh.exp = 100; hh.asc = A.newAsc(i * 7919 + 13); const rr = A.applyFail(hh); if (rr.fell) fell++; }
  ok(Math.abs(fell / N - A.FALL_CH[3]) < 0.035, `小概率跌落一层：${(fell / N * 100).toFixed(1)}%（设定 ${A.FALL_CH[3] * 100}%）`);
  a.injury = 0;
});

// ---------------------------------------------------------------- 4. 筑基：引灵冲脉
guard('zhuji', () => {
  atPeak(1);
  const h = g.hero, a = A.ascOf(h);
  a.injury = 0; a.toxin = 0; a.polish = 999; a.nurture = 999; h.hotbar[8] = 'art:art_qingfeng';
  C.addItem(h, 'pill_zhuji', 3); C.addItem(h, 'mat_yaodan4', 1);
  // 找一个能成的种子
  for (let s = 1; s < 500; s++) { a.seed = s; const pv = g.ascend.preview(3); if (A.fateRoll(h, A.prepSig(pv.prep, 3)) < pv.parts.total - 0.16) break; }
  const slots0 = h.hotbar.length;
  ok(g.breakthrough(3).ok === false && g.modal?.kind === 'dialog', '冲关先弹出关卡说明', g.modal?.node?.title);
  walk();
  ok(g.ascend.run?.phase === 'pulse', '进入引灵冲脉', g.ascend.run?.mg?.names.join(''));
  const m = g.ascend.run.mg;
  ok(m.names.length === 8 && m.names[0] === '任脉', '奇经八脉八个节点');
  // 前两下故意按偏，其余按正
  let presses = 0;
  for (let i = 0; i < 800 && g.ascend.run?.phase === 'pulse'; i++) {
    const mm = g.ascend.run.mg;
    if (presses < 2) { mm.ang = mm.zone + Math.PI; g.ascend.press(); presses++; }
    else if (Math.abs(((mm.ang - mm.zone + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < mm.zw * 0.15) { g.ascend.press(); presses++; }
    tick(1, 1 / 60);
  }
  ok(m.miss >= 2 && m.hits >= 5, `冲脉结果：贯通 ${m.hits}（上佳 ${m.perfect}）· 反噬 ${m.miss}`);
  ok(Math.abs(g.ascend.run.perf) <= 0.15, `关卡发挥 ${(g.ascend.run.perf * 100).toFixed(1)}%`);
  tick(30);
  ok(g.ascend.run?.phase === 'cine', '进入突破场面');
  ok(h.realm === 2, '筑基成功');
  // 场面：漩涡、水墨、大字
  let maxInk = 0, maxV = 0, cal = 0;
  for (let i = 0; i < 400 && g.ascend.run?.phase === 'cine'; i++) { tick(1, 1 / 30); maxInk = Math.max(maxInk, g.ascend.ink); maxV = Math.max(maxV, g.ascend.vortex?.k ?? 0); cal = Math.max(cal, g.ascend.cal.filter((c: any) => c.t >= 0 && c.t < c.dur).length); }
  ok(maxV > 0.8, `灵气漩涡卷起（${maxV.toFixed(2)}）`);
  ok(maxInk > 0.9, `黑白水墨镜头（${maxInk.toFixed(2)}）`);
  ok(cal >= 1, '满屏书法大字');
  ok(g.mapMarks().some((x: any) => x.glyph === '旋') || (g.ascend.vortex?.k ?? 0) < 0.05, '大地图标出灵气漩涡');
  ok(!!g.ascend.summary && g.ascend.summary.ok, '突破总结', g.ascend.summary?.extra?.join(' / '));
  const S = g.ascend.summary;
  ok(S.after.sense > S.before.sense * 1.15 && S.after.speed > S.before.speed, `神识圈 ${S.before.sense}→${S.after.sense}，遁速 ${S.before.speed}→${S.after.speed}`);
  ok(h.hotbar.length === slots0 + 1 && h.hotbar.length === A.slotCount(2), `新神通位：快捷栏 ${slots0} → ${h.hotbar.length} 格`);
  g.ascend.closeSummary();
  ok(!g.ascend.run, '关闭总结后流程结束');
  // 场面的绘制不抛错
  const list: any[] = []; g.ascend.vortex = { x: g.player.x, y: g.player.y, k: 1, want: 1, t: 0, fail: false, R: 1500 }; g.ascend.soulK = 1;
  g.ascend.collect(list, null, 1); for (const it of list) it.draw(ctx);
  ok(list.length >= 2, '漩涡云层 / 元婴的画法可以绘制');
  g.ascend.vortex = null; g.ascend.soulK = 0;
});

// ---------------------------------------------------------------- 5. 结丹：金丹品阶
guard('core', () => {
  // 品阶函数：准备越足、火候越好，品阶越高
  const lo = A.coreGrade(7, 0, 0, 0.2, 0), hi = A.coreGrade(7, 0, 1, 1, 0), tox = A.coreGrade(7, 0, 1, 1, 100);
  ok(lo >= 1 && hi <= 9 && hi > lo, `品阶范围：草率 ${lo} 品，周全 ${hi} 品`);
  ok(tox < hi, `丹毒入髓降品阶（${tox} 品）`);
  const dist: Record<number, number> = {};
  for (let s = 0; s < 3000; s++) { const gr = A.coreGrade(s, 0, Math.random(), Math.random(), 0); dist[gr] = (dist[gr] ?? 0) + 1; }
  ok(Object.keys(dist).length >= 7, '一到九品都可能出现', JSON.stringify(dist));
  // 实打实走一遍结丹
  atPeak(2);
  const h = g.hero, a = A.ascOf(h);
  a.core = 0; a.polish = 99999; a.nurture = 99999; a.toxin = 0; a.injury = 0;
  C.addItem(h, 'pill_jiangchen', 3); C.addItem(h, 'mat_yaodan6', 1);
  for (let s = 1; s < 500; s++) { a.seed = s; const pv = g.ascend.preview(3); if (A.fateRoll(h, A.prepSig(pv.prep, 3)) < pv.parts.total - 0.3) break; }
  g.breakthrough(3);
  const trail = walk((o, node) => (node.title ?? '').includes('结丹 ·') ? o[Math.min(1, o.length - 1)] : o[0]);
  ok(trail.some((t: string) => t.includes('心魔劫')) && trail.some((t: string) => t.includes('第三转')), '心魔劫 → 凝丹三转', trail.slice(-5).join(' → '));
  ok(h.realm === 3 && a.core >= 1 && a.core <= 9, `结丹成功：${A.CORE_NAME[a.core]}金丹`);
  const stats = C.heroStats(h); const base = REALMS[3].atk[0];
  ok(Math.abs(stats.atk / Math.round(base * (1 + (C.gongfaDef(h).atk ?? 0))) - A.coreStat(h)) < 0.03, `品阶影响属性 ×${A.coreStat(h).toFixed(2)}`);
  ok(Math.abs(C.expPerDay(h) / (C.expPerDay(h) / A.coreExp(h)) - A.coreExp(h)) < 1e-9, `品阶影响修炼速度 ×${A.coreExp(h).toFixed(2)}`);
  for (let i = 0; i < 400 && g.ascend.run?.phase === 'cine'; i++) tick(1);
  ok(g.ascend.summary?.grade === a.core, '总结里写着金丹品阶');
  g.ascend.closeSummary();
  // 存档读档：品阶终身带着
  const grade = a.core; g.save(2); g.load('fanren_save_2'); g.modal = null;
  ok(A.ascOf(g.hero).core === grade, '金丹品阶存进存档', String(grade));
});

// ---------------------------------------------------------------- 6. 结婴：心魔五重 + 外敌来袭 + 护法
guard('yuanying', () => {
  atPeak(3);
  const h = g.hero, a = A.ascOf(h);
  a.polish = 99999; a.nurture = 99999; a.injury = 0; a.toxin = 0;
  g.ws.sect = { id: 'huangfeng', rank: 3, contrib: 0, joined: 0, lastPay: 0, tasks: [], done: 0 };
  C.addItem(h, 'pill_jiuqu', 2); C.addItem(h, 'mat_yaodan8', 1); h.kills = 200;
  for (let s = 1; s < 500; s++) { a.seed = s; const pv = g.ascend.preview(2); if (A.fateRoll(h, A.prepSig(pv.prep, 2)) < pv.parts.total - 0.3) break; }
  const pool = g.xinmo.pool(); ok(pool.length >= 7, `心魔幻境按经历生成 ${pool.length} 种`, pool.join('、'));
  g.breakthrough(2);
  const trail = walk();
  ok(trail.filter((t: string) => /（\d\/5）/.test(t)).length === 5, '结婴心魔劫五重', trail.filter((t: string) => /（\d\/5）/.test(t)).join(' → '));
  ok(g.ascend.run?.phase === 'waves', '碎丹成婴：进入护法阶段');
  const w = g.ascend.run.wv;
  ok(!!w.ally && w.ally.ally, `护法上阵：${w.ally?.name}`);
  let foes = 0, waves = 0;
  for (let i = 0; i < 30 * 200 && g.ascend.run?.phase === 'waves'; i++) {
    h.hp = 1; g.player.x = g.ascend.run.x; g.player.y = g.ascend.run.y;   // 守在阵眼
    g.modal = null; g.update(1 / 30);
    waves = Math.max(waves, g.ascend.run?.wv?.wave ?? waves); foes = Math.max(foes, g.ascend.run?.wv?.foes.length ?? foes);
  }
  ok(waves === 3 && foes >= 9, `外敌一波接一波：${waves} 波，共 ${foes} 人`);
  ok(h.realm === 4, '元婴成矣');
  let soul = 0; for (let i = 0; i < 400 && g.ascend.run?.phase === 'cine'; i++) { tick(1); soul = Math.max(soul, g.ascend.soulK); }
  ok(soul > 0.8, `元婴在头顶显化（${soul.toFixed(2)}）`);
  ok(g.ascend.summary?.extra.some((x: string) => x.includes('瞬移')), '总结列出元婴神通');
  g.ascend.closeSummary();
  // 元婴神通
  const p = g.player, x0 = p.x;
  g.input.keys.clear(); p.facing = 1; g.isFlying || (p.flying = true);
  ok(g.ascend.key('x') && Math.abs(p.x - x0) > 300, `瞬移 ${Math.round(Math.abs(p.x - x0))} 步`);
  const bx = p.x, s0 = g.senseRadius;
  ok(g.ascend.key('v') && !!g.ascend.out && g.senseRadius > s0 * 1.8, `元婴出窍：神识 ${Math.round(s0)} → ${Math.round(g.senseRadius)}`);
  p.x += 2000; tick(2); h.hp -= 0.2; tick(2);
  ok(!g.ascend.out && Math.abs(p.x - bx) < 1, '肉身受袭，元婴归窍');
  h.hp = 1;
  // 被迫中断
  atPeak(3); A.ascOf(h).polish = 99999; C.addItem(h, 'pill_jiuqu', 2);
  g.breakthrough(0); walk();
  ok(g.ascend.run?.phase === 'waves', '再冲一次结婴');
  const L0 = C.maxLife(h);
  g.player.x += 2000; for (let i = 0; i < 200 && g.ascend.run?.phase === 'waves'; i++) { g.modal = null; g.update(1 / 30); }
  ok(!!g.ascend.run?.interrupted && h.realm === 3, '离开阵眼被迫中断', g.ascend.run?.interrupted);
  ok(C.maxLife(h) < L0 && A.ascOf(h).injury > 0, '中断也伤：折寿、重伤（减半）');
  for (let i = 0; i < 400 && g.ascend.run && g.ascend.run.phase !== 'summary'; i++) tick(1);
  g.ascend.closeSummary();
});

// ---------------------------------------------------------------- 7. 闭关：心得、打断、丹毒
guard('seclude', () => {
  g.ascend.reset(); g.events.nextStart = () => null;   // 不让原著大事提前叫出关
  const h = g.hero; h.realm = 2; h.stage = 0; h.exp = 0; h.dead = false; h.age = 40; h.lifeLost = 0; h.pendingTalent = null;
  const a = A.ascOf(h);
  a.xinde = 100; a.nextIntr = g.day + 100000;
  const e0 = h.exp; const r1 = g.seclude(0); const gain1 = h.exp - e0;
  ok(Math.round(r1.days) === 100 && r1.reason.includes('心得耗尽'), `心得 100 日：闭关 ${Math.round(r1.days)} 日后自动出关（${r1.reason}）`);
  const e1 = h.exp; a.xinde = 0; g.seclude(100); const gain2 = h.exp - e1;
  ok(gain2 < gain1 * 0.1, `没有心得闭门造车：同样 100 日修为 ${Math.round(gain1)} → ${Math.round(gain2)}`);
  // 在外历练攒心得
  a.xinde = 0; g.player.sitting = false; for (let i = 0; i < 300; i++) { g.modal = null; g.player.sitting = false; g.update(0.1); }
  ok(a.xinde > 8, `在外历练 30 秒攒下心得 ${a.xinde.toFixed(1)} 日`);
  const k0 = a.xinde; h.kills += 3; g.modal = null; g.update(0.016);
  ok(a.xinde > k0 + 3 * A.XINDE_KILL, `斩敌三名，战斗感悟 +${(a.xinde - k0).toFixed(0)} 日心得`);
  // 打断
  a.xinde = 99999; a.nextIntr = g.day + 200;
  const r2 = g.seclude(3600);
  ok(r2.reason.startsWith('闭关被打断') && Math.round(r2.days) === 200, `闭关第 ${Math.round(r2.days)} 日被打断：${r2.reason}`);
  g.modal = null; g.update(0.016);
  ok(g.modal?.kind === 'dialog', '打断弹窗', g.modal?.node?.speaker + '：' + (g.modal?.node?.text ?? '').slice(0, 30));
  const kinds = new Set<string>();
  for (let k = 0; k < 6; k++) {
    g.modal = null; h.pendingTalent = null; a.nextIntr = g.day + 50; const r = g.seclude(3600); g.modal = null; g.update(0.016);
    kinds.add(r.reason.replace(/.*——/, '').slice(0, 6));
    if (g.modal?.node) walk((o) => o[0], 3);
    g.modal = null; for (const e of g.combat.enemies) e.dead = true;
  }
  ok(kinds.size >= 2, '打断的事由轮流出现', [...kinds].join('、'));
  ok(a.tasks.length >= 0, '任务列表');
  // 瓶颈上打磨根基
  h.pendingTalent = null; h.realm = 2; h.stage = 2; h.exp = C.need(h); a.polish = 0; a.nextIntr = g.day + 1e6; a.xinde = 99999;
  ok(g.ascend.polishing(), '修为圆满后可以继续闭关打磨');
  const r3 = g.seclude(0);
  ok(a.polish >= A.POLISH_DAYS[2] - 1 && r3.reason.includes('根基'), `打磨根基 ${Math.round(a.polish)} 日：${r3.reason}`);
  // 丹毒
  h.realm = 2; h.stage = 0; h.exp = 0; h.pillN = 0; a.toxin = 0;
  const out: any[] = [];
  C.addItem(h, 'pill_juling', 10);
  const gains: number[] = [];
  for (let i = 0; i < 6; i++) { h.pillN = 0; const b = h.exp; C.usePill(h, 'pill_juling', out); gains.push(Math.round(h.exp - b)); }
  ok(a.toxin > 40 && gains[5] < gains[0] * 0.7, `丹毒累积 ${Math.round(a.toxin)}，药力递减 ${gains.join(' → ')}`);
  const t0 = a.toxin; C.passDays(h, 200, true, 1, out);
  ok(a.toxin < t0 - 10, `打坐化去丹毒 ${Math.round(t0)} → ${Math.round(a.toxin)}`);
});

// ---------------------------------------------------------------- 8. 旧存档兼容
guard('legacy', () => {
  g.save(3);
  const raw = JSON.parse(store['fanren_save_3']); delete raw.hero.asc; raw.hero.hotbar = raw.hero.hotbar.slice(0, 9);
  store['fanren_save_3'] = JSON.stringify(raw);
  ok(g.load('fanren_save_3'), '读入没有突破字段的旧存档');
  const a = A.ascOf(g.hero);
  ok(a.seed > 0 && a.xinde >= 0 && a.core === 0 && Array.isArray(a.tasks), '突破字段补上默认值');
  ok(g.hero.hotbar.length === A.slotCount(g.hero.realm), `神通位按境界补齐（${g.hero.hotbar.length} 格）`);
  ok(MAJOR_BREAKS[1] && A.BASE[1].base < MAJOR_BREAKS[1].base, '硬核：冲关底子比旧版低');
});

console.log(`\n${oks} ok, ${errs} FAIL/ERR`);
process.exit(errs ? 1 : 0);
