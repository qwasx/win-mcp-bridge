// 史书卷轴式的大事弹窗
import { h, openPanel, closeTop, btn } from './dom';
import { on, dateStr } from '../core/game';
import { sfx } from '../audio/sfx';
import { ref } from '../gameRef';
import type { Chronicle } from '../core/calendar';

const queue: Chronicle[] = [];
let showing = false;

function next() {
  const c = queue.shift();
  if (!c) { showing = false; return; }
  showing = true;
  if (c.big) sfx('horn', { vol: 0.8 });
  const paras = c.text.split('\n').filter(Boolean).map(t => h('p', null, t));
  const done = () => { closeTop(); next(); };
  const look = () => {
    const w = ref.game?.scene.getScene('World') as any;
    if (c.x != null && c.y != null) w?.lookAt?.(c.x, c.y);
    done();
  };
  openPanel('', h('div', { class: 'chron-body' },
    h('div', { class: 'chron-date' }, dateStr(undefined, false)),
    h('h2', { class: 'chron-title' }, c.title),
    h('div', { class: 'chron-text' }, ...paras),
    h('div', { class: 'chron-seal' }, '史'),
    h('div', { class: 'row chron-btns' },
      c.x != null ? btn('🔍 前往一观', look) : null,
      btn('知道了', done, 'primary'),
    ),
  ), { cls: `chron ${c.big ? 'big' : ''}`, onClose: () => next() });
}

on('chronicle', (c: Chronicle) => { queue.push(c); if (!showing) next(); });
