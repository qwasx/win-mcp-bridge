// 联机界面：登录 / 选国 / 聊天 / 在线 / 外交 / GM
import { h, uiRoot, openPanel, closeAll, closeTop, btn, toast, confirmDialog } from './dom';
import { S, BACKGROUNDS, atWar, allied, log } from '../core/game';
import { FACTION, type FactionId } from '../data/world';
import { NET, connect, send, onNet, defaultUrl, savedToken, clearToken, disconnect, type ChatMsg } from '../net/client';
import { NATIONS, RANK_NAMES, rankOf, ENVOY_RENOWN, WAR_RENOWN, newbieLeft } from '../net/protocol';
import { NETH } from '../net/hooks';
import { showReport } from './encounter';
import { healthy } from '../core/party';
import { EXILE_DAYS } from '../core/combat';
import { openGm, gmReply, gmGodChanged } from './gm';
import { ref } from '../gameRef';

let hooks: { start: () => void; quit: () => void } = { start: () => {}, quit: () => {} };
export function setMpHooks(start: () => void, quit: () => void) { hooks = { start, quit }; }

// ---------- 登录 ----------
export function openMpLogin() {
  const status = h('p', { class: 'dim' }, '');
  const name = h('input', { class: 'input', placeholder: '名号（2~12 个字）', maxlength: '12', value: localStorage.getItem('mw_name') ?? '' }) as HTMLInputElement;
  const pass = h('input', { class: 'input', placeholder: '密码（至少 4 位）', type: 'password' }) as HTMLInputElement;
  const url = h('input', { class: 'input', style: { width: '100%' }, value: defaultUrl() }) as HTMLInputElement;
  const adv = h('details', null, h('summary', { class: 'dim' }, '服务器地址（一般不用改）'), url);
  const go = async (kind: 'login' | 'register' | 'resume') => {
    status.textContent = '正在连接……';
    try {
      if (!NET.connected) await connect(url.value.trim());
      if (url.value.trim() !== `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) localStorage.setItem('mw_server', url.value.trim()); else localStorage.removeItem('mw_server');
    } catch { status.textContent = '连不上服务器。请确认服务器已开启、地址正确。'; return; }
    if (kind === 'resume') send({ t: 'resume', token: savedToken()! });
    else { localStorage.setItem('mw_name', name.value.trim()); send({ t: kind, name: name.value.trim(), pass: pass.value }); }
    status.textContent = '正在验证……';
  };
  authStatus = (t: string) => { status.textContent = t; };
  const tok = savedToken();
  openPanel('联机天下', h('div', { class: 'mp-login' },
    h('p', { class: 'flavor' }, '所有豪杰同在一个天下。开局须投效一国——大明、后金、闯军、西营、察哈尔，与天下英雄或并肩、或厮杀。世界从不停歇：你下线了，天下依旧在动。'),
    tok ? h('div', { class: 'row' }, btn(`继续上次的身份${localStorage.getItem('mw_name') ? `（${localStorage.getItem('mw_name')}）` : ''}`, () => go('resume'), 'primary big'), btn('换个账号', () => { clearToken(); closeTop(); openMpLogin(); }, 'sm')) : null,
    h('h4', null, '名号'), name, h('h4', null, '密码'), pass,
    h('div', { class: 'row', style: { marginTop: '10px' } }, btn('登录', () => go('login'), 'primary'), btn('注册新名号', () => go('register'))),
    status, adv,
    h('p', { class: 'dim' }, '提示：名号即你在天下的姓名，注册后不可更改。'),
  ));
}
let authStatus: (t: string) => void = () => {};

// ---------- 选国 ----------
function openNationPick() {
  closeAll();
  let nation: FactionId = 'ming', bg = BACKGROUNDS[0].id;
  const body = h('div');
  const render = () => {
    body.replaceChildren(
      h('p', { class: 'flavor' }, '崇祯八年，天下五分。择一国投效，你将成为它的臣属，与它同生共死——直到你有本事自立门户。'),
      h('div', { class: 'nation-list' }, ...NATIONS.map(f => {
        const F = FACTION[f]; const dead = S && S.alive ? !S.alive[f] : false;
        return h('div', { class: `nation-card ${f === nation ? 'sel' : ''} ${dead ? 'dead' : ''}`, style: { borderColor: F.css }, onclick: () => { if (!dead) { nation = f; render(); } } },
          h('div', { class: 'st-flag', style: { background: F.css } }, F.name[0]), h('b', null, F.name), h('small', null, ` ${F.rulerTitle}${F.ruler}`), h('p', null, F.desc));
      })),
      h('h4', null, '出身'),
      h('div', { class: 'bg-list' }, ...BACKGROUNDS.map(b => h('div', { class: `bg-item ${b.id === bg ? 'sel' : ''}`, onclick: () => { bg = b.id; render(); } }, h('b', null, b.name), h('p', null, b.desc)))),
      h('div', { class: 'row end' }, btn(`投效${FACTION[nation].name}`, () => { send({ t: 'create', nation, bg }); closeAll(); toast('正在进入天下……'); }, 'primary big')),
    );
  };
  render();
  openPanel('投效哪一国？', body, { wide: true, noClose: true });
}

// ---------- 网络事件 ----------
let overlay: HTMLElement | null = null;
let reconnectTries = 0;
onNet('auth', (m: any) => {
  if (!m.ok) { authStatus(m.err ?? '失败'); if (m.err?.includes('过期')) clearToken(); if (m.needCreate) openNationPick(); return; }
  reconnectTries = 0;
  if (m.needCreate) openNationPick();
});
onNet('welcome', () => {
  closeAll();
  document.body.classList.add('mp');
  hooks.start();
  mountOverlay();
  if (NET.cfg.motd) toast(NET.cfg.motd);
  log(`你进入了天下。${NET.rec?.nation ? `你效忠于${FACTION[NET.rec.nation].name}。` : ''}`, 'gold');
});
onNet('report', (m: any) => showReport({ title: m.title, win: m.title === '胜利', lines: m.lines, loot: [], prisoners: [] }));
onNet('kick', (why: string) => { leaveMp(); confirmDialog('离开天下', why, () => {}, '知道了', ''); });
onNet('disconnect', () => {
  if (!NET.inWorld) return;
  toast('与服务器断开，正在重连……');
  const retry = () => {
    reconnectTries++;
    if (reconnectTries > 6) { leaveMp(); confirmDialog('断线', '多次重连失败。请稍后再登录。', () => {}, '好', ''); return; }
    connect(NET.url).then(() => send({ t: 'resume', token: savedToken()! })).catch(() => setTimeout(retry, 2000 * reconnectTries));
  };
  setTimeout(retry, 1000);
});
onNet('chat', (m: ChatMsg) => pushChat(m));
onNet('online', () => renderOnline());
onNet('ping', () => renderOnline());
onNet('god', () => { if (gmBtn) gmBtn.style.display = NET.gm ? '' : 'none'; gmGodChanged(); });
onNet('gm', (t: string, data?: any) => {
  if (t && t.startsWith('INVITE|')) {
    const [, from, fid, fname] = t.split('|');
    confirmDialog('招揽', `${from}邀你投奔“${fname}”，归其麾下。你的封地将随你一同改换门庭，原国家会视你为叛臣。是否接受？`, async () => {
      const r = await NETH.req('acceptInvite', {});
      if (!r.ok) return toast(r.err ?? '失败');
      adoptFaction(r.data.faction, r.data.def);
      toast(`你已投奔${fname}`);
    }, '投奔', '婉拒');
    void fid; return;
  }
  gmReply(t, data);
});

export function leaveMp() {
  disconnect();
  overlay?.remove(); overlay = null;
  document.body.classList.remove('mp');
  hooks.quit();
}

// ---------- 浮层：聊天 + 按钮 ----------
let gmBtn: HTMLElement | null = null;
let chatBox: HTMLElement | null = null, chatCh: 'all' | 'nation' = 'all', onlineEl: HTMLElement | null = null;
function mountOverlay() {
  overlay?.remove();
  const input = h('input', { class: 'chat-input', placeholder: '说点什么…（回车发送，@名号 私聊）', maxlength: '200' }) as HTMLInputElement;
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && input.value.trim()) {
      const v = input.value.trim();
      const pm = /^[@＠](\S+)\s+([\s\S]+)$/.exec(v); // @名号 内容 = 私聊
      if (pm) { send({ t: 'chat', ch: 'pm', to: pm[1], text: pm[2] }); input.value = `@${pm[1]} `; }
      else { send({ t: 'chat', ch: chatCh, text: v }); input.value = ''; }
    }
    if (e.key === 'Escape') input.blur();
  });
  const tab = (k: 'all' | 'nation', label: string) => h('button', { class: `chat-tab ${chatCh === k ? 'sel' : ''}`, onclick: (e: Event) => { chatCh = k; (e.target as HTMLElement).parentElement!.querySelectorAll('.chat-tab').forEach(x => x.classList.remove('sel')); (e.target as HTMLElement).classList.add('sel'); } }, label);
  chatBox = h('div', { class: 'chat-lines' });
  onlineEl = h('span', { class: 'mp-online' }, '');
  overlay = h('div', { id: 'mp-ui' },
    h('div', { class: 'mp-bar' },
      onlineEl,
      h('button', { class: 'hbtn', onclick: () => openOnline() }, '👥 在线'),
      h('button', { class: 'hbtn', onclick: () => openDiplomacy() }, '🤝 外交'),
      gmBtn = h('button', { class: 'hbtn gm', onclick: () => openGm(), style: { display: NET.gm ? '' : 'none' } }, '⚙ 天意'),
      h('button', { class: 'hbtn', onclick: () => overlay!.classList.toggle('chat-hidden') }, '💬'),
    ),
    h('div', { class: 'mp-chat' }, h('div', { class: 'chat-tabs' }, tab('all', '天下'), tab('nation', '本国')), chatBox, input),
  );
  uiRoot().appendChild(overlay);
  for (const m of NET.chat.slice(-30)) pushChat(m);
  renderOnline();
}
function pushChat(m: ChatMsg) {
  if (!chatBox) return;
  const F = m.nation ? FACTION[m.nation] : null;
  const line = h('div', { class: `chat-line ${m.ch}` },
    m.ch === 'nation' ? h('span', { class: 'chat-ch' }, '[本国]') : m.ch === 'gm' ? h('span', { class: 'chat-ch gm' }, '[天意]') : m.ch === 'pm' ? h('span', { class: 'chat-ch pm' }, '[密]') : null,
    h('b', { style: { color: F?.css ?? '#f0d77a' }, onclick: () => { const i = document.querySelector('.chat-input') as HTMLInputElement | null; if (i && m.who !== NETH.name) { i.value = `@${m.who} `; i.focus(); } } }, m.who),
    m.ch === 'pm' && m.to ? h('span', { class: 'dim' }, `→${m.to}`) : null, '：', m.text);
  chatBox.appendChild(line);
  while (chatBox.children.length > 80) chatBox.firstChild!.remove();
  chatBox.scrollTop = chatBox.scrollHeight;
}
/** 在线人数 + 网络延迟 + 帧率（颜色提示：绿=流畅，黄=一般，红=卡） */
function renderOnline() {
  if (!onlineEl) return;
  const fps = Math.round((ref.game as any)?.loop?.actualFps ?? 0);
  const pc = NET.ping < 90 ? '#7fd87f' : NET.ping < 200 ? '#e8d070' : '#ff7a6a';
  const fc = fps >= 50 ? '#7fd87f' : fps >= 30 ? '#e8d070' : '#ff7a6a';
  onlineEl.replaceChildren(`在线 ${NET.online.length} 人`,
    NET.ping ? h('span', { style: { color: pc }, title: '网络往返延迟（毫秒）' }, ` · ${NET.ping}ms`) : '',
    fps ? h('span', { style: { color: fc }, title: '画面帧率' }, ` · ${fps}帧`) : '');
}

function openOnline() {
  const byN: Record<string, typeof NET.online> = {};
  for (const o of NET.online) (byN[o.nation ?? 'none'] ||= []).push(o);
  openPanel(`在线豪杰（${NET.online.length}）`, h('div', null,
    ...Object.entries(byN).map(([f, list]) => h('div', { class: 'card' },
      h('b', { style: { color: FACTION[f]?.css ?? '#888' } }, FACTION[f]?.name ?? '未投效'), h('span', { class: 'dim' }, ` ${list.length} 人`),
      h('div', { class: 'row wrap' }, ...list.map(o => h('span', { class: 'online-who' }, `${o.name} Lv${o.lvl} `,
        o.name === NETH.name ? null : btn('私聊', () => { closeAll(); const i = document.querySelector('.chat-input') as HTMLInputElement | null; if (i) { i.value = `@${o.name} `; i.focus(); } }, 'sm')))))),
    newbieNote(),
  ));
}

function newbieNote() {
  const left = newbieLeft(NET.rec ?? undefined);
  return left > 0 ? h('p', { class: 'good' }, `🛡 新手保护还剩 ${Math.ceil(left / 60000)} 分钟：其他玩家不能截击你（你主动截击他人则立即解除）。`) : null;
}
// ---------- 外交 ----------
export function openDiplomacy() {
  const me = S.playerFaction;
  if (!me) return toast('你尚未效忠任何国家');
  const ren = S.renown;
  const rank = RANK_NAMES[rankOf(ren)];
  const day = Math.floor(S.time / 24);
  const giftIn = h('input', { class: 'input', type: 'number', min: '0', step: '100', value: '0', style: { width: '110px' } }) as HTMLInputElement;
  const rows = NATIONS.filter(f => f !== me && S.alive[f]).map(f => {
    const F = FACTION[f];
    const t = (S.treaties ?? []).find(x => (x.a === me && x.b === f) || (x.a === f && x.b === me));
    const war = atWar(me, f);
    const left = t ? Math.max(0, Math.ceil((t.until - S.time) / 24)) : 0;
    const status = t ? (t.type === 'alliance' ? `盟约（剩 ${left} 日）` : t.type === 'truce' ? `停战（剩 ${left} 日）` : t.a === me ? `我之藩属（剩 ${left} 日）` : `我为其藩属（剩 ${left} 日）`) : war ? '交战' : '和平';
    const ask = (type: string, label: string) => btn(label, async () => {
      const r = await NETH.req('diplo', { to: f, type, gift: Number(giftIn.value) || 0 });
      toast(r.ok ? (r.data?.msg ?? '成功') : (r.err ?? '失败'));
      if (r.ok) { closeAll(); setTimeout(() => openDiplomacy(), 800); }
    }, 'sm', (type === 'war' ? ren < WAR_RENOWN || war : ren < ENVOY_RENOWN) || (type === 'alliance' && (war || !!t)) || ((type === 'truce' || type === 'peace') && !war) || (type === 'vassal' && !war));
    const fsts = Object.values(S.settlements).filter(s => s.faction === f && s.kind !== 'village').length;
    return h('div', { class: 'card diplo-row' },
      h('div', { class: 'row between' }, h('b', { style: { color: F.css } }, F.name), h('span', { class: war ? 'bad' : t?.type === 'alliance' ? 'good' : 'dim' }, status), h('span', { class: 'dim' }, `城池 ${fsts}`)),
      h('div', { class: 'row wrap' }, ask('alliance', '🤝 提议结盟'), ask('truce', '🕊 提议停战'), ask('peace', '📜 议和'), ask('vassal', '👑 迫其称臣'), ask('war', '⚔ 力主宣战')),
    );
  });
  const allies = (S.treaties ?? []).filter(t => t.type !== 'truce').map(t => `${FACTION[t.a]?.name}${t.type === 'alliance' ? '—' : '→'}${FACTION[t.b]?.name}${t.type === 'vassal' ? '（藩属）' : ''}`);
  openPanel('外交 · 合纵连横', h('div', null,
    h('p', null, `你效忠：`, h('b', { style: { color: FACTION[me].css } }, FACTION[me].name), `　官职：${rank}（声望 ${ren}）`),
    h('p', { class: 'dim' }, `声望 ${ENVOY_RENOWN} 起可出使议约（结盟、停战、议和、迫降），声望 ${WAR_RENOWN} 起可力主宣战。结盟自第 ${NET.cfg.allianceOpenDay} 日起开放（今天是第 ${day} 日）。盟国自动共享视野、在混战中互相助战，盟国有敌会应约参战；背盟者天下侧目，被背叛方获得复仇加成。礼金可提高成功率。`),
    h('div', { class: 'row' }, h('span', null, '随附礼金：'), giftIn, h('span', { class: 'dim' }, '两')),
    ...rows,
    h('h4', null, '天下盟约'), h('p', null, allies.length ? allies.join('　') : '尚无'),
    stateAffairs(),
  ), { wide: true });
  void allied; void healthy;
}

// ---------- 国事：自立 / 称帝 / 招揽 ----------
function adoptFaction(id: string, def: any) {
  if (def) FACTION[id] = def;
  S.playerFaction = id as FactionId;
  const pp = S.parties.find(p => p.id === S.playerId); if (pp) pp.faction = id as FactionId;
  if (NET.rec) NET.rec.nation = id as FactionId;
  S.alive[id] = true;
}
function exileNote(f: string) {
  const since = FACTION[f]?.exileSince;
  if (since == null) return null;
  const left = Math.max(0, Math.ceil(EXILE_DAYS - (S.time - since) / 24));
  return h('p', { class: 'bad' }, `⚠ 流亡政权：已失去全部城池。${left} 日内须夺回一座城堡或城镇，否则国祚断绝。`);
}
function stateAffairs() {
  const f = S.playerFaction;
  const box = h('div', { class: 'card' }, h('h4', null, '国事'));
  if (f && f.startsWith('p_')) { const n = exileNote(f); if (n) box.append(n); }
  if (f && f.startsWith('p_') && FACTION[f]?.ruler === S.hero.name) {
    const F = FACTION[f];
    const cities = Object.values(S.settlements).filter(s => s.faction === f && s.kind !== 'village').length;
    const who = h('input', { class: 'input', placeholder: '在线玩家名号', style: { width: '160px' } }) as HTMLInputElement;
    box.append(
      h('p', null, h('b', { style: { color: F.css } }, F.name), `　${F.rulerTitle}：${F.ruler}　城池 ${cities} 座`),
      h('p', { class: 'dim' }, F.desc),
      h('div', { class: 'row wrap' },
        btn(F.rulerTitle === '皇帝' ? '已登基' : `👑 登基称帝（需足够城池，默认 6 座）`, async () => { const r = await NETH.req('emperor', {}); toast(r.ok ? '登基大典已成！' : (r.err ?? '失败')); if (r.ok) closeAll(); }, 'sm primary', F.rulerTitle === '皇帝'),
        who, btn('🎌 招揽入伙', async () => { const r = await NETH.req('invite', { name: who.value.trim() }); toast(r.ok ? '使者已出发，等对方答复' : (r.err ?? '失败')); }, 'sm')),
    );
  } else if (f && f.startsWith('p_')) {
    box.append(h('p', null, `你是${FACTION[f]?.name}${FACTION[f]?.rulerTitle}${FACTION[f]?.ruler}的臣属。`));
  } else {
    box.append(h('p', { class: 'dim' }, '据城自立：拥有至少一座城堡或城镇、声望 300、麾下 50 名可战之兵，即可脱离故主、自建国号。故主必将兴师问罪。'),
      btn('🚩 自立为王……', () => openIndependence(), 'sm primary'));
  }
  return box;
}
export async function openIndependence() {
  const chk = await NETH.req('indepCheck', {});
  if (!chk.ok) return toast(chk.err ?? '条件不足');
  const fiefs: { id: string; name: string }[] = chk.data.fiefs;
  const nameIn = h('input', { class: 'input', maxlength: '4', placeholder: '国号（1~4 字）', value: '' }) as HTMLInputElement;
  const chIn = h('input', { class: 'input', maxlength: '1', placeholder: '旗字', style: { width: '70px' } }) as HTMLInputElement;
  const eraIn = h('input', { class: 'input', maxlength: '4', placeholder: '年号（可选）', style: { width: '130px' } }) as HTMLInputElement;
  const COLORS = ['#d4af37', '#1f7a5a', '#6a2c91', '#b8461e', '#2d4f8f', '#7d1a1a', '#3a3a3a', '#c06a9a'];
  let color = COLORS[0], cap = fiefs[0]?.id;
  const sw = h('div', { class: 'row wrap' });
  const drawSw = () => sw.replaceChildren(...COLORS.map(c => h('span', { class: `swatch ${c === color ? 'sel' : ''}`, style: { background: c }, onclick: () => { color = c; drawSw(); } })));
  drawSw();
  const capSel = h('select', { class: 'input', onchange: (e: Event) => { cap = (e.target as HTMLSelectElement).value; } }, ...fiefs.map(x => h('option', { value: x.id }, x.name))) as HTMLSelectElement;
  openPanel('自立为王', h('div', null,
    h('p', { class: 'flavor' }, '大丈夫生于乱世，当带三尺剑立不世之功！一旦自立，故主必视你为逆贼，天下诸侯也将重新掂量你的分量。'),
    h('div', { class: 'row' }, h('span', null, '国号'), nameIn, h('span', null, '旗字'), chIn),
    h('div', { class: 'row' }, h('span', null, '年号'), eraIn, h('span', null, '都城'), capSel),
    h('h4', null, '旗色'), sw,
    h('div', { class: 'row end' }, btn('昭告天下', async () => {
      const r = await NETH.req('indep', { name: nameIn.value.trim(), ch: chIn.value.trim(), color, capital: cap, era: eraIn.value.trim() });
      if (!r.ok) return toast(r.err ?? '失败');
      adoptFaction(r.data.id, r.data.def);
      closeAll(); toast(`你已自立为${r.data.def.name}王！`);
    }, 'primary big')),
  ), { wide: true });
}

void closeTop;
