// UI 入口：快捷键与各面板的汇总
import { escTop, panelOpen, closeAll } from './dom';
import { hud, showTooltip, hideTooltip } from './hud';
import { openSettlement } from './settlement';
import { openEncounter, openJoinBattle, openDefendPrompt } from './encounter';
import { openCharacter, openParty, openInventory, openFactions, openQuests, openLog } from './panels';
import { openGameMenu } from './menu';
import './chronicle';
import { nav } from '../core/sim';
import { S, on, player, log } from '../core/game';
import { ref } from '../gameRef';

export { hud, showTooltip, hideTooltip, openSettlement, openEncounter };

export function toggleWait() {
  if (nav.target) { nav.target = null; nav.path = []; nav.waiting = false; return; }
  nav.waiting = !nav.waiting;
}

function worldActive() {
  const g = ref.game;
  return !!g && g.scene.isActive('World') && !!S;
}

export function centerView() {
  const w = ref.game?.scene.getScene('World') as any;
  w?.centerOnPlayer?.();
}

export const actions: Record<string, () => void> = {
  character: () => { closeAll(); openCharacter(); },
  party: () => { closeAll(); openParty(); },
  inventory: () => { closeAll(); openInventory(); },
  factions: () => { closeAll(); openFactions(); },
  quests: () => { closeAll(); openQuests(); },
  log: () => { closeAll(); openLog(); },
  menu: () => { closeAll(); openGameMenu(); },
  toggleWait,
  center: centerView,
};

export function installKeys() {
  window.addEventListener('keydown', e => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (!worldActive()) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (panelOpen()) escTop(); else actions.menu();
      e.preventDefault(); return;
    }
    if (panelOpen()) return;
    if (k === ' ') { toggleWait(); e.preventDefault(); }
    else if (k === '1') S.speed = 1;
    else if (k === '2') S.speed = 2;
    else if (k === '3') S.speed = 4;
    else if (k === 'c') actions.character();
    else if (k === 'p') actions.party();
    else if (k === 'i') actions.inventory();
    else if (k === 'f') actions.factions();
    else if (k === 'q') actions.quests();
    else if (k === 'l') actions.log();
    else if (k === 'h' || k === 'home') centerView();
    hud.update(true);
  });
}

on('arrive', (st: any) => openSettlement(st));
on('encounter', (p: any, forced: boolean) => openEncounter(p, forced));
on('joinBattle', (a: any, b: any) => openJoinBattle(a, b));
on('defendPrompt', (st: any, p: any) => openDefendPrompt(st, p));
on('playerDefeated', () => {
  const pp = player();
  pp.inside = undefined;
  log('你需要重整旗鼓。', 'hint');
});
