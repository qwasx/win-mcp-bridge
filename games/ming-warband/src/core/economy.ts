// 价格与交易
import { GOOD, GOODS, ITEMS } from '../data/items';
import { S, targetStock } from './game';
import type { Settlement } from './state';
import { buyMult, sellMult } from './character';

export function goodPrice(st: Settlement, g: string, buying: boolean) {
  const def = GOOD[g];
  let mod = 1;
  if (st.produce.includes(g)) mod = st.kind === 'village' ? 0.55 : 0.68;
  else if (st.demand.includes(g)) mod = 1.5;
  const target = Math.max(1, targetStock(st, g));
  const stock = st.stock[g] ?? 0;
  const supply = Math.max(0.65, Math.min(1.9, 1 + (target - stock) / (target * 1.6)));
  const p = def.base * mod * supply * (buying ? buyMult(S) : sellMult(S));
  return Math.max(1, Math.round(p));
}

export function itemBuyPrice(id: string) { return Math.round(ITEMS[id].price * buyMult(S) * 1.05); }
export function itemSellPrice(id: string) { return Math.round(ITEMS[id].price * sellMult(S) * 0.5); }

export function dailyEconomy() {
  for (const st of Object.values(S.settlements)) {
    for (const g of GOODS) {
      if (st.stock[g.id] === undefined) continue;
      const t = targetStock(st, g.id);
      const cur = st.stock[g.id];
      st.stock[g.id] = cur + (t - cur) * 0.1 + (Math.random() - 0.5) * 1.2;
      if (st.stock[g.id] < 0) st.stock[g.id] = 0;
    }
    // 繁荣度
    if (st.lootedUntil > S.time) st.prosperity = Math.max(5, st.prosperity - 0.3);
    else if (st.siege) st.prosperity = Math.max(5, st.prosperity - 0.5);
    else st.prosperity = Math.min(100, st.prosperity + 0.05);
  }
}

export function ransomPrice(tier: number) { return Math.round((8 + tier * tier * 9) * (0.9 + 0.012 * 0)); }
