// 天意 · 上帝面板（只有 GM 看得见）。所有按钮最终都发 GM 指令，服务器逐条审计。
import { h, openPanel, btn, toast, confirmDialog, closeAll } from './dom';
import { S, player, partyById } from '../core/game';
import { FACTION } from '../data/world';
import { TROOPS, GOD_TROOPS } from '../data/troops';
import { NET, send } from '../net/client';
import { GOD, GODUI, type GodState } from '../core/god';
import { count, healthy } from '../core/party';
import type { Settlement } from '../core/state';

type Tab = 'god' | 'players' | 'world' | 'rules' | 'admin' | 'console';
interface PRow { name: string; online: boolean; nation: string | null; lvl: number; gold: number; renown: number; troops: number; gm: number; banned: boolean; muted: number; protect: number; x: number | null; y: number | null }
const G = { tab: 'god' as Tab, sel: '' as string, plist: [] as PRow[], status: null as any, root: null as HTMLElement | null, out: null as HTMLElement | null, filter: '', stSel: '', lordSel: '', partyFilter: '' };

export const run = (cmd: string, ...args: (string | number)[]) => send({ t: 'gm', cmd, args: args.map(String).filter(x => x !== '') });

/** 服务器的 GM 回复 */
export function gmReply(text: string, data?: any) {
  if (data?.kind === 'plist') { G.plist = data.list; if (G.tab === 'players') render(); }
  if (data?.kind === 'status') { G.status = data; if (G.tab === 'rules') render(); }
  if (!text) return;
  if (G.out?.isConnected) { G.out.append(h('pre', null, text)); G.out.scrollTop = G.out.scrollHeight; }
  if (!G.root?.isConnected || G.tab !== 'console') toast(text.split('\n')[0].slice(0, 90));
  // 改了玩家数据之后刷新名单
  if (G.root?.isConnected && G.tab === 'players' && /完成|已/.test(text)) setTimeout(() => run('plist'), 250);
}
export function gmGodChanged() { if (G.root?.isConnected && G.tab === 'god') render(); }

// ---------- 小部件 ----------
const inp = (ph: string, val: string | number = '', w = 90, type = 'text') => {
  const e = h('input', { class: 'input gm-in', placeholder: ph, value: String(val), type, style: { width: w + 'px' } }) as HTMLInputElement;
  e.addEventListener('keydown', ev => ev.stopPropagation());
  return e;
};
function sel(opts: [string, string][], val = '', w = 130) {
  const e = h('select', { class: 'input gm-in', style: { width: w + 'px' } }, ...opts.map(([v, l]) => h('option', { value: v, ...(v === val ? { selected: 'selected' } : {}) }, l))) as HTMLSelectElement;
  e.addEventListener('keydown', ev => ev.stopPropagation());
  return e;
}
const factionOpts = (aliveOnly = true): [string, string][] => Object.keys(FACTION).filter(f => f !== 'bandit' && (!aliveOnly || S.alive[f])).map(f => [f, FACTION[f].name]);
const stOpts = (withVillages = false): [string, string][] => Object.values(S.settlements).filter(s => withVillages || s.kind !== 'village')
  .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'zh') : a.kind === 'town' ? -1 : b.kind === 'town' ? 1 : a.kind === 'castle' ? -1 : 1))
  .map(s => [s.id, `${s.name}（${s.kind === 'town' ? '城' : s.kind === 'castle' ? '堡' : '村'}·${FACTION[s.faction]?.name ?? ''}）`]);
const troopOpts = (withRandom = false): [string, string][] => [
  ...(withRandom ? [['', '（随机本地兵）'] as [string, string]] : []),
  ...GOD_TROOPS.map(id => [id, `★ ${TROOPS[id].name}`] as [string, string]),
  ...Object.values(TROOPS).filter(t => t.culture !== 'god').sort((a, b) => a.culture.localeCompare(b.culture) || b.tier - a.tier).map(t => [t.id, `${t.name}（${t.culture}·${t.tier}阶）`] as [string, string]),
];
const row = (...c: (HTMLElement | string | null)[]) => h('div', { class: 'row wrap gm-row' }, ...c);
const lab = (t: string) => h('span', { class: 'gm-lab' }, t);
const B = (label: string, fn: () => void, cls = 'sm') => btn(label, fn, cls);
const card = (title: string, ...c: (HTMLElement | null)[]) => h('div', { class: 'card gm-card' }, h('div', { class: 'gm-card-t' }, title), ...c);

// ---------- 入口 ----------
export function openGm() {
  G.root = h('div', { class: 'gm-root' });
  G.out = h('div', { class: 'gm-out small' }, ...NET.gmLog.slice(-30).map(t => h('pre', null, t)));
  openPanel('天意 · 上帝面板', h('div', null, G.root), { wide: true, cls: 'gm-panel' });
  if (NET.gmLevel < 2 && G.tab === 'god') G.tab = 'players';
  render();
  run('plist'); run('status');
}

function render() {
  const root = G.root; if (!root) return;
  const tabs: [Tab, string][] = [['god', '✦ 神躯'], ['players', '👥 玩家'], ['world', '🗺 天下'], ['rules', '⏳ 时间规则'], ['admin', '🛡 管理'], ['console', '⌨ 指令']];
  const bar = h('div', { class: 'gm-tabs' }, ...tabs.map(([k, l]) => h('button', { class: `gm-tab ${G.tab === k ? 'sel' : ''}`, onclick: () => { G.tab = k; render(); if (k === 'players') run('plist'); if (k === 'rules') run('status'); } }, l)));
  let body: HTMLElement;
  try {
    body = G.tab === 'god' ? tabGod() : G.tab === 'players' ? tabPlayers() : G.tab === 'world' ? tabWorld() : G.tab === 'rules' ? tabRules() : G.tab === 'admin' ? tabAdmin() : tabConsole();
  } catch (e) { body = h('p', { class: 'bad' }, String(e)); }
  root.replaceChildren(bar, body, G.tab === 'console' ? null as any : h('div', { class: 'gm-foot' }, G.out!));
  if (G.tab === 'console') { /* 控制台自带输出区 */ }
}

// ---------- 神躯 ----------
function tabGod() {
  if (NET.gmLevel < 2) return h('div', null, h('p', { class: 'warn' }, '你是助手 GM：可以管理玩家与天下，但上帝模式只属于天命之主。'));
  const set = (k: keyof GodState, v: string | number | boolean) => run('god', k, typeof v === 'boolean' ? (v ? 'on' : 'off') : v);
  const tog = (k: keyof GodState, label: string, tip: string) => {
    const on = !!GOD[k];
    return h('button', { class: `gm-tog ${on ? 'on' : ''}`, title: tip, onclick: () => set(k, !on) }, h('b', null, on ? '●' : '○'), ' ', label);
  };
  const slider = (k: 'mapSpeed' | 'battleSpeed', label: string, min: number, max: number, step: number) => {
    const val = h('b', { class: 'gm-val' }, `×${GOD[k]}`);
    const r = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(GOD[k]), class: 'gm-range' }) as HTMLInputElement;
    r.addEventListener('input', () => { val.textContent = `×${r.value}`; });
    r.addEventListener('change', () => set(k, Number(r.value)));
    return row(lab(label), r, val);
  };
  const nIn = inp('人数', 500, 70, 'number');
  const kind = sel([['mix', '混编'], ['cav', '金甲天骑'], ['guard', '金刚力士'], ['gun', '神机天兵'], ['bow', '天弓骑']], 'mix', 100);
  const goldIn = inp('银两', 1000000, 100, 'number'), renIn = inp('声望', 9999, 80, 'number');
  const tpSel = sel(stOpts(), '', 200);
  const army = count(player()?.troops ?? []);
  return h('div', null,
    h('div', { class: `gm-master ${GOD.on ? 'on' : ''}` },
      h('button', { class: `gm-big ${GOD.on ? 'on' : ''}`, onclick: () => set('on', !GOD.on) }, GOD.on ? '☀ 天命加身（点击收起）' : '☾ 天命未开（点击降临）'),
      h('span', { class: 'dim' }, GOD.on ? '其他玩家看不到任何异样：金光只有你自己看得见（除非开“显圣”）。' : '开启后以下神通生效。'),
    ),
    card('神通',
      h('div', { class: 'gm-grid' },
        tog('invincible', '金身无敌', '本部兵马与你本人刀枪不入、永不溃逃；自动结算零损失必胜'),
        tog('oneHit', '一击必杀', '本部兵马与你一击毙敌'),
        tog('any', '无视敌我', '可截击/攻城任何人：友军、新手保护、PvP 关闭都拦不住'),
        tog('hidden', '隐身', '别人地图上看不到你、在线名单里也没有你，AI 不会追你'),
        tog('eye', '天眼', '大地图无视野限制，所有部队一览无余'),
        tog('aura', '金光', '大地图与战场上的金色光环（默认只有你自己看得见）'),
        tog('reveal', '显圣', '让所有人都看见你的金光（慎用：会暴露）'),
      ),
      slider('mapSpeed', '神行（大地图）', 1, 50, 1),
      slider('battleSpeed', '疾风（战场本部）', 1, 4, 0.2),
    ),
    card(`天兵（当前麾下 ${army} 人）`,
      row(nIn, kind, B('⚡ 召天兵', () => run('godarmy', nIn.value, kind.value), 'sm gold'), B('补满伤兵', () => run('heal', '我')), B('解散全部兵马', () => confirmDialog('解散', '确定清空你的全部兵马？', () => run('cleartroops', '我')))),
      h('p', { class: 'dim small' }, '天兵：金甲天骑 / 金刚力士 / 神机天兵 / 天弓骑——只能由此召出，不进任何招募池与商店，无军饷。'),
    ),
    card('自身',
      row(B('满级满属性满技能', () => run('maxhero', '我')), B('神兵神甲（全套最好装备）', () => run('gear', '我')), B('满血', () => run('heal', '我'))),
      row(lab('银两设为'), goldIn, B('设定', () => run('setgold', '我', goldIn.value)), lab('声望设为'), renIn, B('设定', () => run('setrenown', '我', renIn.value))),
      row(B('🎯 点地图瞬移', () => { GODUI.tpArm = true; closeAll(); toast('缩地成寸：点击地图任意位置'); }, 'sm gold'), lab('或瞬移到'), tpSel, B('前往', () => run('tp', '我', tpSel.value))),
    ),
  );
}

// ---------- 玩家 ----------
function tabPlayers() {
  const f = inp('搜索名号', G.filter, 120);
  f.addEventListener('input', () => { G.filter = f.value; const pos = f.selectionStart; render(); const nf = G.root?.querySelector('.gm-filter') as HTMLInputElement | null; if (nf) { nf.focus(); nf.setSelectionRange(pos, pos); } });
  f.classList.add('gm-filter');
  const list = G.plist.filter(p => !G.filter || p.name.includes(G.filter));
  const table = h('div', { class: 'gm-table' },
    h('div', { class: 'gm-tr gm-th' }, ...['名号', '状态', '国', '级', '银两', '声望', '兵'].map(x => h('span', null, x))),
    ...list.slice(0, 120).map(p => h('div', { class: `gm-tr ${G.sel === p.name ? 'sel' : ''}`, onclick: () => { G.sel = p.name; render(); } },
      h('span', null, p.name, p.gm ? h('i', { class: 'gm-tag' }, p.gm >= 2 ? '主' : '助') : null, p.banned ? h('i', { class: 'gm-tag bad' }, '封') : null, p.muted ? h('i', { class: 'gm-tag' }, '禁言') : null, p.protect ? h('i', { class: 'gm-tag good' }, '保护') : null),
      h('span', { class: p.online ? 'good' : 'dim' }, p.online ? '在线' : '离线'),
      h('span', { style: { color: p.nation ? FACTION[p.nation]?.css : '#888' } }, p.nation ? FACTION[p.nation]?.name ?? p.nation : '—'),
      h('span', null, String(p.lvl || '-')), h('span', null, String(p.gold)), h('span', null, String(p.renown)), h('span', null, String(p.troops)))),
  );
  return h('div', null, row(f, B('刷新', () => run('plist')), h('span', { class: 'dim' }, `共 ${G.plist.length} 人，在线 ${G.plist.filter(p => p.online).length}`)), table, G.sel ? playerEditor(G.sel) : h('p', { class: 'dim' }, '点一行选中玩家，下面就能改他的一切。'));
}
function playerEditor(name: string) {
  const p = G.plist.find(x => x.name === name);
  const gIn = inp('银两', p?.gold ?? 0, 100, 'number'), rIn = inp('声望', p?.renown ?? 0, 80, 'number'), lIn = inp('等级', p?.lvl ?? 1, 60, 'number');
  const tSel = sel(troopOpts(), 'god_cav', 190), tN = inp('数量', 100, 70, 'number');
  const fSel = sel(factionOpts(), p?.nation ?? '', 110);
  const stSel = sel(stOpts(), '', 200);
  const mIn = inp('分钟', 30, 60, 'number'), pwIn = inp('新密码', '', 100);
  const owner = NET.gmLevel >= 2;
  const me = name === NET.name;
  return card(`编辑：${name}${p?.online ? '（在线）' : '（离线，改动下次上线生效）'}`,
    row(lab('银两'), gIn, B('设为', () => run('setgold', name, gIn.value)), B('+1万', () => run('gold', name, 10000)), lab('声望'), rIn, B('设为', () => run('setrenown', name, rIn.value)), lab('等级'), lIn, B('设为', () => run('level', name, lIn.value))),
    row(lab('兵力'), tSel, tN, B('增加', () => run('troops', name, tSel.value, tN.value)), B('减少', () => run('troops', name, tSel.value, -Number(tN.value))), B('设为', () => run('settroops', name, tSel.value, tN.value)), B('清空', () => confirmDialog('清空兵力', `清空${name}的全部兵马？`, () => run('cleartroops', name))), B('治疗', () => run('heal', name))),
    row(B('满级满属性', () => run('maxhero', name)), B('神兵神甲', () => run('gear', name)), lab('改投'), fSel, B('确定', () => run('nation', name, fSel.value))),
    row(lab('传送到'), stSel, B('传送', () => run('tp', name, stSel.value)), me ? null : B('拉到我身边', () => run('tpme', name)), me ? null : B('我飞过去', () => run('goto', name))),
    row(B('解除新手保护', () => run('noprotect', name)), B('恢复新手保护', () => run('reprotect', name)), lab('禁言'), mIn, B('禁言', () => run('mute', name, mIn.value)), B('解禁', () => run('unmute', name))),
    me ? null : row(B('踢出', () => run('kick', name)), B('封禁', () => confirmDialog('封禁', `封禁${name}？`, () => run('ban', name)), 'sm danger'), B('解封', () => run('unban', name)),
      owner ? pwIn : null, owner ? B('重置密码', () => run('pass', name, pwIn.value)) : null,
      owner ? B('设为助手 GM', () => run('setgm', name, 'on')) : null, owner ? B('收回 GM', () => run('setgm', name, 'off')) : null),
  );
}

// ---------- 天下 ----------
function tabWorld() {
  // 城池
  const sSel = sel(stOpts(true), G.stSel || Object.values(S.settlements).find(s => s.kind === 'town')!.id, 230);
  sSel.addEventListener('change', () => { G.stSel = sSel.value; render(); });
  const st: Settlement | undefined = S.settlements[sSel.value];
  const ownF = sel(factionOpts(), st?.faction ?? '', 110), ownP = inp('玩家名（可空）', '', 110);
  const gN = inp('人数', 200, 70, 'number'), gT = sel(troopOpts(true), '', 190);
  const prIn = inp('繁荣', Math.round(st?.prosperity ?? 50), 60, 'number'), rcIn = inp('兵源', Math.floor(st?.recruits ?? 0), 60, 'number');
  // 外交
  const fa = sel(factionOpts(), 'ming', 100), fb = sel(factionOpts(), 'jin', 100);
  const rnF = sel(factionOpts(false), 'ming', 100), rnN = inp('新国号', '', 90);
  // 召兵
  const spF = sel(factionOpts(), 'ming', 100), spS = sel(stOpts(), '', 200), spN = inp('人数', 500, 70, 'number'), spT = sel(troopOpts(true), '', 190);
  // 领主
  const lords = Object.values(S.lords).sort((a, b) => a.faction.localeCompare(b.faction));
  const lSel = sel(lords.map(l => [l.id, `${l.name}（${FACTION[l.faction]?.name ?? ''}${l.dead ? '·已死' : l.partyId ? '' : '·在城'}）`]), G.lordSel || lords[0]?.id || '', 200);
  lSel.addEventListener('change', () => { G.lordSel = lSel.value; });
  const lF = sel(factionOpts(), 'ming', 100), lS = sel(stOpts(), '', 200);
  // 部队
  const pf = inp('筛选名字', G.partyFilter, 100);
  pf.addEventListener('change', () => { G.partyFilter = pf.value; render(); });
  const me = player();
  const near = S.parties.filter(p => p.id !== me.id && !p.inside && (!G.partyFilter || p.name.includes(G.partyFilter) || (p.lordId && S.lords[p.lordId]?.name.includes(G.partyFilter))))
    .map(p => ({ p, d: Math.hypot(p.x - me.x, p.y - me.y) })).sort((a, b) => a.d - b.d).slice(0, 25);
  const ownerTxt = st ? (st.owner === 'player' ? '你' : st.owner?.startsWith('P:') ? st.owner.slice(2) : st.owner ? S.lords[st.owner]?.name ?? st.owner : '无') : '';
  return h('div', null,
    card('城池',
      row(sSel, st ? h('span', { class: 'dim' }, `${FACTION[st.faction]?.name ?? ''}｜领主 ${ownerTxt}｜守军 ${healthy(st.garrison)}｜繁荣 ${Math.round(st.prosperity)}｜兵源 ${Math.floor(st.recruits)}${st.siege ? '｜被围' : ''}`) : null),
      row(lab('归属'), ownF, ownP, B('易主', () => run('owner', sSel.value, ownF.value, ownP.value.trim()))),
      row(lab('守军'), gN, gT, B('增兵', () => run('garrison', sSel.value, gN.value, gT.value)), B('减兵', () => run('garrison', sSel.value, -Number(gN.value))), B('清空守军', () => run('cleargarrison', sSel.value))),
      row(lab('繁荣'), prIn, B('设', () => run('prosperity', sSel.value, prIn.value)), lab('兵源'), rcIn, B('设', () => run('strecruits', sSel.value, rcIn.value))),
    ),
    card('势力与外交',
      row(fa, h('span', null, '与'), fb, B('宣战', () => run('war', fa.value, fb.value), 'sm danger'), B('议和', () => run('peace', fa.value, fb.value)), B('结盟', () => run('ally', fa.value, fb.value)), B('停战', () => run('truce', fa.value, fb.value)), B('前者收后者为藩属', () => run('vassal', fa.value, fb.value)), B('背盟', () => run('betray', fa.value, fb.value))),
      row(lab('改国号'), rnF, rnN, B('改', () => run('rename', rnF.value, rnN.value.trim()))),
      h('p', { class: 'dim small' }, `当前战争：${S.wars.map(w => w.split('|').map(f => FACTION[f]?.name ?? f).join('×')).join('、') || '无'}`),
    ),
    card('召出大军',
      row(spF, h('span', null, '于'), spS, spN, spT, B('召出', () => run('spawn', spF.value, spS.value, spN.value, spT.value), 'sm gold')),
    ),
    card('领主',
      row(lSel, B('处死', () => run('lordkill', lSel.value), 'sm danger'), B('复生', () => run('lordrevive', lSel.value)), lab('改投'), lF, B('确定', () => run('lordfaction', lSel.value, lF.value)), lab('移到'), lS, B('移', () => run('lordtp', lSel.value, lS.value))),
    ),
    card(`部队（离你最近的 25 支${GOD.eye || !GOD.on ? '' : '；开天眼可看到全部'}）`,
      row(pf, B('刷新', () => render())),
      h('div', { class: 'gm-table' }, ...near.map(({ p, d }) => h('div', { class: 'gm-tr' },
        h('span', null, `#${p.id} ${p.kind === 'lord' && p.lordId ? S.lords[p.lordId]?.name ?? p.name : p.name}`),
        h('span', { style: { color: FACTION[p.faction]?.css ?? '#aaa' } }, FACTION[p.faction]?.name ?? p.faction),
        h('span', null, `${healthy(p.troops)} 人`), h('span', { class: 'dim' }, `${Math.round(d)} 里`),
        h('span', null, B('抹去', () => { run('smite', p.id); setTimeout(render, 600); }, 'sm danger'), B('拉来', () => run('partytp', p.id, 'me')))))),
    ),
  );
}

// ---------- 时间规则 ----------
function tabRules() {
  const st = G.status; const c = st?.cfg ?? NET.cfg;
  const r = st?.recruit ?? { perSec: 1, cap: 60 }, sp = st?.speed ?? { player: { max: 10, min: 7 }, ai: { max: 8, min: 5 } }, ind = st?.indep ?? { renown: 300, troops: 50, emperorCities: 6, maxKingdoms: 8 };
  const ad = inp('日', c.allianceOpenDay, 60, 'number'), nb = inp('小时', st?.newbieHours ?? 2, 60, 'number');
  const rs = inp('每秒', r.perSec, 60, 'number'), rc = inp('上限', r.cap, 60, 'number');
  const s1 = inp('玩家max', sp.player.max, 60, 'number'), s2 = inp('玩家min', sp.player.min, 60, 'number'), s3 = inp('AImax', sp.ai.max, 60, 'number'), s4 = inp('AImin', sp.ai.min, 60, 'number');
  const i1 = inp('声望', ind.renown, 60, 'number'), i2 = inp('兵力', ind.troops, 60, 'number'), i3 = inp('称帝城数', ind.emperorCities, 60, 'number'), i4 = inp('国家上限', ind.maxKingdoms, 60, 'number');
  const spIn = inp('时/秒', c.hoursPerSec, 60, 'number');
  const after = () => setTimeout(() => run('status'), 300);
  return h('div', null,
    card(`时间（第 ${Math.floor(S.time / 24)} 日 · 每秒 ${c.hoursPerSec} 游戏小时${c.paused ? ' · 已暂停' : ''}）`,
      row(...[0.1, 0.2, 0.4, 1, 2, 5].map(v => B(v === 0.4 ? '0.4 默认' : String(v), () => { run('speed', v); after(); })), spIn, B('设', () => { run('speed', spIn.value); after(); })),
      row(c.paused ? B('▶ 时间继续', () => { run('resume'); after(); }, 'sm gold') : B('⏸ 天下静止（只有你能动）', () => { run('pause'); after(); }, 'sm gold'), B('快进 1 日', () => run('time', 24)), B('快进 7 日', () => run('time', 168)), B('快进 1 年', () => run('time', 864))),
    ),
    card('规则',
      row(lab(`PvP：${c.pvp ? '开' : '关'}`), B('开', () => { run('pvp', 'on'); after(); }), B('关', () => { run('pvp', 'off'); after(); }), lab('结盟开放日'), ad, B('设', () => { run('allianceday', ad.value); after(); }), lab('新手保护（小时）'), nb, B('设', () => { run('protect', nb.value); after(); })),
      row(lab('村庄兵源'), rs, rc, B('设', () => { run('recruit', rs.value, rc.value); after(); })),
      row(lab('行军速度'), s1, s2, s3, s4, B('设', () => { run('speedcfg', s1.value, s2.value, s3.value, s4.value); after(); })),
      row(lab('自立条件'), i1, i2, i3, i4, B('设', () => { run('indepcfg', i1.value, i2.value, i3.value, i4.value); after(); })),
    ),
  );
}

// ---------- 管理 ----------
function tabAdmin() {
  const motd = inp('公告', NET.cfg.motd, 320), say = inp('广播内容', '', 320);
  const owner = NET.gmLevel >= 2;
  return h('div', null,
    card('服务器', row(B('概况', () => run('status')), B('玩家清单', () => run('players')), B('审计日志', () => run('audit')), B('立即存档', () => run('save')), B('立即备份', () => run('backup')))),
    card('公告与广播',
      row(lab('登录公告'), motd, B('更新', () => run('motd', ...motd.value.split(/\s+/)))),
      row(lab('天意广播'), say, B('发布', () => { if (say.value.trim()) run('say', ...say.value.trim().split(/\s+/)); say.value = ''; }, 'sm gold')),
    ),
    owner ? card('天命之主',
      row(B('换新令牌（旧令牌作废）', () => confirmDialog('换新令牌', '生成新的天命令牌，旧令牌立即作废（已认领的 GM 不受影响）。继续？', () => run('newkey'))),
        B('重置世界', () => confirmDialog('重置世界', '天地重开：所有城池、领主恢复初始，玩家角色保留。此操作会先把旧世界存为 world_prev。确定？', () => run('resetworld', 'confirm')), 'sm danger')),
      h('p', { class: 'dim small' }, '令牌在服务器的 DATA_DIR/GM_KEY.txt。别人拿到令牌就能认领天命——泄露了就换新的，再用“玩家 → 收回 GM”撤掉冒领者。'),
    ) : null,
  );
}

// ---------- 指令 ----------
function tabConsole() {
  const out = h('div', { class: 'gm-out' }, ...NET.gmLog.slice(-60).map(t => h('pre', null, t)));
  G.out = out;
  const input = h('input', { class: 'input', style: { width: '100%' }, placeholder: '输入指令，如：gold 李定国 5000（回车执行，help 查看全部）' }) as HTMLInputElement;
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const [cmd, ...args] = input.value.trim().split(/\s+/); if (cmd) send({ t: 'gm', cmd, args }); input.value = ''; } });
  setTimeout(() => { out.scrollTop = out.scrollHeight; input.focus(); }, 30);
  return h('div', null, row(B('帮助', () => run('help')), B('天命状态', () => run('god'))), out, input, h('p', { class: 'dim small' }, '聊天框里以 / 开头也能执行（如 /say 天下大赦），这些指令不会发到公屏。'));
}

/** 地图点选瞬移 */
GODUI.onTeleport = (x, y) => run('tpxy', Math.round(x), Math.round(y));
void partyById;
