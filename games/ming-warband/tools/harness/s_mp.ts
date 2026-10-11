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
  mp.openGm(); await wait(300);
  console.log('gm panel:', ([...document.querySelectorAll('.panel')].pop() as any)?.textContent?.slice(0, 160));
  closeAll();
  await snap('/tmp/t/shot_mp.png');
  console.log('errors', errs.length, errs.slice(0, 5));
}
