// 用法: run.sh s_chron.ts —— 大事记卷轴弹窗
export default async function (c: any) {
  const { snap, wait } = c;
  const G = await import('/home/user/win-mcp-bridge/games/ming-warband/src/core/game.ts');
  G.emit('chronicle', { title: '崇祯十七年四月 · 山海关之战', text: '京师已陷，崇祯帝自缢于煤山。山海关总兵吴三桂闻变，“冲冠一怒为红颜”，开关迎清兵入关。\n\n一片石一战，大顺军大败。多尔衮率八旗铁骑长驱入关，直取北京。', x: 1000, y: 500, big: true });
  await wait(1200);
  await snap('/tmp/t/shot_chron.png');
  const el = document.querySelector('.panel.chron');
  console.log('chron panel', !!el, el?.textContent?.slice(0, 80), 'buttons', [...(el?.querySelectorAll('button') ?? [])].map(b => b.textContent).join('|'));
}
