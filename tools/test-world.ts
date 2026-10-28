// 第四～六步冒烟测试：NPC、红颜、城镇、宗门、拍卖、大事件、奇遇
import { createCanvas, save } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOC_BY_ID, WORLD_SCALE } = await import('../src/data/world');
const { sprites } = await import('../src/gfx/sprites');
const C = await import('../src/world/cultivation');
sprites.frameMs = 1e9; (sprites as any).unlimited = true;
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv);
const step = (sec: number) => { for (let i = 0; i < sec * 30; i++) { g.update(1 / 30); if (g.modal) { const m: any = g.modal; console.log('  [modal]', m.kind, m.node?.speaker ?? m.loc?.name ?? '', (m.node?.text ?? '').slice(0, 40).replace(/\n/g, ' ')); g.closeModal(true); } } };
console.log('npcs', g.npcs.list.length, 'canon', g.npcs.list.filter((n: any) => n.canon).length);
step(5); g.renderer.render(1 / 30);
console.log('active npcs', (g.npcs as any).active.size, 'enc', g.events.enc.length);
// 城镇
const tn = LOC_BY_ID.get('jiayuan')!;
g.teleport(tn.x * WORLD_SCALE, tn.y * WORLD_SCALE + 400); step(2);
console.log('nearby', g.ui.nearby?.name, 'zoom', g.cam.targetZoom.toFixed(2));
C.addItem(g.hero, 'mat_lingshi', 5000);
const shop = g.towns.shop(tn, 'market'); console.log('market', shop.stock.map((s) => s.id + ':' + s.price).join(' '));
g.towns.buy(shop, shop.stock[0]);
console.log('tavern', g.towns.tavern(tn).text.slice(0, 80));
// 宗门
g.hero.realm = 1; g.hero.stage = 6;
const hf = LOC_BY_ID.get('huangfeng')!;
console.log('join', JSON.stringify(g.towns.joinReq(hf)));
g.towns.join(hf); console.log('sect', JSON.stringify(g.ws.sect?.tasks.map((t) => t.text)));
console.log('lib', g.towns.library(hf).stock.map((s) => s.id).join(' '));
g.day += 65; console.log('pay', g.towns.pay());
// 拍卖
console.log('lots', g.towns.auctionLots(LOC_BY_ID.get('yuejing')!).map((l) => l.id + ':' + l.base).join(' '));
// 红颜
const n = g.npcs.byId.get('b_nangongwan')!; console.log('nangong', n?.x, n?.y, n?.alive);
g.hearts.talk('nangongwan'); console.log('modal', (g.modal as any)?.node?.speaker, ((g.modal as any)?.node?.text ?? '').slice(0, 50));
const opts = (g.modal as any)?.node?.options ?? []; console.log('opts', opts.map((o: any) => o.label).join(' | '));
g.closeModal(true);
// 大事件
g.day = 360 + 60 - 300; step(1);
g.day = 360 + 61; step(1);
console.log('events', JSON.stringify(g.ws.events));
const tai = LOC_BY_ID.get('tainan')!;
g.teleport(tai.x * WORLD_SCALE, tai.y * WORLD_SCALE + 600);
for (let i = 0; i < 60 && !g.modal; i++) g.update(1 / 30);
console.log('shengxian modal', (g.modal as any)?.node?.speaker, (g.modal as any)?.node?.options?.map((o: any) => o.label).join('|'));
const o = (g.modal as any)?.node?.options?.[0]; if (o) { const nx = o.act(); console.log(' ->', nx?.text?.slice(0, 40)); }
g.closeModal(true);
console.log('shengxian token', C.bagCount(g.hero, 'item_shengxian'));
// 奇遇
g.teleport(500 * WORLD_SCALE, 560 * WORLD_SCALE); (g.events as any).encT = 0; step(1);
console.log('enc', g.events.enc.map((e) => e.kind).join(','));
for (const e of g.events.enc) { g.player.x = e.x; g.player.y = e.y + 40; (g.events as any).focus = e; g.events.interact(e); console.log('  enc modal', (g.modal as any)?.node?.speaker); g.closeModal(true); }
// 存读档
g.save(1); const g2 = new Game(terrain); console.log('load', g2.load('fanren_save_1'), 'ws', g2.ws.sect?.id, 'npcs', g2.npcs.list.length);
// 截图
g.teleport(tn.x * WORLD_SCALE, tn.y * WORLD_SCALE + 400); g.cam.zoom = g.cam.targetZoom = 1.2; g.clock = 0.5 * 240;
for (let i = 0; i < 40; i++) { g.update(1 / 30); g.closeModal(true); g.renderer.render(1 / 30); }
save(cv, 'world-town.png');
