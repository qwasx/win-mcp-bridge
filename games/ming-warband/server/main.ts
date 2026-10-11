// 《铁血大明》联机服务器入口
// 环境变量：PORT（默认 8080）、DATA_DIR（默认 /workspace/ming-data 或 ./data）、DIST_DIR（客户端构建目录，默认 ../dist）
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { gzipSync } from 'node:zlib';
import { DB } from './db';
import { GmKey } from './gmkey';
import { NEWBIE } from '../src/net/protocol';
import * as W from './world';
import { initNet, onConnection, sessions, saveAll, heartbeat, pushOnline, broadcastRaw, checkOrphans } from './net';
import { kingdomTick } from './kingdom';
import { RECRUIT } from '../src/core/recruits';
import { DIPLO } from './diplomacy';
import { S } from '../src/core/game';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? (existsSync('/workspace') ? '/workspace/ming-data' : resolve(HERE, '../data'));
const DIST_DIR = process.env.DIST_DIR ?? resolve(HERE, '../dist');

console.log(`[boot] data=${DATA_DIR} dist=${DIST_DIR} port=${PORT}`);
const db = new DB(DATA_DIR);
const cfgRaw = db.get('cfg');
if (cfgRaw) { try { const c = JSON.parse(cfgRaw); Object.assign(W.CFG, c.cfg ?? {}); Object.assign(RECRUIT, c.recruit ?? {}); Object.assign(DIPLO, c.diplo ?? {}); } catch { /* */ } }
if (W.CFG.newbieHours !== undefined) NEWBIE.ms = W.CFG.newbieHours * 3600000;
const t0 = Date.now();
W.initWorld(db.get('world'));
console.log(`[boot] world ready in ${Date.now() - t0} ms`);
db.migrateGm();
initNet(db, new GmKey(db, DATA_DIR));

// ---------- 静态文件 ----------
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const ZIP_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
const gzCache = new Map<string, { mt: number; buf: Buffer }>();
async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, online: [...sessions].filter(s => s.entered).length, day: Math.floor(S.time / 24), parties: S.parties.length })); return; }
  let p = decodeURIComponent(url.pathname);
  if (p.includes('..')) { res.writeHead(400); res.end(); return; }
  if (p === '/' || p === '') p = '/index.html';
  let file = join(DIST_DIR, p);
  try { if (!(await stat(file)).isFile()) file = join(DIST_DIR, 'index.html'); } catch { file = join(DIST_DIR, 'index.html'); }
  try {
    const ext = extname(file);
    const headers: Record<string, string> = { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400', vary: 'accept-encoding' };
    // 文本类资源 gzip（压缩一次后缓存在内存；文件改动按修改时间失效）
    if (ZIP_EXT.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      const mt = (await stat(file)).mtimeMs;
      let z = gzCache.get(file);
      if (!z || z.mt !== mt) { z = { mt, buf: gzipSync(await readFile(file), { level: 9 }) }; gzCache.set(file, z); }
      headers['content-encoding'] = 'gzip';
      res.writeHead(200, headers); res.end(z.buf); return;
    }
    const body = await readFile(file);
    res.writeHead(200, headers);
    res.end(body);
  } catch { res.writeHead(404); res.end('客户端未构建：请先 npm run build'); }
}

const server = createServer((req, res) => { void serveStatic(req, res); });
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 1024 }, maxPayload: 512 * 1024 });
wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '?');
  onConnection(ws, ip);
});
server.listen(PORT, '0.0.0.0', () => console.log(`[boot] listening on 0.0.0.0:${PORT}`));

// ---------- 主循环 ----------
let last = Date.now(), lastPos = 0, lastParties = 0, lastWorld = 0, lastSave = Date.now(), lastHb = 0, lastBackup = 0;
let tickCost = 0, maxLag = 0;
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(1, (now - last) / 1000);
  maxLag = Math.max(maxLag, now - last - 100);
  last = now;
  const a = performance.now();
  W.tick(dt);
  tickCost = tickCost * 0.95 + (performance.now() - a) * 0.05;
  if (now - lastPos >= 400) { lastPos = now; broadcastRaw(JSON.stringify(W.posPacket())); for (const x of W.hiddenSelfPos()) W.OUT.send(x.acct, x.m); }
  if (now - lastParties >= 1000) { lastParties = now; const d = W.partiesDelta(); if (d.t === 'parties' && (d.up.length || d.gone.length)) broadcastRaw(JSON.stringify(d)); }
  if (now - lastWorld >= 3000) { lastWorld = now; kingdomTick(); checkOrphans(); const d = W.worldDelta(); if (d) broadcastRaw(JSON.stringify(d)); pushOnline(); }
  if (now - lastHb >= 20000) { lastHb = now; heartbeat(); }
  if (now - lastSave >= 60000) { lastSave = now; const b = performance.now(); saveAll(); console.log(`[save] ${Math.round(performance.now() - b)} ms; tick avg ${tickCost.toFixed(1)} ms; max lag ${maxLag} ms; online ${[...sessions].filter(s => s.entered).length}`); maxLag = 0; }
  if (now - lastBackup >= 6 * 3600 * 1000) { lastBackup = now; db.backup(); }
}, 100);

function shutdown(sig: string) {
  console.log(`[exit] ${sig}: saving…`);
  try { saveAll(); } catch (e) { console.error(e); }
  db.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', e => { console.error('[fatal]', e); });
