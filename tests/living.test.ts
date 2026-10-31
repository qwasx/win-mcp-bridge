import assert from 'node:assert/strict';
import { createLiving, advance, act, type LivingState } from '../src/world/living';

let s: LivingState = createLiving();
assert.ok(s.people.length > 900, '保留原版完整人物名册');
assert.ok(s.people.every(p => Array.isArray(p.bag) && Array.isArray(p.arts) && Array.isArray(p.relations)), '人人有储物袋、功法与关系字段');
const initial = JSON.stringify(s);
const beforeStones = s.player.stones;
const lu = s.people.find(p => p.id === 'o_luqingya')!;
const herb = lu.bag.find(i => i.kind === 'herb')!;
const beforeQty = herb.qty;
s = act(s, { type: 'trade', personId: lu.id, itemId: herb.id }).state;
assert.equal(s.player.stones, beforeStones - herb.price, '交易扣除玩家灵石');
assert.equal(s.people.find(p => p.id === lu.id)!.bag.find(i => i.id === herb.id)!.qty, beforeQty - 1, '交易扣除 NPC 库存');
assert.equal(s.player.inventory.find(i => i.id === herb.id)!.qty, 1, '货物进入玩家行囊');
const stones = s.player.stones;
s = act(s, { type: 'gift', personId: lu.id }).state;
assert.equal(s.player.stones, stones - 20, '赠礼扣款');
assert.ok(s.people.find(p => p.id === lu.id)!.memories.length > 0, '赠礼写入记忆');
const request = s.events.find(e => e.kind === 'request' && e.status === 'pending')!;
assert.ok(request, '存在有来由的邀请');
s = advance(s, 7);
assert.equal(s.events.find(e => e.id === request.id)!.status, 'resolved', '无人回应的邀请会自行结束');
assert.ok(!s.events.find(e => e.id === request.id)!.playerChoice, '没有强制玩家接受');
const rob = s.events.find(e => e.kind === 'rob' && e.targetId === 'o_luqingya');
if (rob) {
  assert.equal(rob.status, 'resolved', '劫案会自行结算');
  const victim = s.people.find(p => p.id === 'o_luqingya')!;
  assert.ok(victim.grudges.some(g => g.targetId === rob.actorId), '劫案留下具体仇怨');
}
for (let i = 0; i < 12; i++) s = advance(s, 30);
assert.ok(s.day > 400, '长时间推进');
assert.ok(s.people.every(p => p.wealth >= 0 && p.bag.every(i => i.qty > 0)), '资源守恒：无负灵石、无负库存');
assert.ok(s.events.some(e => e.status === 'resolved'), '世界持续产生并结算事件');
assert.ok(s.people.some(p => p.arts.some(a => a.proficiency > 60)), '功法熟练度会增长');
assert.equal(JSON.parse(initial).people.length, s.people.length, '人物不会凭空消失');
console.log('活世界引擎测试通过：交易 / 赠礼 / 邀请过期 / 劫案仇怨 / 360 日资源与功法演算');
