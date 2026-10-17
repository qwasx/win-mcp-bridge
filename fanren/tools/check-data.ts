// 数据一致性检查：npx tsx tools/check-data.ts
import * as fs from 'fs';
import { ITEMS } from '../src/data/items';
import { LOC_BY_ID } from '../src/data/world';
import { ENEMIES } from '../src/data/enemies';
const files = ['src/data/beauties.ts', 'src/world/npc.ts', 'src/world/hearts.ts', 'src/world/town.ts', 'src/world/events.ts', 'src/world/game.ts'];
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/'((?:pill|herb|art|mat|tal|scroll|item)_[a-z0-9_]+)'/g)) if (!ITEMS[m[1]] && !m[1].endsWith('_')) { console.log(f, 'missing item', m[1]); bad++; }
  for (const m of s.matchAll(/(?:home|loc|homeLoc|sect): '([a-z]+)'/g)) if (!LOC_BY_ID.get(m[1])) { console.log(f, 'missing loc', m[1]); bad++; }
  for (const m of s.matchAll(/\['([a-z_]+)', (\d|r\.)/g)) if (!ENEMIES[m[1]]) { console.log(f, 'missing enemy', m[1]); bad++; }
  for (const m of s.matchAll(/def: '([a-z_]+)'/g)) if (!ENEMIES[m[1]]) { console.log(f, 'missing enemy def', m[1]); bad++; }
  for (const m of s.matchAll(/ENEMIES\.([a-z_]+)/g)) if (!ENEMIES[m[1]]) { console.log(f, 'missing ENEMIES.', m[1]); bad++; }
}
console.log('bad', bad);
