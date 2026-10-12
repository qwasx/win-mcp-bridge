// 联机测试用的无头客户端（node ws）。用法见 godtest.mjs / mpc3.mjs
import WebSocket from 'ws';
import { readFileSync } from 'node:fs';
export const URL = process.env.MPURL ?? 'ws://127.0.0.1:8091/ws';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
/** 读服务器写出的天命令牌 */
export function gmKey(dataDir = process.env.DATA_DIR ?? '/tmp/gt1') {
  const t = readFileSync(`${dataDir}/GM_KEY.txt`, 'utf8');
  return /\b([A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4})\b/.exec(t)[1];
}

export function client(name, nation, opt = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(opt.url ?? URL);
    const st = { name, ws, me: null, world: null, parties: new Map(), pending: new Map(), rid: 1, log: [], online: [], god: null, gmLevel: 0, auth: null, cfg: null };
    st.send = m => ws.send(JSON.stringify(m));
    st.req = (op, args) => new Promise(r => { const rid = st.rid++; st.pending.set(rid, r); st.send({ t: 'req', rid, op, args }); });
    st.gm = line => { const [cmd, ...args] = line.split(' '); st.send({ t: 'gm', cmd, args }); };
    st.chat = (text, ch = 'all', to) => st.send({ t: 'chat', ch, text, to });
    st.my = () => st.parties.get(st.me?.partyId);
    st.of = t => st.log.filter(m => m.t === t);
    st.waitFor = async (pred, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = st.log.find(pred); if (m) return m; await sleep(50); } return null; };
    st.gmReply = async (line, ms = 2500) => { const n = st.log.length; st.gm(line); const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = st.log.slice(n).find(x => x.t === 'gm'); if (m) return m; await sleep(40); } return null; };
    st.close = () => { try { ws.close(); } catch { /* */ } };
    ws.on('open', () => st.send(opt.token ? { t: 'resume', token: opt.token } : opt.login ? { t: 'login', name, pass: opt.pass ?? 'pass1234' } : { t: 'register', name, pass: opt.pass ?? 'pass1234' }));
    ws.on('error', reject);
    ws.on('message', (d, isBinary) => {
      if (isBinary) { st.bin = (st.bin ?? 0) + 1; st.binBytes = (st.binBytes ?? 0) + d.length; st.onBin?.(d); return; } // 实时战斗帧
      const m = JSON.parse(String(d));
      st.log.push(m);
      st.onMsg?.(m);
      if (m.t === 'auth') { st.auth = m; if (m.token) st.token = m.token; if (!m.ok) { if (!opt.allowFail) { console.log(name, 'auth err', m.err); process.exit(2); } resolve(st); } if (m.needCreate) st.send({ t: 'create', nation, bg: 'soldier' }); }
      if (m.t === 'welcome') { st.me = m; st.world = m.world; st.cfg = m.cfg; for (const p of m.parties) st.parties.set(p.id, p); resolve(st); }
      if (m.t === 'parties') { for (const p of m.up) st.parties.set(p.id, Object.assign(st.parties.get(p.id) ?? {}, { god: undefined }, p)); for (const id of m.gone) if (id !== st.me?.partyId) st.parties.delete(id); } // 与真客户端一致：自己的部队不因 gone 删除
      if (m.t === 'world') {
        for (const s of m.settlements ?? []) st.world.settlements[s.id] = Object.assign(st.world.settlements[s.id] ?? {}, s);
        for (const l of m.lords ?? []) st.world.lords[l.id] = l;
        for (const k of ['customFactions', 'wars', 'alive', 'treaties', 'fnames']) if (m[k]) st.world[k] = m[k];
      }
      if (m.t === 'pos') { for (let i = 0; i < m.a.length; i += 4) { const p = st.parties.get(m.a[i]); if (p) { p.x = m.a[i + 1] / 10; p.y = m.a[i + 2] / 10; } } }
      if (m.t === 'res') { const r = st.pending.get(m.rid); st.pending.delete(m.rid); r?.(m); }
      if (m.t === 'online') st.online = m.list;
      if (m.t === 'god') { st.god = m.god; st.gmLevel = m.level; }
      if (m.t === 'cfg') st.cfg = m.cfg;
      if (m.t === 'kick') st.kicked = m.why;
      // AI 主动来袭（forced）：像玩家一样点“离开/突围”，免得测试客户端被冻结 90 秒
      if (m.t === 'encounter' && m.forced && m.eid && st.autoLeave !== false) { st.ambushed = (st.ambushed ?? 0) + 1; st.req('enc', { eid: m.eid, flee: true }); }
    });
  });
}

/** 认领天命（GM） */
export async function claim(c, key) {
  const n = c.log.length;
  await sleep(900); // 聊天限流 800ms
  c.chat(`/天命 ${key}`);
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) { if (c.log.slice(n).some(m => m.t === 'god')) return true; if (c.log.slice(n).some(m => m.t === 'chat' && m.who === '系统')) return false; await sleep(50); }
  return false;
}

let pass = 0, fail = 0;
export function check(label, ok, extra = '') { if (ok) pass++; else fail++; console.log(`${ok ? '✔' : '✘'} ${label}${extra ? ' — ' + extra : ''}`); return ok; }
export function summary() { console.log(`\n==== ${pass} 通过，${fail} 失败 ====`); return fail; }
