// 联机端到端：真实客户端（jsdom）连本地服务器 → 注册 → 选国 → 进入天下 → 行军 → 面板
// 先启动服务器：DATA_DIR=/tmp/mdata PORT=8091 node dist-server/server.mjs
export default async function (c: any) {
  const { game, wait, snap, GAME } = c;
  (globalThis as any).WebSocket ||= (window as any).WebSocket; (globalThis as any).location ||= window.location;
  const errs: string[] = []; const oe = console.error; console.error = (...a: any[]) => { errs.push(a.join(' ')); oe(...a); };
  const mp = await import(GAME + 'src/ui/mp.ts');
  const { NET } = await import(GAME + 'src/net/client.ts');
  const G = await import(GAME + 'src/core/game.ts');
  const { setPlayerTarget } = await import(GAME + 'src/core/sim.ts');
  const { closeAll } = await import(GAME + 'src/ui/dom.ts');
  mp.setMpHooks(() => { closeAll(); game.scene.stop('World'); game.scene.start('World'); }, () => {});
  const click = (txt: string) => { const b = [...document.querySelectorAll('button')].reverse().find((x: any) => x.textContent?.includes(txt)) as any; if (!b) throw new Error('no button ' + txt); b.click(); };
  mp.openMpLogin();
  const inputs = [...document.querySelectorAll('.mp-login input')] as HTMLInputElement[];
  inputs[0].value = process.env.MPNAME ?? '史可法'; inputs[1].value = 'pass1234'; inputs[2].value = 'ws://127.0.0.1:8091/ws';
  click('注册新名号');
  await wait(1500);
  console.log('login status:', document.querySelector('.mp-login p.dim')?.textContent, 'connected', NET.connected);
  const pick = document.querySelector('.nation-list');
  console.log('nation pick shown', !!pick, 'cards', document.querySelectorAll('.nation-card').length);
  click('投效');
  await wait(2500);
  const S = G.S;
  console.log('mp body', document.body.classList.contains('mp'), 'parties', S.parties.length, 'player', G.player()?.name, G.player()?.faction, 'troops', G.player()?.troops.reduce((s: number, t: any) => s + t.n, 0));
  console.log('overlay', !!document.getElementById('mp-ui'), 'world active', game.scene.isActive('World'));
  const p = G.player();
  const x0 = p.x, y0 = p.y;
  setPlayerTarget({ kind: 'point', x: p.x + 120, y: p.y + 60 } as any);
  await wait(4000);
  console.log('moved', Math.round(Math.hypot(p.x - x0, p.y - y0)), 'px');
  const others = S.parties.filter((q: any) => q.id !== p.id);
  console.log('others moving:', others.slice(0, 5).map((q: any) => `${q.name}@${Math.round(q.x)},${Math.round(q.y)}`).join(' '));
  await wait(1500);
  console.log('others later :', others.slice(0, 5).map((q: any) => `${q.name}@${Math.round(q.x)},${Math.round(q.y)}`).join(' '));
  // 聊天
  const ci = document.querySelector('.chat-input') as HTMLInputElement | null;
  if (ci) { ci.value = '诸位好'; ci.dispatchEvent(new (window as any).KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
  await wait(800);
  console.log('chat lines', document.querySelectorAll('.chat-line').length, (document.querySelector('.mp-chat') as any)?.textContent?.slice(-60));
  mp.openDiplomacy(); await wait(300);
  console.log('diplomacy panel:', [...document.querySelectorAll('.panel-title')].pop()?.textContent, ([...document.querySelectorAll('.panel')].pop() as any)?.textContent?.slice(0, 160));
  closeAll();
  // ---- 天命：在聊天框输入令牌认领（令牌来自服务器 DATA_DIR/GM_KEY.txt） ----
  const gmBtn = () => [...document.querySelectorAll('button')].find((b: any) => b.textContent?.includes('天意')) as any;
  console.log('before claim: gm', NET.gm, '天意 button visible', !!gmBtn() && gmBtn().style.display !== 'none');
  const fs = await import('node:fs');
  const key = /([A-Z2-9]{4}(-[A-Z2-9]{4}){3})/.exec(fs.readFileSync((process.env.DATA_DIR ?? '/tmp/gt1') + '/GM_KEY.txt', 'utf8'))?.[1];
  await wait(900);
  if (ci && key) { ci.value = '/天命 ' + key.toLowerCase(); ci.dispatchEvent(new (window as any).KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
  await wait(1200);
  const chatTxt = (document.querySelector('.mp-chat') as any)?.textContent ?? '';
  console.log('after claim: gmLevel', NET.gmLevel, '天意 button visible', !!gmBtn() && gmBtn().style.display !== 'none', 'key leaked into chat?', chatTxt.includes(key!) || chatTxt.includes(key!.toLowerCase()));
  const god = await import(GAME + 'src/core/god.ts');
  gmBtn()?.click(); await wait(400);
  const panelTxt = () => (document.querySelector('.gm-panel') as any)?.textContent ?? '';
  for (const tab of [...document.querySelectorAll('.gm-tab')] as any[]) { tab.click(); await wait(500); console.log('  tab', tab.textContent, '→', panelTxt().replace(/\s+/g, ' ').slice(0, 110)); }
  (document.querySelector('.gm-tab') as any)?.click(); await wait(300);
  const onBtn = [...document.querySelectorAll('.gm-panel button')].find((b: any) => /开启天命|降临|天命/.test(b.textContent ?? '') && !/关闭|收起/.test(b.textContent ?? '')) as any;
  console.log('god tab buttons:', [...document.querySelectorAll('.gm-panel button')].map((b: any) => b.textContent).slice(0, 18).join(' | '));
  onBtn?.click(); await wait(800);
  console.log('GOD.on', god.GOD.on, 'invincible', god.GOD.invincible, 'mapSpeed', god.GOD.mapSpeed);
  const togs = [...document.querySelectorAll('.gm-tog')] as any[];
  const revealTog = togs.find(b => b.textContent.includes('显圣'));
  revealTog?.click(); await wait(800);
  console.log('reveal toggled via panel →', god.GOD.reveal);
  revealTog && ([...document.querySelectorAll('.gm-tog')] as any[]).find(b => b.textContent.includes('显圣'))?.click(); await wait(600);
  await snap('/tmp/t/shot_mp_god.png');
  closeAll();
  await snap('/tmp/t/shot_mp.png');
  console.log('errors', errs.length, errs.slice(0, 5));
}
