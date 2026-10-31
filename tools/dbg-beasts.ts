import './env';
const { ENEMY_LIST } = await import('../src/data/enemies');
const by: Record<string, string[]> = {};
for (const e of ENEMY_LIST as any[]) { if (!e.lv) continue; for (let l = e.lv[0]; l <= e.lv[1]; l++) { const k = 'lv' + l + ' ' + (e.zone || '-') + (e.lair ? ' LAIR' : '') + (e.lm ? ' LM' : ''); (by[k] ??= []).push(e.id + (e.regions ? '[' + e.regions.join('/') + ']' : '') + (e.pack ? '×' : '') + (e.behave ? '(' + e.behave + ')' : '') + (e.flying ? '^' : '')); } }
for (const k of Object.keys(by).sort()) console.log(k, ':', by[k].join(' '));
console.log('nonlv', (ENEMY_LIST as any[]).filter((e) => !e.lv).map((e) => e.id + ':' + e.minDanger + '-' + e.maxDanger + ':' + e.kind).join(' '));
