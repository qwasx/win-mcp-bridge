// 入口
import Phaser from 'phaser';
import './style.css';
import { WorldScene } from './scenes/WorldScene';
import { BattleScene } from './scenes/BattleScene';
import { ref } from './gameRef';
import { showMainMenu, setMenuHooks } from './ui/menu';
import { hud } from './ui/hud';
import { actions, installKeys } from './ui/index';
import { closeAll } from './ui/dom';
import { buildGrid } from './core/terrain';
import { nav } from './core/sim';
import { installAudio, music, resetWorldAudioWatch } from './audio/hooks';
import { weatherFx } from './art/weatherFx';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1008',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, roundPixels: false },
  scene: [],
});
ref.game = game;
game.scene.add('World', WorldScene, false);
game.scene.add('Battle', BattleScene, false);

function startGame() {
  closeAll();
  nav.target = null; nav.path = []; nav.waiting = false; nav.graceUntil = 0;
  hud.mount(actions);
  resetWorldAudioWatch();
  if (game.scene.isActive('Battle')) game.scene.stop('Battle');
  if (game.scene.getScene('World') && (game.scene.isActive('World') || game.scene.isSleeping('World'))) game.scene.stop('World');
  game.scene.start('World');
}
function quitToMenu() {
  closeAll();
  if (game.scene.isActive('Battle')) game.scene.stop('Battle');
  game.scene.stop('World');
  hud.unmount();
  music.ambience('none'); music.weather(0); weatherFx.clear();
  const nd = document.getElementById('night'); if (nd) nd.style.opacity = '0';
  showMainMenu();
}
setMenuHooks(startGame, quitToMenu);
installKeys();
installAudio();

// 生成地图（耗时操作），完成后显示主菜单
const loading = document.getElementById('loading')!;
setTimeout(() => {
  buildGrid();
  loading.remove();
  showMainMenu();
}, 50);
