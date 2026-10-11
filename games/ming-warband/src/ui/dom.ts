import { iconize } from './icons';
// 轻量 DOM 工具
import { sfx } from '../audio/sfx';
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, any> | null;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}
function append(el: HTMLElement, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else { const t = String(c); const ic = iconize(t); if (ic) for (const n of ic) el.appendChild(n); else el.appendChild(document.createTextNode(t)); }
  }
}

export const uiRoot = () => document.getElementById('ui')!;

let panelStack: HTMLElement[] = [];
export interface PanelOpts { wide?: boolean; noClose?: boolean; onClose?: () => void; cls?: string }

export function openPanel(title: string, body: Child, opts: PanelOpts = {}): HTMLElement {
  sfx('page', { vol: 0.7 });
  const close = () => { closeTop(); opts.onClose?.(); };
  const tip = document.getElementById('tooltip'); if (tip) tip.style.display = 'none';
  const win = h('div', { class: `panel ${opts.wide ? 'wide' : ''} ${opts.cls ?? ''}` },
    h('div', { class: 'panel-title' }, h('span', null, title), opts.noClose ? null : h('button', { class: 'x', onclick: close, title: '关闭 (Esc)' }, '✕')),
    h('div', { class: 'panel-body' }, body),
  );
  (win as any)._onClose = opts.noClose ? null : close;
  const overlay = h('div', { class: 'overlay' }, win);
  uiRoot().appendChild(overlay);
  panelStack.push(overlay);
  return win;
}
export function closeTop() { const o = panelStack.pop(); o?.remove(); }
export function closeAll() { while (panelStack.length) closeTop(); }
export function panelOpen() { return panelStack.length > 0; }
export function escTop() {
  const o = panelStack[panelStack.length - 1];
  if (!o) return false;
  const win = o.firstChild as any;
  if (win?._onClose) { win._onClose(); return true; }
  return true;
}
/** 用新的内容替换当前最上层面板（用于刷新） */
export function replaceTop(title: string, body: Child, opts: PanelOpts = {}) { closeTop(); return openPanel(title, body, opts); }

export function btn(label: Child, onclick: () => void, cls = '', disabled = false, title = '') {
  return h('button', { class: `btn ${cls}`, onclick: disabled ? undefined : onclick, disabled: disabled || undefined, title: title || undefined }, label);
}

let toastTimer = 0;
export function toast(msg: string) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast' }); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 2200);
}

export function bar(frac: number, color = '#c9a24a', label = '') {
  return h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: { width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color } }), label ? h('span', null, label) : null);
}

export function confirmDialog(title: string, msg: string, onYes: () => void, yes = '确定', no = '取消') {
  openPanel(title, h('div', null, h('p', null, msg), h('div', { class: 'row end' }, btn(no, () => closeTop()), btn(yes, () => { closeTop(); onYes(); }, 'primary'))));
}
