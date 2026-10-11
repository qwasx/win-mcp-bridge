// 用法: run.sh s_choice.ts —— 带选项的大事记（吴三桂抉择）与线描图标
export default async function (c: any) {
  const { wait } = c;
  const G = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/game.ts');
  let picked = '';
  G.emit('chronicle', { title: '测试 · 甲申之变', text: '吴三桂进退两难……', big: true, choices: [
    { label: '✍ 修书劝说吴三桂', run: () => { picked = 'persuade'; G.emit('chronicle', { title: '吴三桂拒清', text: '山海关依旧紧闭。' }); } },
    { label: '听天由命', run: () => { picked = 'fate'; } },
  ] });
  await wait(600);
  let el = document.querySelector('.panel.chron');
  const bs = [...(el?.querySelectorAll('button') ?? [])];
  console.log('buttons', bs.map(b => b.textContent).join('|'), 'icons', el?.querySelectorAll('.ico').length, 'close x', !!el?.querySelector('.x'));
  (bs[0] as HTMLButtonElement).click();
  await wait(600);
  el = document.querySelector('.panel.chron');
  console.log('picked', picked, 'next panel:', el?.textContent?.slice(0, 30));
}
