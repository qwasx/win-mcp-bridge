// 声音与游戏的连接：解锁、按钮音、静音键、事件提示音、设置面板
import { engine, installAudioUnlock } from './engine';
import { sfx } from './sfx';
import { music } from './music';
import { on, S } from '../core/game';
import { h } from '../ui/dom';

export { engine, sfx, music };

let installed = false;
export function installAudio() {
  if (installed) return;
  installed = true;
  installAudioUnlock();
  // 所有按钮的点击音
  document.addEventListener('click', e => {
    const b = (e.target as HTMLElement | null)?.closest?.('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.disabled) { sfx('error', { vol: 0.5 }); return; }
    sfx(b.classList.contains('primary') || b.classList.contains('big') ? 'woodblock' : 'click', { vol: 0.55 });
  }, true);
  // M 键静音
  window.addEventListener('keydown', e => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'm' || e.key === 'M') {
      const m = engine.toggleMute();
      showSoundToast(m ? '已静音（M 键恢复）' : '声音已开启');
      updateSoundButtons();
    }
  });
  on('log', (_msg: string, cls?: string) => {
    if (cls === 'quest') sfx('quest', { vol: 0.7 });
    else if (cls === 'war') sfx('drum', { vol: 0.5 });
  });
}

function showSoundToast(t: string) {
  const el = document.getElementById('toast');
  if (el) { el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1400); return; }
  const n = document.createElement('div'); n.id = 'toast'; n.textContent = t; document.body.appendChild(n);
  requestAnimationFrame(() => n.classList.add('show')); setTimeout(() => n.classList.remove('show'), 1400);
}

// ---------- 大地图上的状态监听 ----------
let lastGold = -1, lastLevel = -1, lastRenown = -1;
export function worldAudioTick(night: boolean, panel: boolean) {
  music.play(night ? 'night' : 'world');
  music.ambience(night ? 'night' : 'day');
  if (!S) return;
  const gold = S.parties.find(p => p.kind === 'player')?.gold ?? 0;
  if (lastGold >= 0 && gold !== lastGold && panel) sfx('coin', { vol: 0.5 });
  if (lastLevel >= 0 && S.hero.level > lastLevel) sfx('levelup', { vol: 0.8 });
  if (lastRenown >= 0 && S.renown >= lastRenown + 15) sfx('gong', { vol: 0.35 });
  lastGold = gold; lastLevel = S.hero.level; lastRenown = S.renown;
}
export function resetWorldAudioWatch() { lastGold = -1; lastLevel = -1; lastRenown = -1; }

// ---------- 设置面板 ----------
const soundBtns = new Set<HTMLElement>();
export function soundButton(cls = 'hbtn') {
  const b = h('button', { class: `${cls} sound-btn`, title: '声音开关 (M)', onclick: () => { engine.toggleMute(); updateSoundButtons(); } }, '');
  soundBtns.add(b);
  updateOne(b);
  return b;
}
function updateOne(b: HTMLElement) { b.textContent = engine.settings.muted ? '🔇' : '🔊'; b.classList.toggle('muted', engine.settings.muted); }
export function updateSoundButtons() { for (const b of soundBtns) { if (!b.isConnected) soundBtns.delete(b); else updateOne(b); } }

export function soundSettings(): HTMLElement {
  const row = (label: string, key: 'master' | 'music' | 'sfx') => {
    const val = h('span', { class: 'vol-val' }, `${Math.round(engine.settings[key] * 100)}`);
    const input = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(engine.settings[key] * 100)), class: 'vol' }) as HTMLInputElement;
    input.addEventListener('input', () => { engine.set({ [key]: Number(input.value) / 100 }); val.textContent = input.value; });
    input.addEventListener('change', () => sfx(key === 'music' ? 'woodblock' : 'clash', { vol: 0.6 }));
    return h('div', { class: 'vol-row' }, h('span', { class: 'vol-label' }, label), input, val);
  };
  const mute = h('input', { type: 'checkbox' }) as HTMLInputElement;
  mute.checked = engine.settings.muted;
  mute.addEventListener('change', () => { engine.set({ muted: mute.checked }); updateSoundButtons(); });
  return h('div', { class: 'sound-settings' },
    row('总音量', 'master'), row('音乐', 'music'), row('音效', 'sfx'),
    h('label', { class: 'vol-row' }, mute, h('span', null, ' 静音（快捷键 M）')),
    engine.failed ? h('p', { class: 'dim small' }, '当前浏览器不支持 WebAudio，无法播放声音。') : h('p', { class: 'dim small' }, '所有音乐与音效均为程序实时合成。'),
  );
}
