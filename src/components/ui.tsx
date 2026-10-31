import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Seal({ children = '凡', className }: { children?: ReactNode; className?: string }) {
  return <span className={cn('seal', className)}>{children}</span>;
}

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="switch"
      data-on={on}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  suffix = '%',
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="slider-row">
      <span className="slider-name">{label}</span>
      <input
        className="ink-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export function SectionHead({
  title,
  en,
  right,
}: {
  title: string;
  en?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2.5">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <span className="text-[13px] tracking-[0.08em] whitespace-nowrap">{title}</span>
        {en && <span className="label truncate">{en}</span>}
      </div>
      {right}
    </div>
  );
}

export function InkIcon({ name }: { name: 'arrow' | 'sound' | 'sound-off' | 'feather' | 'download' | 'eye' | 'expand' | 'close' | 'search' | 'check' | 'chevron' }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M2 7h9" /><path d="M8 4l3 3-3 3" /></>,
    sound: <><path d="M3 5h2l3-2v8L5 9H3z" /><path d="M10 5c1.2 1.2 1.2 2.8 0 4" /></>,
    'sound-off': <><path d="M3 5h2l3-2v8L5 9H3z" /><path d="M10 5l3 4M13 5l-3 4" /></>,
    feather: <><path d="M12 2C7 2 3 5 3 9c0 1.5.7 2.6 1 3l6-6" /><path d="M3 12l1-3" /><path d="M6 10h4" /></>,
    download: <><path d="M7 2v7" /><path d="M4.5 6.5L7 9l2.5-2.5" /><path d="M2 11h10" /></>,
    eye: <><path d="M1.5 7S3.8 3 7 3s5.5 4 5.5 4-2.3 4-5.5 4S1.5 7 1.5 7z" /><circle cx="7" cy="7" r="1.4" /></>,
    expand: <><path d="M2 5V2h3M12 5V2H9M2 9v3h3M12 9v3H9" /></>,
    close: <path d="M3 3l8 8M11 3l-8 8" />,
    search: <><circle cx="6" cy="6" r="3.6" /><path d="M9 9l3 3" /></>,
    check: <path d="M2.5 7l3 3 5-6" />,
    chevron: <path d="M4 6l3 3 3-3" />,
  };
  return (
    <svg viewBox="0 0 14 14" className="ink-icon" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
