// 第三十六步：大战与传音玉符冒烟测试：npx tsx tools/test-war.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOC_BY_ID, WORLD_SCALE } = await import('../src/data/world');
const { WAR_BY_ID } = await import('../src/world/war');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const W = g.war, w = WAR_BY_ID.get('mulan')!;
g.hero.realm = 2; g.hero.stage = 1; (g.ws as any).sect = undefined;
// 0) 结识一位道友，看他会不会邀你
const fr = g.npcs.list.find((d) => d.alive && d.realm >= 2 && !d.canon && !d.beauty && d.faction === 'rogue')!;
fr.met = true; fr.favor = 50;
// 1) 召集
const s = W.st('mulan'); s.next = g.day;
W.daily(1);
ok(s.phase === 'call', `${w.name} 召集`);
const call = W.inbox.find((j) => j.kind === '召集');
ok(!!call, `玉符·召集：${call?.from}`);
const inv = W.inbox.find((j) => j.kind === '邀约' && j.war);
console.log('  邀约', inv?.from ?? '(没有)');
// 2) 投效（被道友带）
const node = W.jadeNode(inv ?? call!);
const opt = node.options.find((o) => /答应同去|投效天南/.test(o.label))!;
ok(!!opt, `玉符选项：${node.options.map((o) => o.label).join(' / ')}`);
opt.act!();
ok(s.side === 0, '已投效天南联军');
if (inv) ok(fr.bond === 'companion', `${fr.name} 与你同行`);
// 3) 集结点 → 军帐
const R = LOC_BY_ID.get('huayi')!;
g.teleport(R.x * WORLD_SCALE, R.y * WORLD_SCALE + 400); g.closeModal?.(true);
(W as any).acc = 0; W.update(0.1);
ok(g.modal?.kind === 'dialog', '到集结点：军帐对话');
const camp = g.npcs.list.filter((d) => (d as any).war === 'mulan');
ok(camp.length >= 8, `军营同袍 ${camp.length} 人：${camp.slice(0, 4).map((d) => d.title + d.name).join('、')}`);
const cn = (g.modal as any).node; console.log('  军帐选项:', cn.options.map((o: any) => o.label).join(' / '));
const pickO = cn.options.find((o: any) => o.label.startsWith('点几位'));
const pn = pickO.act(); pn.options[0].act(); pn.options[1]?.act?.();
const comps = g.npcs.list.filter((d) => d.alive && d.bond === 'companion');
ok(comps.length >= 2, `随你出阵 ${comps.length} 人`);
g.closeModal?.(true);
// 4) 开战 → 前线
s.start = g.day - w.call; W.daily(1);
ok(s.phase === 'battle', '正式开战');
const fp = w.front(); g.teleport(fp.x, fp.y + 300);
(W as any).acc = 0; W.update(0.1);
const B = (W as any).battle;
ok(!!B && B.foes.length === 6, `接敌：${B?.foes.map((e: any) => e.name + '·' + e.realm).join('、')}`);
ok(!!B && B.allies.length >= 3 && B.allies.every((e: any) => e.ally && !g.combat.enemies.includes(e)), `我方同袍 ${B?.allies.length} 人随你接战（第三十九步·混战）`);
const m0 = W.merit;
for (let wave = 0; wave < 3; wave++) {
  for (const e of [...(W as any).battle.foes]) g.combat.finish(e);
  W.update(0.1); W.update(3);
}
ok(!(W as any).battle && (s.wins ?? 0) === 1, `三波全歼，胜一阵（战功 ${m0} → ${W.merit}）`);
ok(g.combat.allies.every((e: any) => e.gone || e.dead), '胜后同袍收兵');
const dead = Object.entries((g.ws.flags as any).ros ?? {}).reduce((n, [, v]: any) => n + (v.d?.length ?? 0), 0);
ok(dead >= 10, `敌兵记入名册阵亡 ${dead} 人`);
// 5) 战功兑换
W.merit = 500; const sh = (W as any).shopNode(w); sh.options.find((o: any) => o.label.includes('筑基丹')).act();
ok(g.hero.bag.some((b) => b.id === 'pill_zhuji'), '战功换得筑基丹');
// 6) 战事结束
s.end = g.day; W.daily(1);
ok(s.phase === 'idle' && s.next > g.day + 360 * 4, `战事落幕，下次约在 ${((s.next - g.day) / 360).toFixed(1)} 年后`);
ok(!g.npcs.list.some((d) => (d as any).war === 'mulan'), '军营散去');
// 7) 求救
fr.bond = undefined; fr.map = 'tiannan';
const home = LOC_BY_ID.get(fr.home)!;
W.send({ kind: '求救', from: fr.name, fromId: fr.id, text: 't', x: home.x * WORLD_SCALE + 3000, y: home.y * WORLD_SCALE, until: g.day + 5 });
const j = W.inbox[W.inbox.length - 1];
g.teleport(j.x!, j.y! + 200); W.update(0.01);
ok((j as any).spawned, '赶到求救地点：劫修现身');
for (const e of (W as any).sosFoes) g.combat.finish(e);
const f0 = fr.favor; W.update(0.01);
ok(j.done && fr.favor > f0, `救下${fr.name}：好感 ${f0} → ${fr.favor}`);
// 8) 随机玉符
for (let k = 0; k < 30; k++) (W as any).randomJade();
const kinds = new Set(W.inbox.map((x) => x.kind));
ok(kinds.size >= 3, `玉符种类：${[...kinds].join('、')}`);
ok(W.inboxNode().options.length >= 4, '玉符面板');
console.log(fails ? `${fails} FAIL` : 'ALL OK');
process.exit(fails ? 1 : 0);
