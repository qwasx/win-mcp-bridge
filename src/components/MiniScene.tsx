import type { Preset } from '../data/mood';

/**
 * Four small ink-painting scenes used for the acceptance wall and preset picker.
 * Pure SVG so the thumbnails stay crisp and carry the same palette as the live scene.
 */
export function MiniScene({ preset, className }: { preset: Preset; className?: string }) {
  const { mini, time, weather, id } = preset;
  const uid = id.replace(/[^a-z0-9]/gi, '');
  const [skyTop, skyBottom] = mini.sky;
  const isNight = time === 'night';
  const isDusk = time === 'dusk';
  const isRain = weather === 'rain';

  return (
    <svg
      viewBox="0 0 220 92"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={preset.name}
    >
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="0.74" stopColor={skyBottom} />
          <stop offset="1" stopColor={isDusk ? '#e9c8a2' : isNight ? '#4e6467' : '#f4eeda'} />
        </linearGradient>
        <linearGradient id={`water${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={isNight ? '#3c5258' : isDusk ? '#b7a995' : '#b8cbc2'} />
          <stop offset="1" stopColor={isNight ? '#182730' : isDusk ? '#837d70' : '#8aa39c'} />
        </linearGradient>
        <linearGradient id={`mtn${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mini.wash} stopOpacity={isNight ? 0.75 : 0.55} />
          <stop offset="1" stopColor={mini.wash} stopOpacity={isNight ? 0.2 : 0.12} />
        </linearGradient>
        <radialGradient id={`glow${uid}`}>
          <stop offset="0" stopColor={mini.accent} stopOpacity="0.55" />
          <stop offset="1" stopColor={mini.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`mist${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffdf3" stopOpacity="0" />
          <stop offset="0.4" stopColor="#fffdf3" stopOpacity={isRain ? 0.5 : 0.32} />
          <stop offset="0.75" stopColor="#fffdf3" stopOpacity={isRain ? 0.4 : 0.24} />
          <stop offset="1" stopColor="#fffdf3" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="220" height="92" fill={`url(#sky${uid})`} />
      <ellipse cx="150" cy="58" rx="92" ry="28" fill={`url(#glow${uid})`} />

      {isNight && (
        <g fill="#eef0db">
          {[
            [32, 15, 0.9], [57, 9, 0.6], [72, 22, 0.7], [95, 13, 0.5], [121, 20, 0.8],
            [143, 8, 0.5], [163, 24, 0.6], [183, 12, 0.8], [201, 28, 0.5], [18, 29, 0.55],
          ].map(([x, y, o], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 0.9 : 0.55} opacity={o} />)}
        </g>
      )}

      {/* moon / sun */}
      {isNight ? (
        <g>
          <circle cx="171" cy="25" r="15" fill="#e9e5c8" opacity="0.12" />
          <circle cx="171" cy="25" r="10" fill="#ece8cd" opacity="0.25" />
          <circle cx="171" cy="25" r="6.4" fill="#f2eed8" opacity="0.92" />
        </g>
      ) : (
        <g>
          <circle cx={isDusk ? 163 : 51} cy={isDusk ? 42 : 29} r="18" fill={mini.accent} opacity={isDusk ? 0.26 : 0.16} />
          <circle cx={isDusk ? 163 : 51} cy={isDusk ? 42 : 29} r={isDusk ? 5.4 : 4.4} fill={isDusk ? '#f1cf9d' : '#f5edd1'} opacity="0.78" />
        </g>
      )}

      {/* cloud strokes */}
      <g fill="#fffdf4" opacity={isNight ? 0.1 : 0.38}>
        <path d="M-4 37c15-4 28-2 42 1 10 2 18 0 27-2 3 4-2 6-9 7-18 3-34-1-48 1z" />
        <path d="M88 25c18-4 34-2 49 2 8 2 15 1 23-1-1 5-9 7-19 7-20 1-38-3-53-1z" opacity="0.65" />
      </g>

      {/* far mountains */}
      <g>
        <path d="M0 58L15 47l11 6 17-14 14 11 18-19 17 15 15-8 17 12 20-16 16 11 15-5 22 15 23-9v22H0z" fill={mini.wash} opacity={isNight ? 0.42 : 0.28} />
        <path d="M0 64L18 53l14 8 18-16 16 13 22-18 14 14 20-9 19 15 22-20 17 13 19-7 21 18v14H0z" fill={`url(#mtn${uid})`} />
        <path d="M0 65L19 54l14 8 18-16 16 13 22-18 14 14 20-9 19 15 22-20 16 14 20-7 20 18" fill="none" stroke={mini.wash} strokeWidth="0.7" opacity="0.6" />
      </g>

      {/* mid mist */}
      <rect x="0" y="57" width="220" height="11" fill={`url(#mist${uid})`} />

      {/* water */}
      <rect x="0" y="66" width="220" height="26" fill={`url(#water${uid})`} />
      <g stroke="#fffdf2" strokeWidth="0.55" opacity={isNight ? 0.24 : 0.4}>
        <path d="M12 73h36M56 78h52M120 71h34M170 80h36M28 85h44M98 86h28" />
      </g>
      <g fill={mini.wash} opacity={isNight ? 0.28 : 0.19}>
        <path d="M6 67l14-5 13 7z" />
        <path d="M30 67l18-7 16 8z" />
      </g>

      {/* village on the right for dusk / day */}
      {(isDusk || time === 'noon') && (
        <g>
          <path d="M142 69l22-8 20 7 17-6 19 8v6h-78z" fill={mini.ink} opacity="0.82" />
          <path d="M151 62l7-5 7 5h-3v7h-8v-7z" fill={mini.ink} opacity="0.9" />
          <path d="M165 59l9-6 9 7h-4v9h-10v-9z" fill={mini.ink} opacity="0.85" />
          <path d="M186 62l7-5 7 5h-3v6h-8v-6z" fill={mini.ink} opacity="0.92" />
          <rect x="169" y="63" width="2.2" height="2.8" fill={mini.accent} opacity="0.9" />
          <rect x="189" y="64" width="2" height="2.5" fill={mini.accent} opacity="0.75" />
          <path d="M173 52c-2-5 2-8 0-12" fill="none" stroke="#fffdf2" strokeWidth="1.6" strokeLinecap="round" opacity="0.34" />
        </g>
      )}

      {/* sail / boat */}
      <g transform={isRain ? 'translate(32 61) scale(.82)' : isDusk ? 'translate(95 62) scale(.9)' : 'translate(38 61) scale(.9)'}>
        <path d="M-8 6h28l-5 5H-2z" fill={mini.ink} opacity="0.9" />
        <path d="M4 6V-11l10 14H4z" fill="#f4eeda" stroke={mini.ink} strokeWidth="0.7" opacity="0.9" />
        <path d="M4 6V-6l-6 10h6z" fill="#f4eeda" stroke={mini.ink} strokeWidth="0.6" opacity="0.72" />
        {isNight && <circle cx="17" cy="3" r="1.7" fill={mini.accent} />}
        {isNight && <circle cx="17" cy="3" r="4" fill={mini.accent} opacity="0.22" />}
      </g>

      {/* foreground reeds */}
      <g stroke={isNight ? '#adbcb0' : '#5a675a'} strokeWidth="0.8" fill="none" opacity="0.55">
        <path d="M204 92c-4-15 2-22-1-33M209 92c1-12-3-18 1-29M214 92c4-12-1-17 2-25" />
      </g>
      <g fill={isNight ? '#b9c4b4' : '#d6c7a5'} opacity="0.62">
        <ellipse cx="203" cy="56" rx="1.8" ry="4.6" transform="rotate(-10 203 56)" />
        <ellipse cx="210" cy="61" rx="1.4" ry="3.8" transform="rotate(6 210 61)" />
        <ellipse cx="216" cy="66" rx="1.2" ry="3.2" transform="rotate(10 216 66)" />
      </g>

      {isRain && (
        <g stroke="#f4f6ee" strokeWidth="0.5" opacity="0.35">
          <path d="M14 2L3 34M38 -3L27 30M64 1L52 34M92 -4L80 28M120 0L108 32M146 -2L135 31M174 1L162 33M202 -3L190 29M216 6L205 36" />
        </g>
      )}

      <rect width="220" height="92" fill="none" stroke="rgba(235,226,205,.25)" strokeWidth="1" />
    </svg>
  );
}
