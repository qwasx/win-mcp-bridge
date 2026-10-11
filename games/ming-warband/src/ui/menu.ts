// 主菜单、角色创建、游戏菜单、存读档
import { simErrors } from '../core/sim';
import { settings, saveSettings, FIELD_CAPS } from '../core/settings';
import { h, uiRoot, openPanel, closeTop, closeAll, btn, toast, confirmDialog } from './dom';
import { BACKGROUNDS, newGame, S, on, dateStr } from '../core/game';
import { SLOTS, readMeta, saveGame, loadGame, hasAnySave } from '../core/save';
import menuBg from '../assets/menu_bg.jpg';
import { music, soundButton, soundSettings } from '../audio/hooks';
import { helpContent } from './panels';
import { ATTRS } from '../core/character';

let menuRoot: HTMLElement | null = null;
let onStart: (() => void) | null = null;
let onQuit: (() => void) | null = null;
export function setMenuHooks(start: () => void, quit: () => void) { onStart = start; onQuit = quit; }

export function showMainMenu() {
  closeAll();
  music.play('menu'); music.ambience('none');
  menuRoot?.remove();
  const bg = h('div', { class: 'menu-bg' });
  const img = h('img', { src: menuBg, class: 'menu-map', alt: '' });
  bg.append(img, h('div', { class: 'menu-vignette' }), h('div', { class: 'menu-mist' }));
  menuRoot = h('div', { id: 'mainmenu' }, bg,
    h('div', { class: 'menu-sound' }, soundButton('menu-sound-btn')),
    h('div', { class: 'menu-box' },
      h('div', { class: 'title-wrap' },
        h('div', { class: 'title' }, '铁血大明'),
        h('div', { class: 'seal' }, '崇祯', h('br'), '八年')),
      h('div', { class: 'subtitle' }, '天下大乱 · 群雄逐鹿'),
      h('div', { class: 'menu-btns' },
        btn('新的征程', () => charCreate(), 'big primary'),
        btn('读取存档', () => openLoad(), 'big', !hasAnySave()),
        btn('游戏说明', () => openPanel('游戏说明', helpContent(), { wide: true }), 'big'),
        btn('声音设置', () => openPanel('声音设置', soundSettings()), 'big'),
      ),
      h('div', { class: 'menu-foot' }, '一款明末背景的 2D 策略角色扮演游戏 · 致敬《骑马与砍杀》'),
    ),
  );
  uiRoot().appendChild(menuRoot);
}
export function hideMainMenu() { menuRoot?.remove(); menuRoot = null; }

function charCreate() {
  let name = '';
  let bg = BACKGROUNDS[0].id;
  const nameInput = h('input', { class: 'input', placeholder: '请输入你的名字', maxlength: '8', value: pickName() }) as HTMLInputElement;
  const list = h('div', { class: 'bg-list' });
  const renderList = () => {
    list.innerHTML = '';
    for (const b of BACKGROUNDS) list.appendChild(h('div', { class: `bg-item ${b.id === bg ? 'sel' : ''}`, onclick: () => { bg = b.id; renderList(); } }, h('b', null, b.name), h('p', null, b.desc)));
  };
  renderList();
  openPanel('创建角色', h('div', null,
    h('p', { class: 'flavor' }, '崇祯八年正月，流寇蜂起，后金叩关，大明江山风雨飘摇。荥阳城外，十三家七十二营的义军首领刚刚聚首……在这乱世之中，你将如何书写自己的传奇？'),
    h('h4', null, '姓名'), h('div', { class: 'row' }, nameInput, btn('随机', () => { nameInput.value = pickName(); }, 'sm')),
    h('h4', null, '出身'), list,
    h('p', { class: 'dim' }, `初始属性：${ATTRS.map(a => a.name).join('、')}各 5 点，另有 2 点属性、3 点技能可自由分配（按 C 打开角色面板）。`),
    h('div', { class: 'row end' }, btn('踏上征程', () => {
      name = nameInput.value.trim() || '无名氏';
      closeAll();
      newGame(name, bg);
      hideMainMenu();
      onStart?.();
    }, 'primary big')),
  ), { wide: true });
}

const SURN = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高', '郑', '梁', '谢', '宋', '唐', '韩', '冯', '于', '董', '萧', '程', '沈', '岳', '戚', '袁', '邓'];
const GIVEN = ['定远', '承志', '怀安', '守义', '振武', '子龙', '云飞', '天佑', '世杰', '国栋', '元直', '景明', '长风', '破虏', '文渊', '仲达', '伯言', '靖之', '镇岳', '安邦', '鹏举', '致远', '慕白', '凌霄'];
function pickName() { return SURN[Math.floor(Math.random() * SURN.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)]; }

function slotLabel(s: string) { return s === 'auto' ? '自动存档' : `存档 ${s}`; }
function metaText(s: string) {
  const m = readMeta(s);
  if (!m) return '（空）';
  return `${m.name} · ${m.level}级 · ${m.date} · ${new Date(m.savedAt).toLocaleString()}`;
}

export function openLoad() {
  openPanel('读取存档', h('div', { class: 'menu' }, ...SLOTS.map(s => btn(h('span', null, h('b', null, slotLabel(s)), h('small', null, `　${metaText(s)}`)), () => {
    if (!loadGame(s)) return toast('读取失败');
    closeAll(); hideMainMenu(); onStart?.(); toast('读取成功');
  }, 'menu-item', !readMeta(s)))));
}

export function openSave() {
  openPanel('保存游戏', h('div', { class: 'menu' }, ...SLOTS.filter(s => s !== 'auto').map(s => btn(h('span', null, h('b', null, slotLabel(s)), h('small', null, `　${metaText(s)}`)), () => {
    const doSave = () => { if (saveGame(s)) { toast('已保存'); closeAll(); } else toast('保存失败（存储空间不足？）'); };
    if (readMeta(s)) confirmDialog('覆盖存档', '确定要覆盖这个存档吗？', doSave); else doSave();
  }, 'menu-item'))));
}

export function openBattleSettings() {
  const body = h('div');
  const render = () => {
    body.replaceChildren(
      h('h4', null, '战场规模（敌我双方同时在场的最多人数）'),
      h('div', { class: 'row' }, ...FIELD_CAPS.map(([n, label]) => btn(label, () => { settings.fieldCap = n; saveSettings(); render(); }, settings.fieldCap === n ? 'primary' : ''))),
      h('p', { class: 'dim' }, '超出上限的兵力作为后援，前线有人倒下就陆续补上。千人大战需要较好的电脑；若觉卡顿可调小。'),
      h('h4', null, '战前布阵'),
      h('div', { class: 'row' }, btn(settings.deploy ? '✔ 开战前先布阵' : '✘ 直接开战', () => { settings.deploy = !settings.deploy; saveSettings(); render(); }, settings.deploy ? 'primary' : '')),
    );
  };
  render();
  openPanel('战场设置', body);
}

function openErrorReport() {
  const text = simErrors.map(e => `[${dateStr(e.at)}] ${e.where}: ${e.msg}`).join('\n\n');
  const ta = h('textarea', { class: 'err-report', readonly: true }, text) as HTMLTextAreaElement;
  openPanel('错误报告', h('div', null,
    h('p', null, '游戏后台出现了以下错误（已自动跳过，不影响继续游玩）。把这段文字复制发给开发者，可以帮助修复问题。'),
    ta,
    h('div', { class: 'row' }, btn('复制全部', () => { ta.select(); try { navigator.clipboard?.writeText(text); } catch { document.execCommand('copy'); } toast('已复制'); }, 'primary')),
  ), { wide: true });
}

export function openGameMenu() {
  openPanel('菜单', h('div', { class: 'menu' },
    btn('继续游戏', () => closeTop(), 'menu-item primary'),
    btn('保存游戏', () => openSave(), 'menu-item'),
    btn('读取存档', () => openLoad(), 'menu-item'),
    btn('游戏说明', () => openPanel('游戏说明', helpContent(), { wide: true }), 'menu-item'),
    btn('声音设置', () => openPanel('声音设置', soundSettings()), 'menu-item'),
    btn('战场设置', () => openBattleSettings(), 'menu-item'),
    simErrors.length ? btn(`⚠ 错误报告（${simErrors.length}）`, () => openErrorReport(), 'menu-item') : null,
    btn('返回主菜单', () => confirmDialog('返回主菜单', '未保存的进度将会丢失（自动存档除外）。确定吗？', () => { onQuit?.(); }), 'menu-item danger'),
  ));
}

on('victory', () => {
  openPanel('一统天下', h('div', { class: 'report win' },
    h('div', { class: 'report-title' }, '天下归一'),
    h('p', null, `历经 ${Math.floor(S.time / 24)} 天的征战，${S.hero.name}终于扫平群雄，四海归心。史书将永远铭记这个名字。`),
    h('p', { class: 'dim' }, '你可以继续游戏，也可以重新开始一段新的传奇。'),
    h('div', { class: 'row end' }, btn('继续', () => closeTop(), 'primary')),
  ));
});
