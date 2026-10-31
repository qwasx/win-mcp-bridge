import { useEffect, useRef, useState } from 'react';
import { Game, createGame } from '../world/game';
import { audio } from '../world/audio';
import { TitleScreen } from './Title';
import { Intro } from './Intro';
import { GameView } from './GameView';
import { ACTIVE_MAP, MAP_NAME, LOC_BY_ID, LOCATIONS } from '../data/world';
import { LANDMARKS } from '../data/landmarks';

// 第十六步：换图 = 重新载入。载入后据此自动读档 / 开新局
let bootResume: string | null = null, bootNew = false;
try { bootResume = sessionStorage.getItem('fanren.resume'); sessionStorage.removeItem('fanren.resume'); bootNew = sessionStorage.getItem('fanren.new') === '1'; sessionStorage.removeItem('fanren.new'); } catch { /* */ }

type Screen = 'title' | 'intro' | 'loading' | 'game';

// 后台预先生成世界（标题画面出现后即开始，进入游戏时通常已就绪）
let gamePromise: Promise<Game> | null = null;
let progressState = { p: 0, msg: bootResume !== null ? `虚空挪移，${MAP_NAME[ACTIVE_MAP]}的山川渐渐显现…` : '研墨铺纸…' };
const progressListeners = new Set<() => void>();
function ensureGame() {
  if (!gamePromise) {
    gamePromise = createGame((p, msg) => {
      progressState = { p, msg };
      progressListeners.forEach((f) => f());
    }).then((g) => { progressState = { p: 1, msg: '画卷已成' }; progressListeners.forEach((f) => f()); return g; });
  }
  return gamePromise;
}

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [game, setGame] = useState<Game | null>(null);
  const [progress, setProgress] = useState(progressState);
  const mode = useRef<'new' | 'continue'>('new');

  useEffect(() => {
    const f = () => setProgress(progressState);
    progressListeners.add(f);
    // 让标题动画先跑起来，再在后台生成世界
    const t = setTimeout(() => ensureGame(), bootResume !== null || bootNew ? 0 : 900);
    if (bootResume !== null) { mode.current = 'continue'; enterGame(bootResume || undefined); }
    else if (bootNew) { mode.current = 'new'; setScreen('intro'); }
    // 调试 / 自动化测试：?auto=new 直接进入新游戏
    if (bootResume === null && new URLSearchParams(location.search).get('auto') === 'new') { mode.current = 'new'; enterGame(); }
    return () => { progressListeners.delete(f); clearTimeout(t); };
  }, []);

  useEffect(() => { audio.setMode(screen === 'game' ? 'world' : 'title'); }, [screen]);

  const enterGame = async (key?: string) => {
    setScreen('loading');
    const g = await ensureGame();
    if (mode.current === 'continue') { if (!g.load(key) && bootResume !== null) g.reset(); }
    else { g.reset(); }
    (window as any).__game = g; (window as any).__fanrenLoc = (id: string) => LOC_BY_ID.get(id); (window as any).__fanrenLocs = () => LOCATIONS;
    (window as any).__fanrenLM = () => LANDMARKS.filter((L) => L.scenic);
    setGame(g);
    setScreen('game');
  };

  const onNew = () => {
    audio.unlock(); audio.sfx('open');
    // 新的一局总是从天南黄枫谷开始：若当前载入的是别的地图，先切回天南
    if (ACTIVE_MAP !== 'tiannan') { try { localStorage.setItem('fanren.map', 'tiannan'); sessionStorage.setItem('fanren.new', '1'); location.reload(); return; } catch { /* */ } }
    mode.current = 'new';
    
    setScreen('intro');
  };
  const onContinue = () => {
    audio.unlock(); audio.sfx('open');
    mode.current = 'continue';
    enterGame();
  };

  if (screen === 'title') return <TitleScreen onNew={onNew} onContinue={onContinue} hasSave={Game.hasSave()} />;
  if (screen === 'intro') return <Intro onDone={() => enterGame()} />;
  if (screen === 'loading' || !game) return (
    <div className="loading">
      <div className="loading-ink" />
      <div className="loading-text">{progress.msg}</div>
      <div className="loading-bar"><div style={{ width: `${Math.round(progress.p * 100)}%` }} /></div>
    </div>
  );
  return <GameView game={game} onExit={() => { setScreen('title'); setGame(null); }} />;
}
