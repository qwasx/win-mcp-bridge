// 天命令牌：GM（上帝）身份的唯一凭证。
// 服务器第一次启动时随机生成，写进 DATA_DIR/GM_KEY.txt（只有能登录服务器的人看得到），也可用环境变量 GM_KEY 指定。
// 游戏里在聊天框输入「/天命 令牌」即可认领（这条消息不会发给任何人）。认领后成为“天命之主”（gm=2）。
import { randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from './db';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易看错的 I O 0 1

function gen() {
  let k = '';
  for (let i = 0; i < 16; i++) { if (i && i % 4 === 0) k += '-'; k += ALPHA[randomInt(ALPHA.length)]; }
  return k;
}
const norm = (k: string) => String(k ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const h = (k: string) => createHash('sha256').update(norm(k)).digest();

export class GmKey {
  private key = '';
  fromEnv = false;
  constructor(private db: DB, private dir: string) {
    const env = process.env.GM_KEY?.trim();
    if (env && norm(env).length >= 8) { this.key = env; this.fromEnv = true; }
    else { this.key = db.get('gm_key') ?? ''; if (!this.key) { this.key = gen(); db.set('gm_key', this.key); } }
    this.writeFile();
    console.log(`[gm] 天命令牌：${this.key}${this.fromEnv ? '（来自环境变量 GM_KEY）' : ''}`);
    console.log(`[gm] 已写入 ${join(dir, 'GM_KEY.txt')}。进游戏后在聊天框输入「/天命 ${this.key}」即可成为上帝（只有你自己看得到这条指令）。`);
  }
  private writeFile() {
    const f = join(this.dir, 'GM_KEY.txt');
    try {
      writeFileSync(f, `《铁血大明》天命令牌（GM 上帝凭证）\n\n${this.key}\n\n用法：进入游戏世界后，在聊天框输入\n/天命 ${this.key}\n这条指令不会发给任何人。认领成功后右上角出现“⚙ 天意”按钮。\n\n令牌泄露了？认领后在“天意 → 管理”里点“换新令牌”（或 GM 指令 newkey），旧令牌立即作废。\n${this.fromEnv ? '\n（当前令牌来自环境变量 GM_KEY，换新令牌只在本次运行有效；要永久更换请改环境变量。）\n' : ''}`);
      try { chmodSync(f, 0o600); } catch { /* */ }
    } catch (e) { console.error('[gm] 写 GM_KEY.txt 失败', e); }
  }
  check(k: string) { const a = h(k), b = h(this.key); return norm(k).length >= 8 && timingSafeEqual(a, b); }
  renew() { this.key = gen(); if (!this.fromEnv) this.db.set('gm_key', this.key); this.writeFile(); console.log(`[gm] 天命令牌已更换：${this.key}`); return this.key; }
}

/** 认领限流：每个 IP / 账号每小时最多 5 次失败 */
const fails = new Map<string, number[]>();
export function claimBlocked(...keys: string[]) {
  const now = Date.now();
  return keys.some(k => (fails.get(k) ?? []).filter(t => now - t < 3600_000).length >= 5);
}
export function claimFailed(...keys: string[]) {
  const now = Date.now();
  for (const k of keys) fails.set(k, [...(fails.get(k) ?? []).filter(t => now - t < 3600_000), now]);
}
