// 真实 Phaser.CANVAS 截图：启动新游戏 -> 大地图 -> 执行可选脚本
import './env.ts';
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const GAME = process.env.GAME_DIR ?? '/home/user/win-mcp-bridge/games/ming-warband/';
const req = createRequire(GAME + 'package.json');
const Phaser = req('phaser');
(globalThis as any).Phaser = Phaser;
const { WorldScene } = await import(GAME + 'src/scenes/WorldScene.ts');
const { BattleScene } = await import(GAME + 'src/scenes/BattleScene.ts');
const { ref } = await import(GAME + 'src/gameRef.ts');
const { hud } = await import(GAME + 'src/ui/hud.ts');
const { actions, installKeys } = await import(GAME + 'src/ui/index.ts');
const { newGame, S, player } = await import(GAME + 'src/core/game.ts');
const { nav, setPlayerTarget } = await import(GAME + 'src/core/sim.ts');
const game = new Phaser.Game({ type: Phaser.CANVAS, parent: 'game', backgroundColor: '#1a1008', width: (globalThis as any).__W, height: (globalThis as any).__H, scene: [], render: { antialias: true }, banner: false, audio: { noAudio: true } });
ref.game = game;
game.scene.add('World', WorldScene, false);
game.scene.add('Battle', BattleScene, false);
installKeys();
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
await wait(300);
newGame('李定远', 'soldier');
hud.mount(actions);
game.scene.start('World');
await wait(1500);
const ws: any = game.scene.getScene('World');
export async function snap(file: string) {
  await wait(120);
  const c = (globalThis as any).__napiOf(game.canvas);
  const wcv = document.getElementById('weather') as HTMLCanvasElement | null;
  if (wcv) { const wc = (globalThis as any).__napiOf(wcv); if (wc) c.getContext('2d').drawImage(wc, 0, 0); }
  writeFileSync(file, c.toBuffer('image/png'));
  console.log('snap', file);
}
(globalThis as any).ctx = { game, ws, S, player, nav, setPlayerTarget, snap, wait, Phaser, GAME };
const script = process.argv[2];
if (script) { const m = await import(script); await m.default((globalThis as any).ctx); }
else { ws.cameras.main.setZoom(1.4); await snap('/tmp/t/shot_world.png'); }
process.exit(0);
