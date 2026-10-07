// 小地图：全图缩略、当前视野框、主角与可见部队；点击跳转
import { WORLD_W, WORLD_H } from '../core/terrain';

const MW = 200, MH = Math.round(MW * WORLD_H / WORLD_W);

class Minimap {
  el: HTMLElement | null = null;
  base: HTMLCanvasElement | null = null;
  cv: HTMLCanvasElement | null = null;
  onJump: ((x: number, y: number) => void) | null = null;
  last = 0;
  collapsed = false;

  mount(map: HTMLCanvasElement, onJump: (x: number, y: number) => void) {
    this.onJump = onJump;
    if (!this.base) {
      // 预先缩小（分两步，画质更好）
      const mid = document.createElement('canvas'); mid.width = MW * 2; mid.height = MH * 2;
      mid.getContext('2d')!.drawImage(map, 0, 0, mid.width, mid.height);
      const b = document.createElement('canvas'); b.width = MW; b.height = MH;
      b.getContext('2d')!.drawImage(mid, 0, 0, MW, MH);
      this.base = b;
    }
    if (!this.el) {
      const el = document.createElement('div'); el.id = 'minimap';
      const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH;
      const tog = document.createElement('button'); tog.className = 'mm-toggle'; tog.title = '收起/展开小地图'; tog.textContent = '—';
      tog.onclick = (e) => { e.stopPropagation(); this.collapsed = !this.collapsed; el.classList.toggle('collapsed', this.collapsed); tog.textContent = this.collapsed ? '图' : '—'; };
      const jump = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); this.onJump?.((e.clientX - r.left) / r.width * WORLD_W, (e.clientY - r.top) / r.height * WORLD_H); };
      let down = false;
      cv.addEventListener('mousedown', (e) => { down = true; jump(e); e.stopPropagation(); });
      cv.addEventListener('mousemove', (e) => { if (down) jump(e); });
      window.addEventListener('mouseup', () => { down = false; });
      el.appendChild(cv); el.appendChild(tog);
      document.getElementById('ui')?.appendChild(el) ?? document.body.appendChild(el);
      this.el = el; this.cv = cv;
    }
    this.show();
  }
  show() { if (this.el) this.el.style.display = ''; }
  hide() { if (this.el) this.el.style.display = 'none'; }

  update(view: { x: number; y: number; width: number; height: number }, player: { x: number; y: number }, dots: { x: number; y: number; c: string }[], night: number) {
    if (!this.cv || !this.base || this.collapsed) return;
    const now = performance.now(); if (now - this.last < 120) return; this.last = now;
    const c = this.cv.getContext('2d')!;
    const k = MW / WORLD_W;
    c.drawImage(this.base, 0, 0);
    if (night > 0) { c.fillStyle = `rgba(10,20,48,${night * 0.4})`; c.fillRect(0, 0, MW, MH); }
    for (const d of dots) { c.fillStyle = d.c; c.fillRect(d.x * k - 1, d.y * k - 1, 2.5, 2.5); }
    c.strokeStyle = '#fff6d0'; c.lineWidth = 1;
    c.strokeRect(Math.round(view.x * k) + 0.5, Math.round(view.y * k) + 0.5, Math.max(4, view.width * k), Math.max(4, view.height * k));
    const pulse = 2.5 + Math.sin(now / 250) * 0.8;
    c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(player.x * k, player.y * k, pulse, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a1a08'; c.stroke();
  }
}

export const minimap = new Minimap();
