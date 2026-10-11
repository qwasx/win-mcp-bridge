// 持久化：node:sqlite（账号、玩家档案、世界存档、配置）
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PRec } from '../src/net/protocol';

export interface UserRow { name: string; salt: string; hash: string; token: string | null; rec: string; created: number; last: number; banned: number; gm: number }

export class DB {
  db: DatabaseSync;
  constructor(public dir: string) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(join(dir, 'world.db'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, salt TEXT, hash TEXT, token TEXT, rec TEXT, created INTEGER, last INTEGER, banned INTEGER DEFAULT 0, gm INTEGER DEFAULT 0);
      CREATE INDEX IF NOT EXISTS users_token ON users(token);
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, at INTEGER);
      CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, ch TEXT, who TEXT, text TEXT);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, who TEXT, what TEXT);
    `);
  }
  // ---------- 账号 ----------
  static hashPass(pass: string, salt: string) { return scryptSync(pass, salt, 32).toString('hex'); }
  user(name: string): UserRow | undefined { return this.db.prepare('SELECT * FROM users WHERE name = ?').get(name) as unknown as UserRow | undefined; }
  userByToken(token: string): UserRow | undefined { return this.db.prepare('SELECT * FROM users WHERE token = ?').get(token) as unknown as UserRow | undefined; }
  register(name: string, pass: string, rec: PRec): string {
    const salt = randomBytes(12).toString('hex');
    const token = randomBytes(24).toString('hex');
    const gm = (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n === 0 ? 1 : 0; // 第一个注册的账号自动成为 GM
    this.db.prepare('INSERT INTO users (name, salt, hash, token, rec, created, last, banned, gm) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)')
      .run(name, salt, DB.hashPass(pass, salt), token, JSON.stringify(rec), Date.now(), Date.now(), gm);
    return token;
  }
  checkPass(u: UserRow, pass: string) {
    const a = Buffer.from(DB.hashPass(pass, u.salt), 'hex'), b = Buffer.from(u.hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
  newToken(name: string) { const t = randomBytes(24).toString('hex'); this.db.prepare('UPDATE users SET token = ?, last = ? WHERE name = ?').run(t, Date.now(), name); return t; }
  saveRec(name: string, rec: PRec) { this.db.prepare('UPDATE users SET rec = ?, last = ? WHERE name = ?').run(JSON.stringify(rec), Date.now(), name); }
  setFlag(name: string, col: 'banned' | 'gm', v: number) { this.db.prepare(`UPDATE users SET ${col} = ? WHERE name = ?`).run(v, name); }
  setPass(name: string, pass: string) { const salt = randomBytes(12).toString('hex'); this.db.prepare('UPDATE users SET salt = ?, hash = ?, token = NULL WHERE name = ?').run(salt, DB.hashPass(pass, salt), name); }
  allUsers(): { name: string; last: number; banned: number; gm: number; rec: string }[] {
    return this.db.prepare('SELECT name, last, banned, gm, rec FROM users ORDER BY last DESC').all() as unknown as { name: string; last: number; banned: number; gm: number; rec: string }[];
  }
  // ---------- 键值 ----------
  get(k: string): string | null { const r = this.db.prepare('SELECT v FROM kv WHERE k = ?').get(k) as { v: string } | undefined; return r ? r.v : null; }
  set(k: string, v: string) { this.db.prepare('INSERT INTO kv (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at').run(k, v, Date.now()); }
  del(k: string) { this.db.prepare('DELETE FROM kv WHERE k = ?').run(k); }
  // ---------- 聊天与审计 ----------
  chat(ch: string, who: string, text: string) { this.db.prepare('INSERT INTO chat (at, ch, who, text) VALUES (?, ?, ?, ?)').run(Date.now(), ch, who, text); }
  recentChat(n = 40): { at: number; ch: string; who: string; text: string }[] {
    return (this.db.prepare("SELECT at, ch, who, text FROM chat WHERE ch = 'all' ORDER BY id DESC LIMIT ?").all(n) as unknown as { at: number; ch: string; who: string; text: string }[]).reverse();
  }
  audit(who: string, what: string) { this.db.prepare('INSERT INTO audit (at, who, what) VALUES (?, ?, ?)').run(Date.now(), who, what); }
  recentAudit(n = 60) { return this.db.prepare('SELECT at, who, what FROM audit ORDER BY id DESC LIMIT ?').all(n); }
  /** 每天一份世界备份（防止误操作） */
  backup() {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const f = join(this.dir, `backup-${day}.db`);
      if (!existsSync(f)) { this.db.exec('PRAGMA wal_checkpoint(FULL)'); copyFileSync(join(this.dir, 'world.db'), f); }
    } catch (e) { console.error('[db] backup failed', e); }
  }
  close() { try { this.db.close(); } catch { /* */ } }
}
