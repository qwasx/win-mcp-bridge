import { useEffect, useRef, useState } from 'react';
import {
  SKY_THEME,
  TONE_MATRIX,
  TIMES,
  WEATHERS,
  type Preset,
  type SceneConfig,
} from '../data/mood';
import { InkIcon, Seal } from './ui';

type ToggleKey = 'showFar' | 'showSky' | 'showMist' | 'showSpots' | 'showPost';

interface InkSceneProps {
  config: SceneConfig;
  preset: Preset;
  geeseKey: number;
  onToggle: (key: ToggleKey) => void;
}

const SCENE_TITLES: Record<string, Record<string, string>> = {
  dawn: { clear: '晓雾初开', rain: '晨雨含烟', snow: '雪霁初晨', fog: '雾锁寒湖' },
  noon: { clear: '湖天一碧', rain: '烟雨空蒙', snow: '千山暮雪', fog: '云水茫茫' },
  dusk: { clear: '墟里炊烟', rain: '暮雨归舟', snow: '风雪故人', fog: '暮霭沉沉' },
  night: { clear: '星汉入湖', rain: '夜雨孤灯', snow: '雪夜清辉', fog: '寒潭墨影' },
};

const STARS = [
  [7, 18, 1.6], [13, 9, 1.1], [18, 27, 1.4], [23, 13, 1.8], [29, 32, 1.2],
  [34, 7, 1.5], [39, 22, 1.1], [44, 15, 1.7], [49, 30, 1.3], [54, 9, 1.2],
  [59, 24, 1.6], [63, 17, 1.1], [68, 34, 1.4], [73, 11, 1.8], [77, 26, 1.2],
  [82, 19, 1.5], [88, 8, 1.3], [92, 29, 1.6], [96, 15, 1.1], [11, 37, 1.2],
  [26, 40, 1], [47, 42, 1.2], [66, 41, 1], [86, 38, 1.2],
];

const SNOW = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 29 + 7) % 100,
  size: i % 5 === 0 ? 3.2 : i % 3 === 0 ? 2.3 : 1.5,
  duration: 11 + (i % 7) * 2.6,
  delay: -((i * 3.1) % 18),
  drift: i % 2 ? 18 : -14,
  opacity: 0.35 + (i % 4) * 0.14,
}));

const SKY_WEATHER: Record<string, Record<string, [string, string, string]>> = {
  rain: {
    dawn: ['#9aa9a5', '#bcc7bf', '#d5dace'],
    noon: ['#8e9f9d', '#b1bdb7', '#cfd4c7'],
    dusk: ['#687b7d', '#8d978e', '#b9ad9b'],
    night: ['#17262b', '#253639', '#3c4b49'],
  },
  snow: {
    dawn: ['#c6d5d3', '#e0e5db', '#f1eee1'],
    noon: ['#c0d0cf', '#dbe2dc', '#efeadf'],
    dusk: ['#98a3a8', '#c0beb9', '#ded2c2'],
    night: ['#293a45', '#3b4d55', '#5d6c6e'],
  },
  fog: {
    dawn: ['#d2d6ca', '#e3dfd1', '#ece5d4'],
    noon: ['#c6d0c9', '#d9d9ce', '#e5dfd0'],
    dusk: ['#a7a299', '#c5baac', '#d6c5b0'],
    night: ['#2a3739', '#3b4847', '#505d58'],
  },
};

const PINE_NEEDLES = (() => {
  const clusters = [
    { x: 148, y: 88, r: 54, n: 30, rot: -0.5 },
    { x: 226, y: 118, r: 44, n: 24, rot: -0.18 },
    { x: 88, y: 155, r: 46, n: 26, rot: -0.85 },
    { x: 240, y: 218, r: 40, n: 22, rot: -0.1 },
    { x: 128, y: 235, r: 48, n: 26, rot: -0.7 },
    { x: 210, y: 296, r: 36, n: 20, rot: 0.2 },
  ];
  const lines: { x1: number; y1: number; x2: number; y2: number; o: number; w: number }[] = [];
  clusters.forEach((c, ci) => {
    for (let i = 0; i < c.n; i++) {
      const a = c.rot - 1.15 + (i / c.n) * 2.3;
      const len = c.r * (0.55 + ((i * 37 + ci * 13) % 50) / 100);
      lines.push({
        x1: c.x + Math.cos(a) * c.r * 0.12,
        y1: c.y + Math.sin(a) * c.r * 0.12,
        x2: c.x + Math.cos(a) * len,
        y2: c.y + Math.sin(a) * len,
        o: 0.32 + ((i * 7 + ci) % 6) / 14,
        w: 0.7 + ((i * 3) % 4) * 0.22,
      });
    }
  });
  return { clusters, lines };
})();

function VillageSvg({ smoke, windowTone, night }: { smoke: number; windowTone: string; night: boolean }) {
  return (
    <svg viewBox="0 0 340 230" preserveAspectRatio="xMaxYMax meet" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="bank" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4e5c50" stopOpacity="0.32" />
          <stop offset="1" stopColor="#4e5c50" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#1b2724' : '#303a32'} />
          <stop offset="1" stopColor={night ? '#111b19' : '#465247'} />
        </linearGradient>
      </defs>
      {/* far bank */}
      <path d="M2 186C48 164 88 174 126 160c40-15 82-4 112-16 34-13 68-6 102-16v104H2z" fill="url(#bank)" />
      <path d="M2 186C48 164 88 174 126 160c40-15 82-4 112-16 34-13 68-6 102-16" fill="none" stroke="#43544a" strokeWidth="1" opacity="0.34" />

      {/* distant trees */}
      <g stroke={night ? '#25352f' : '#3f4d42'} strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M30 172v-22M42 174v-31M52 172v-18" strokeWidth="1.6" />
        <path d="M300 160v-24M312 163v-17" strokeWidth="1.4" />
      </g>
      <g fill={night ? '#2b3d35' : '#4d5d4f'} opacity="0.35">
        <ellipse cx="31" cy="145" rx="15" ry="8" />
        <ellipse cx="44" cy="139" rx="17" ry="9" />
        <ellipse cx="302" cy="132" rx="18" ry="8" />
      </g>

      {/* houses */}
      <g>
        {/* left small house */}
        <path d="M64 172h56v40H64z" fill={night ? '#c6bfa9' : '#e7ddc6'} stroke="#525a4b" strokeWidth="0.9" opacity={night ? 0.42 : 0.9} />
        <path d="M54 174q36-32 77-2q-24-13-38-11q-19-2-39 13z" fill="url(#roof)" />
        <rect className="window" x="78" y="183" width="10" height="10" fill={windowTone} />
        <rect x="95" y="183" width="7" height="16" fill="#4c5346" opacity="0.8" />
        {/* main hall */}
        <path d="M126 164h80v52h-80z" fill={night ? '#cbc4ad' : '#eae0c9'} stroke="#525a4b" strokeWidth="1" opacity={night ? 0.44 : 0.93} />
        <path d="M114 167q51-36 104-3q-26-15-51-15q-30 0-53 18z" fill="url(#roof)" />
        <rect className="window" x="139" y="180" width="14" height="12" fill={windowTone} />
        <rect className="window" x="177" y="180" width="12" height="12" fill={windowTone} opacity="0.8" />
        <rect x="158" y="184" width="10" height="32" fill="#555c4e" opacity="0.85" />
        {/* side house */}
        <path d="M214 171h52v37h-52z" fill={night ? '#c3bda7' : '#e6dcc5'} stroke="#525a4b" strokeWidth="0.9" opacity={night ? 0.4 : 0.88} />
        <path d="M206 173q31-26 69-2q-23-10-36-9q-17 0-33 11z" fill="url(#roof)" />
        <rect className="window" x="231" y="182" width="10" height="9" fill={windowTone} opacity="0.85" />
        {/* pavilion / terrace at water */}
        <path d="M268 178h44v30h-44z" fill={night ? '#bdb7a2' : '#e2d8c1'} opacity={night ? 0.4 : 0.8} />
        <path d="M262 180q24-22 56-1q-16-8-28-8q-14 0-28 9z" fill="url(#roof)" />
        <path d="M262 208h56" stroke="#4e5a4d" strokeWidth="1.4" opacity="0.7" />
        <rect className="window" x="283" y="187" width="8" height="8" fill={windowTone} opacity="0.9" />
      </g>

      {/* jetty and reflection */}
      <g opacity="0.65">
        <path d="M146 216l52-5M154 209l30-4" stroke="#4d574c" strokeWidth="1.4" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="146" y1="207" x2="144" y2="229" stroke="#4d574c" strokeWidth="1.1" opacity={0.7 - i * 0.08} />
        ))}
      </g>
      <g fill={windowTone} opacity="0.25">
        <rect x="140" y="220" width="2" height="12" />
        <rect x="180" y="218" width="2" height="10" />
        <rect x="284" y="216" width="2" height="9" />
      </g>

      {/* chimney smoke, programmatic ink thread */}
      <g fill="none" stroke="#f8f3e3" strokeLinecap="round" style={{ opacity: smoke * 0.55 }}>
        <g className="smoke" style={{ opacity: 0.85 }}>
          <path d="M111 148c-7-13 5-18-1-31-3-8 1-14 4-18" strokeWidth="4.6" opacity="0.5" />
          <path d="M111 150c-6-14 6-19 0-33" strokeWidth="2" opacity="0.8" />
        </g>
        <g className="smoke s2" style={{ opacity: 0.7 }}>
          <path d="M171 141c6-12-3-17 2-26" strokeWidth="3.4" opacity="0.4" />
        </g>
      </g>
    </svg>
  );
}

function PineSvg() {
  return (
    <svg viewBox="0 0 340 420" preserveAspectRatio="xMinYMax meet">
      <defs>
        <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f2a25" />
          <stop offset="0.55" stopColor="#36443a" />
          <stop offset="1" stopColor="#26322b" />
        </linearGradient>
        <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#37483d" stopOpacity="0.3" />
          <stop offset="1" stopColor="#37483d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* ink washes behind the needles */}
      <g fill="url(#wash)">
        <ellipse cx="152" cy="96" rx="83" ry="50" transform="rotate(-12 152 96)" />
        <ellipse cx="224" cy="140" rx="60" ry="35" transform="rotate(-4 224 140)" />
        <ellipse cx="122" cy="235" rx="70" ry="43" transform="rotate(-15 122 235)" />
      </g>
      {/* deep ink fans behind the needles, so the pine reads from a distance */}
      <g fill="#28362d" opacity="0.17">
        <ellipse cx="148" cy="88" rx="44" ry="20" transform="rotate(-18 148 88)" />
        <ellipse cx="228" cy="120" rx="32" ry="15" transform="rotate(-6 228 120)" />
        <ellipse cx="86" cy="158" rx="34" ry="16" transform="rotate(-30 86 158)" />
        <ellipse cx="242" cy="220" rx="29" ry="13" transform="rotate(-2 242 220)" />
        <ellipse cx="126" cy="238" rx="35" ry="15" transform="rotate(-24 126 238)" />
        <ellipse cx="212" cy="298" rx="26" ry="12" transform="rotate(8 212 298)" />
      </g>
      {/* trunk & limbs */}
      <g fill="none" stroke="url(#trunk)" strokeLinecap="round">
        <path d="M-12 424C48 356 58 308 94 258c25-35 53-69 71-108 8-18 12-36 8-58" strokeWidth="15" opacity="0.92" />
        <path d="M90 270c36-18 59-41 86-69" strokeWidth="7" opacity="0.82" />
        <path d="M118 226c34-15 52-32 76-59" strokeWidth="5" opacity="0.76" />
        <path d="M136 198c-18-3-37-12-50-27" strokeWidth="3.4" opacity="0.7" />
        <path d="M153 170c33-4 52-18 66-34" strokeWidth="3" opacity="0.66" />
        <path d="M107 291c-24 12-42 28-58 48" strokeWidth="2.6" opacity="0.6" />
      </g>
      {/* needles */}
      <g stroke="#2b3a31" strokeLinecap="round">
        {PINE_NEEDLES.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={l.w} opacity={l.o} />
        ))}
      </g>
      <g stroke="#5a6a55" strokeLinecap="round" opacity="0.4">
        {PINE_NEEDLES.clusters.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r * 0.16} fill="#5c6d58" stroke="none" opacity="0.4" />
        ))}
      </g>
      {/* tiny needle accents catching the light */}
      <g stroke="#8fa18a" strokeLinecap="round" opacity="0.32">
        {PINE_NEEDLES.lines.filter((_, i) => i % 9 === 0).map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth="0.6" />
        ))}
      </g>
    </svg>
  );
}

function RocksSvg() {
  return (
    <svg viewBox="0 0 360 200" preserveAspectRatio="xMaxYMax meet">
      <defs>
        <linearGradient id="rock1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#52604f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2f3f34" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g fill="url(#rock1)">
        <path d="M188 200c6-34 21-52 42-64 16-9 36-13 58-11 22 2 41 10 56 23 10 9 15 22 16 52z" />
        <path d="M282 200c5-28 17-41 33-49 15 12 25 27 29 49z" opacity="0.8" />
      </g>
      <g stroke="#2b382f" fill="none" strokeLinecap="round" opacity="0.55">
        <path d="M207 194c12-25 26-38 46-47M248 191c9-20 22-33 40-40M292 193c10-17 20-25 34-30" strokeWidth="1.1" />
        <path d="M321 166c8-19 4-29-2-35M331 170c9-13 11-25 8-34" strokeWidth="0.9" />
      </g>
      <g fill="#5f7058" opacity="0.45">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${312 + i * 7} 168c${i % 2 ? 9 : -7} -${15 + i * 2} ${i % 2 ? 3 : -2} -${24 + i * 2} ${i % 2 ? 1 : -4} -${30 + i}`} stroke="#596b52" strokeWidth="1" fill="none" />
        ))}
      </g>
    </svg>
  );
}

function ReedsSvg() {
  const stems = Array.from({ length: 13 }, (_, i) => ({ x: 14 + i * 6.4, h: 46 + ((i * 13) % 34), bend: i % 2 ? 9 : -7 }));
  return (
    <svg viewBox="0 0 110 150" preserveAspectRatio="xMaxYMax meet">
      <g stroke="#8f7b50" strokeWidth="1" fill="none" opacity="0.66">
        {stems.map((s, i) => (
          <path key={i} d={`M${s.x} 150 Q ${s.x + s.bend * 0.3} ${150 - s.h * 0.5} ${s.x + s.bend} ${150 - s.h}`} />
        ))}
      </g>
      <g fill="#d7c8a5" opacity="0.72">
        {stems.map((s, i) => (
          <ellipse key={i} cx={s.x + s.bend} cy={150 - s.h - 5} rx="2.1" ry="7" transform={`rotate(${i % 2 ? 12 : -8} ${s.x + s.bend} ${150 - s.h - 5})`} />
        ))}
      </g>
      <g stroke="#63705a" strokeWidth="1.2" fill="none" opacity="0.5">
        <path d="M12 150c10-36 21-55 34-69M44 150c3-25 10-40 19-51M78 150c-1-19 4-31 10-41" />
      </g>
    </svg>
  );
}

export function InkScene({ config, preset, geeseKey, onToggle }: InkSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(false);
  const [geese, setGeese] = useState(0);

  useEffect(() => {
    if (geeseKey > 0) setGeese(geeseKey);
  }, [geeseKey]);

  useEffect(() => {
    let timer: number;
    const reset = () => {
      setStill(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setStill(true), 10000);
    };
    reset();
    window.addEventListener('pointermove', reset, { passive: true });
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', reset);
      window.removeEventListener('keydown', reset);
    };
  }, []);

  const onMove = (e: React.PointerEvent) => {
    if (!sceneRef.current || !config.parallax) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    sceneRef.current.style.setProperty('--px', String(x * (config.parallax / 100)));
    sceneRef.current.style.setProperty('--py', String(y * (config.parallax / 100)));
  };

  const isNight = config.time === 'night';
  const isDusk = config.time === 'dusk';
  const isRain = config.weather === 'rain';
  const isSnow = config.weather === 'snow';
  const isFog = config.weather === 'fog';
  const theme = SKY_THEME[config.time];
  const wash = TONE_MATRIX[config.time][config.weather];
  const wx = WEATHERS.find((w) => w.key === config.weather)!;
  const t = TIMES.find((x) => x.key === config.time)!;
  const [skyTop, skyMid, skyHorizon] = SKY_WEATHER[config.weather]?.[config.time] ?? [theme.top, theme.mid, theme.horizon];
  const title = SCENE_TITLES[config.time][config.weather];

  const water = isNight ? '#425a60' : isDusk ? '#bcab93' : isRain ? '#b3c0b7' : isSnow ? '#c7d3cf' : '#c9dad2';
  const waterDeep = isNight ? '#14252c' : isDusk ? '#687b7c' : isRain ? '#849790' : isSnow ? '#93a8a4' : '#7f9c97';
  const waterMid = isNight ? '#2f474e' : isDusk ? '#9a9282' : isRain ? '#9daca4' : isSnow ? '#b2c1bd' : '#a8c1b8';
  const windowTone = isNight ? '#f0cd8d' : isDusk ? '#e8bf7d' : '#d8c39a';

  const mountainBase = isRain ? 0.76 : isFog ? 0.52 : isSnow ? 0.82 : 1.04;
  const mtnFilter = isNight
    ? 'brightness(0.44) saturate(0.68) sepia(0.26) hue-rotate(158deg)'
    : isDusk
      ? 'brightness(0.9) saturate(0.88) sepia(0.24) hue-rotate(-10deg)'
      : isRain
        ? 'brightness(1.02) saturate(0.62)'
        : `brightness(${isSnow ? 1.04 : 1}) saturate(${isSnow ? 0.7 : 1.04}) contrast(1.03)`;

  const mistLevel = config.showMist
    ? Math.min(1.55, (config.mist / 100) * (isFog ? 1.7 : isRain ? 1.14 : isNight ? 0.52 : 0.84) + (still ? 0.2 : 0)) * (isNight ? 0.72 : 1)
    : 0;
  const smoke = config.showSpots ? (isDusk ? 0.75 : isNight ? 0.3 : isRain ? 0.28 : 0.36) : 0;
  const showCelestial = config.showSky;

  return (
    <div
      ref={sceneRef}
      className={`scene ${isNight ? 'is-night' : ''} ${isDusk ? 'is-dusk' : ''} ${isRain ? 'is-rain' : ''}`}
      onPointerMove={onMove}
      onPointerLeave={() => {
        sceneRef.current?.style.setProperty('--px', '0');
        sceneRef.current?.style.setProperty('--py', '0');
      }}
      style={
        {
          '--sky-glow': isNight ? 'rgba(206,222,212,.16)' : isDusk ? 'rgba(247,200,150,.6)' : 'rgba(248,235,196,.65)',
          '--water': water,
          '--water-mid': waterMid,
          '--water-deep': waterDeep,
          '--window': windowTone,
          '--reflect': isNight ? 'rgba(206,216,185,.24)' : isDusk ? 'rgba(235,186,127,.3)' : 'rgba(219,235,223,.45)',
          '--fg': isNight ? '#e8ecdf' : isRain ? '#263a34' : '#2c3b34',
          '--mtn-haze': skyHorizon,
        } as React.CSSProperties
      }
    >
      {/* sky */}
      <div
        className="scene-sky"
        style={{
          background: `linear-gradient(179deg, ${skyTop} 0%, ${skyMid} 46%, ${skyHorizon} 74%, ${skyHorizon} 100%)`,
        }}
      />
      <div className="sky-grain" style={{ opacity: isNight ? 0.08 : 0.14 }} />

      {config.showSky && isNight && config.weather === 'clear' && (
        <>
          <img className="star-river" src="/assets/mood/sky_starriver.webp" alt="" />
          <div className="star-dots" aria-hidden="true">
            {STARS.map(([left, top, s], i) => (
              <i
                key={i}
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `scale(${s})`,
                  animationDelay: `${(i % 7) * 0.7}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* clouds */}
      {config.showSky && (
        <>
          <svg className="cloud-svg" viewBox="0 0 1200 320" preserveAspectRatio="none" style={{ top: '2%', height: '34%' }} aria-hidden="true">
            <defs>
              <filter id="cloudBlur" x="-20%" y="-80%" width="140%" height="280%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>
            <g filter="url(#cloudBlur)" fill={isNight ? 'rgba(202,216,207,.14)' : isDusk ? 'rgba(252,218,184,.4)' : 'rgba(255,253,244,.62)'}>
              <path d="M-40 148c92-30 171-13 255 4 59 12 112 3 163-12 48-14 96-8 141 8 57 21 117 14 179-12 51-22 103-26 165-6 31 10 63 14 104 5v46c-55 17-92 25-146 7-77-25-133-11-191 16-66 31-137 26-194 2-51-21-97-19-151 0-59 21-124 19-196-9-44-17-84-18-129-2z" />
              <path d="M40 228c81-22 142-9 208 7 54 13 103 2 147-16 50-21 92-11 137 7 54 21 107 12 162-12 42-19 87-22 141-4 21 7 43 9 71 3v28c-48 13-81 17-124 3-59-19-102-9-146 12-51 24-106 21-150 2-40-16-73-13-115 2-53 19-100 15-152-5-41-16-78-14-120 1z" opacity="0.6" />
            </g>
          </svg>
          <svg className="cloud-svg slow" viewBox="0 0 1200 320" preserveAspectRatio="none" style={{ top: '17%', height: '22%' }} aria-hidden="true">
            <g filter="url(#cloudBlur)" fill={isNight ? 'rgba(184,203,196,.09)' : 'rgba(255,252,241,.32)'}>
              <path d="M-60 210c87-36 152-17 227 3 58 15 109 4 158-19 49-23 102-15 153 7 66 28 123 15 181-13 55-26 113-24 171-3 34 13 65 16 102 5v54c-54 11-88 15-141-7-64-27-122-14-174 15-60 34-119 27-171-2-44-25-83-21-130-2-60 25-118 21-172-7-43-23-84-23-131-1-21 10-42 12-73 5z" opacity="0.7" />
            </g>
          </svg>
        </>
      )}

      {/* sun / moon */}
      {showCelestial && !isNight && (
        <div
          className="sun-orb"
          style={{
            left: isDusk ? '71%' : config.time === 'noon' ? '57%' : '23%',
            top: isDusk ? '41%' : config.time === 'noon' ? '13%' : '31%',
            width: isDusk ? 54 : config.time === 'noon' ? 30 : 38,
            height: isDusk ? 54 : config.time === 'noon' ? 30 : 38,
            background: isDusk
              ? 'radial-gradient(circle at 44% 40%, rgba(250,236,207,.92), rgba(236,199,150,.7) 62%, rgba(228,186,138,.18))'
              : 'radial-gradient(circle at 44% 40%, rgba(250,245,220,.92), rgba(240,231,199,.64) 64%, rgba(238,229,196,.12))',
            ['--orb-glow' as string]: isDusk ? 'rgba(240,206,162,.28)' : 'rgba(248,242,214,.26)',
            opacity: isNight ? 0.2 : 0.5,
            filter: 'blur(1.5px)',
          }}
        />
      )}

      {config.showSky && isNight && (
        <>
          <div className="moon-halo" style={{ right: '11.5%', top: '8%', width: 206, height: 206 }} />
          <img className="moon-img" src="/assets/mood/moon_full.webp" alt="" style={{ right: '13%', top: '10%', width: 140, height: 140 }} />
          <div className="moon-disc" style={{ right: '16.1%', top: '13.6%', width: 66, height: 66 }} />
        </>
      )}
      {config.showSky && !isNight && (isDusk || isFog || isRain || isSnow) && (
        <div
          className="crescent-shape"
          role="img"
          aria-label="蛾眉月"
          style={{
            right: '17.6%',
            top: '12%',
            width: 30,
            height: 30,
            opacity: isFog || isRain ? 0.3 : 0.72,
          }}
        />
      )}

      {/* textural cloud shadows, only on clear days */}
      {config.showCloudShadow && config.weather === 'clear' && config.showPost && (
        <>
          <div className="cloud-shadow" style={{ left: '-4%', top: '52%', width: '42%', height: '26%' }} />
          <div className="cloud-shadow" style={{ left: '62%', top: '66%', width: '34%', height: '18%', animationDelay: '-28s', opacity: 0.35 }} />
        </>
      )}

      {/* far mountains, three parallax scrolls */}
      {[
        { n: 1, op: 0.94 },
        { n: 2, op: 0.97 },
        { n: 3, op: 1 },
      ].map(({ n, op }) => (
        <div
          key={n}
          className={`mtn-layer mtn-${n}`}
          style={{
            opacity: config.showFar ? mountainBase * op * (config.mountain / 100) : 0,
            ['--mtn-filter' as string]: mtnFilter,
            transitionDelay: `${n * 40}ms`,
            display: config.showFar ? 'block' : 'none',
          }}
          aria-hidden="true"
        >
          <div className="mtn-track">
            {[0, 1, 2].map((i) => (
              <img key={i} src={`/assets/mood/far_mtn_${n === 1 ? 1 : n === 2 ? 2 : 3}.webp`} alt="" draggable={false} />
            ))}
          </div>
        </div>
      ))}

      {isSnow && (
        <div
          className="scene-layer"
          style={{
            zIndex: 4,
            bottom: '42%',
            height: '17%',
            top: 'auto',
            background: 'linear-gradient(to top, transparent 0%, rgba(255,255,252,.28) 55%, rgba(255,255,252,.6) 100%)',
            mixBlendMode: 'screen',
            filter: 'blur(5px)',
            opacity: 0.7,
          }}
        />
      )}

      {/* village sits on the far shore */}
      {config.showSpots && (
        <div className="village" style={{ opacity: isRain ? 0.62 : isFog ? 0.56 : isNight ? 0.76 : 0.92 }}>
          <VillageSvg smoke={smoke} windowTone={windowTone} night={isNight} />
        </div>
      )}

      {/* lake */}
      <div className="lake" />
      <div className="reflection-glow" />
      <div className="ripple-lines" aria-hidden="true">
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
          <g fill="none" stroke="#f7f2e2" strokeWidth="0.9" opacity="0.38">
            <path d="M40 48c90-12 150 3 236 2 57 0 90-8 144-7 47 1 92 8 137 8" />
            <path d="M180 84c98-10 176 5 266 4 77-1 130-11 214-6" opacity="0.72" />
            <path d="M430 118c80-9 144 3 220 3 60 0 111-8 176-4" opacity="0.58" />
            <path d="M70 144c80-7 133 2 208 1 60-1 97-8 156-6" opacity="0.5" />
            <path d="M660 64c64-8 112 1 178 1 42 0 78-5 124-4" opacity="0.6" />
            <path d="M810 154c84-7 142 3 214 2 47-1 89-6 133-5" opacity="0.4" />
          </g>
        </svg>
      </div>
      <div className="water-gleam" />

      {/* boat + lantern */}
      {config.showSpots && (
        <>
          <div className="boat" style={{ left: isDusk ? '22%' : '27%', opacity: isFog ? 0.45 : 0.95 }}>
            <svg viewBox="0 0 120 90">
              <ellipse cx="60" cy="78" rx="33" ry="3" fill="#3b4a42" opacity="0.2" />
              <g className="boat-ink" strokeWidth="1.3">
                <path d="M-4 8c11 6 28 8 48 6 3 10 10 17 14 9" />
              </g>
              <path className="boat-sail" d="M31 7V-31c19 11 28 27 29 38z" opacity="0.92" />
              <path className="boat-sail" d="M29 7V-13C19-3 13 4 12 9z" opacity="0.72" />
              <path d="M12 9h56l-9 11H20z" fill="#26312c" />
              <path d="M18 20h42" stroke="#e6dcc5" strokeWidth="1.4" opacity="0.45" />
              <path d="M54 8V-6" stroke="#2d3833" strokeWidth="1.1" />
              <path d="M6 -1l8-8M4 2l6 3" stroke="#2d3833" strokeWidth="0.8" opacity="0.65" />
              {isNight && (
                <>
                  <circle cx="62" cy="6" r="10" fill="#eccb88" opacity="0.13" />
                  <circle cx="62" cy="6" r="2.4" fill="#f2d9a0" />
                </>
              )}
            </svg>
          </div>
          <div className="sail-reflection" style={{ left: '27%', top: '76.5%' }} />
          {isNight && (
            <>
              <div className="lantern-dot" style={{ left: 'calc(27% + 22px)', top: '68.5%' }} />
              <div className="fishing-reflect" style={{ left: 'calc(27% + 19px)', top: '70%', height: 74 }} />
            </>
          )}
        </>
      )}

      {/* mist bands */}
      {config.showMist && (
        <>
          <div className="mist-svg mist-a" style={{ opacity: Math.min(1, mistLevel) }} aria-hidden="true" />
          <div className="mist-svg mist-b" style={{ opacity: Math.min(0.95, mistLevel * 0.9) }} aria-hidden="true" />
          <div className="mist-svg mist-c" style={{ opacity: Math.min(0.78, mistLevel * 0.6) }} aria-hidden="true" />
        </>
      )}

      {/* winter flakes */}
      {isSnow && (
        <div className="weather-layer" style={{ zIndex: 12 }}>
          <div className="snow-a">
            {SNOW.slice(0, 22).map((s, i) => (
              <i key={i} style={{ left: `${s.left}%`, width: s.size, height: s.size, opacity: s.opacity, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }} />
            ))}
          </div>
          <div className="snow-b">
            {SNOW.slice(22).map((s, i) => (
              <i key={i} style={{ left: `${s.left}%`, width: s.size * 1.4, height: s.size * 1.4, opacity: s.opacity * 0.7, animationDuration: `${s.duration + 5}s`, animationDelay: `${s.delay - 4}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* geese event — source texture, slow crossing */}
      {geese > 0 && (
        <img
          key={geese}
          className="geese-img"
          src="/assets/mood/wild_geese.webp"
          alt="一行秋雁"
          style={{ top: `${isNight ? 20 : 24}%`, left: 0 }}
        />
      )}

      {/* foreground ink */}
      <div className="foreground fg-pine" style={{ opacity: isNight ? 0.72 : isRain ? 0.7 : 0.86 }} aria-hidden="true">
        <PineSvg />
      </div>
      {config.showSpots && (
        <div className="reeds" aria-hidden="true">
          <ReedsSvg />
        </div>
      )}
      <div className="foreground fg-rocks" style={{ opacity: isNight ? 0.7 : 0.88 }} aria-hidden="true">
        <RocksSvg />
      </div>

      {/* weather veil */}
      {isRain && (
        <div className="weather-layer">
          <div className="rain-a" style={{ opacity: 0.75 }} />
          <div className="rain-b" style={{ opacity: 0.6 }} />
        </div>
      )}
      {isFog && (
        <div
          className="scene-layer"
          style={{
            zIndex: 12,
            background: `linear-gradient(180deg, rgba(238,233,219,.32), rgba(238,233,219,.56))`,
            mixBlendMode: 'screen',
            opacity: 0.7,
          }}
        />
      )}

      {/* tonal wash from the 5×4 table */}
      <div
        className="scene-wash"
        style={{
          backgroundColor: wash.color,
          opacity: config.showPost ? wash.opacity : wash.opacity * 0.55,
          mixBlendMode: wash.blend,
        }}
      />
      {config.showPost && (
        <>
          <div className="paper-overlay" style={{ opacity: config.grain / 100 }} />
          <div className="vignette-layer" />
        </>
      )}
      <div className="scene-edge" />

      {/* HUD */}
      <div className="scene-hud">
        <div className="scene-title">
          <div className="scene-kicker">
            镜湖 · 云梦泽北麓
            <span className="opacity-60">/ {isNight ? '亥时' : isDusk ? '酉时' : config.time === 'dawn' ? '卯时' : '午时'}</span>
          </div>
          <div className="scene-brush">{title}</div>
          <div className="scene-caption">
            {t.time} · {wx.label} · {isNight ? '月白' : isDusk ? '晚照' : isRain ? '细雨' : isFog ? '烟岚' : '静水'}
            <span className="mx-2 opacity-40">|</span>
            {preset.note}
          </div>
        </div>

        <div className="scene-status">
          <span className="chip">
            <span className="dot" style={{ background: wx.hash }} />
            {wx.label} · {t.time}
          </span>
          <span className="chip">{still ? '静观 · 雾起一档' : '镜湖 · 局部'}</span>
        </div>

        <div className="scene-tools" aria-label="意境图层">
          {[
            { k: 'showFar' as const, label: '山', title: '远山三层' },
            { k: 'showSky' as const, label: '天', title: '天空意象' },
            { k: 'showMist' as const, label: '雾', title: '烟岚水汽' },
            { k: 'showSpots' as const, label: '点', title: '点景：孤帆村落' },
            { k: 'showPost' as const, label: '纸', title: '宣纸后处理' },
          ].map((tool) => (
            <button
              key={tool.k}
              type="button"
              className="scene-tool"
              data-on={config[tool.k]}
              title={`${tool.title}：${config[tool.k] ? '开' : '关'}`}
              aria-label={tool.title}
              onClick={() => onToggle(tool.k)}
            >
              {tool.label}
            </button>
          ))}
        </div>

        <div className="scene-verse">{preset.quote}</div>

        <div className="still-flag" data-show={still}>
          静观十秒 · 留白自生
        </div>

        <div className="scene-bottom">
          <div className="scene-hint">
            <InkIcon name="feather" />
            移动鼠标 · 镜头随行
            <span className="opacity-40">/</span>
            唤雁听风
          </div>
          <div className="scene-sig">
            <Seal>镜湖</Seal>
            凡人修仙传 · 意境稿
            <span className="opacity-40">No.{preset.id === 'dawn-lake' ? '01' : preset.id === 'dusk-village' ? '02' : preset.id === 'night-stars' ? '03' : '04'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
