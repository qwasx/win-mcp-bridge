import { useEffect, useRef, useState } from 'react';
import { Game, createGame } from '../world/game';
import { audio } from '../world/audio';
import { TitleScreen } from './Title';
import { Intro } from './Intro';
import { GameView } from './GameView';

type Screen = 'title' | 'intro' | 'loading' | 'game';

// 后台预先生成世界（标题画面出现后即开始，进入游戏时通常已就绪）
let gamePromise: Promise<Game> | null = null;
let progressState = { p: 0, msg: '研墨铺纸…' };
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
    const t = setTimeout(() => ensureGame(), 900);
    return () => { progressListeners.delete(f); clearTimeout(t); };
  }, []);

  useEffect(() => { audio.setMode(screen === 'game' ? 'world' : 'title'); }, [screen]);

  const enterGame = async () => {
    setScreen('loading');
    const g = await ensureGame();
    if (mode.current === 'continue') g.load();
    else { g.reset(); }
    (window as any).__game = g;
    setGame(g);
    setScreen('game');
  };

  const onNew = () => {
    audio.unlock(); audio.sfx('open');
    mode.current = 'new';
    
    setScreen('intro');
  };
  const onContinue = () => {
    audio.unlock(); audio.sfx('open');
    mode.current = 'continue';
    enterGame();
  };

  if (screen === 'title') return <TitleScreen onNew={onNew} onContinue={onContinue} hasSave={Game.hasSave()} />;
  if (screen === 'intro') return <Intro onDone={enterGame} />;
  if (screen === 'loading' || !game) return (
    <div className="loading">
      <div className="loading-ink" />
      <div className="loading-text">{progress.msg}</div>
      <div className="loading-bar"><div style={{ width: `${Math.round(progress.p * 100)}%` }} /></div>
    </div>
  );
  return <GameView game={game} onExit={() => { setScreen('title'); setGame(null); }} />;
}
