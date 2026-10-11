// 联机攻城等待：GM 账号登录 → 传送到敌城旁 → 围攻 → 点“等待准备” → 到点自动回到攻城菜单
// 前提：服务器已启动，且 MPNAME（默认 史可法 / pass1234）是第一个注册的账号（GM）
export default async function (c: any) {
  const { game, wait, GAME } = c;
  (globalThis as any).WebSocket ||= (window as any).WebSocket; (globalThis as any).location ||= window.location;
  const errs: string[] = []; const oe = console.error; console.error = (...a: any[]) => { errs.push(a.join(' ')); oe(...a); };
  const mp = await import(GAME + 'src/ui/mp.ts');
  const { NET, send } = await import(GAME + 'src/net/client.ts');
  const G = await import(GAME + 'src/core/game.ts');
  const { closeAll } = await import(GAME + 'src/ui/dom.ts');
  const { openSettlement } = await import(GAME + 'src/ui/settlement.ts');
  mp.setMpHooks(() => { closeAll(); game.scene.stop('World'); game.scene.start('World'); }, () => {});
  const btns = () => [...document.querySelectorAll('button')] as HTMLButtonElement[];
  const click = (txt: string) => { const b = btns().reverse().find(x => x.textContent?.includes(txt)); if (!b) throw new Error('no button ' + txt + ' | have: ' + btns().map(x => x.textContent).join(',').slice(0, 300)); b.click(); };
  const name = process.env.MPNAME ?? '史可法';
  mp.openMpLogin();
  const inputs = [...document.querySelectorAll('.mp-login input')] as HTMLInputElement[];
  inputs[0].value = name; inputs[1].value = 'pass1234'; inputs[2].value = 'ws://127.0.0.1:8091/ws';
  click('登录');
  await wait(2500);
  const S = G.S;
  console.log('status', [...document.querySelectorAll('.panel-title')].map(x=>x.textContent), [...document.querySelectorAll('.mp-login p.dim')].map(x=>x.textContent));
  console.log('in world', NET.inWorld, 'gm', NET.gm, 'faction', G.player()?.faction);
  const target = (Object.values(S.settlements) as any[]).find(s => s.kind === 'castle' && G.atWar(G.player().faction, s.faction));
  for (const cmd of [`troops ${name} ming_recruit 60`, `heal ${name}`, `tp ${name} ${target.name}`, 'speed 3']) { const [c0, ...a] = cmd.split(' '); send({ t: 'gm', cmd: c0, args: a } as any); await wait(400); }
  await wait(1500);
  const p = G.player();
  console.log('near', target.name, Math.round(Math.hypot(p.x - target.x, p.y - target.y)), 'troops', p.troops.reduce((s: number, t: any) => s + t.n, 0));
  openSettlement(target); await wait(300);
  click('围攻此地'); await wait(300);
  const yes = btns().find(x => /确定|开始|围城|是/.test(x.textContent ?? '') && !x.textContent?.includes('围攻此地'));
  if (document.querySelector('.panel-title')?.textContent?.includes('确认')) yes?.click();
  await wait(800);
  console.log('siege panel:', [...document.querySelectorAll('.panel-title')].pop()?.textContent, '| siege', JSON.stringify(target.siege));
  const t0 = Date.now();
  click('等待准备');
  await wait(300);
  console.log('after click panels', document.querySelectorAll('.panel').length);
  let reopened = false;
  for (let i = 0; i < 40 && !reopened; i++) { await wait(500); reopened = btns().some(b => b.textContent?.includes('亲自率军攻城')); }
  console.log('reopened with assault button', reopened, 'after', ((Date.now() - t0) / 1000).toFixed(1), 's');
  send({ t: 'gm', cmd: 'speed', args: ['0.4'] } as any);
  click('解除包围'); await wait(500);
  console.log('siege after lift', JSON.stringify(target.siege));
  console.log('errors', errs.length, errs.slice(0, 5));
}
