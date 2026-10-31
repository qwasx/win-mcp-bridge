import { writeFileSync } from 'node:fs';
import { NpcWorld } from '../game/src/world/npc';
import { Relations } from '../game/src/world/relations';
import type { Game } from '../game/src/world/game';

// Reuse the actual v0.42 roster AND its generated family/social ties.
const game = {} as Game;
(game as any).rel = new Relations(game);
const npcs = new NpcWorld(game);
npcs.newWorld(20241015);
writeFileSync('src/world/roster.json', JSON.stringify(npcs.list));
console.log(`Exported ${npcs.list.length} original NPCs with relationships`);
