import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A tiny, asset-free ambience bed: filtered wind + occasional pentatonic chimes.
 * Everything is created on the first user gesture so autoplay policies are respected.
 */
export function useAmbience() {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);

  const chime = useCallback(() => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0];
    const note = notes[Math.floor(Math.random() * notes.length)];
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = note / 2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 3.6);
  }, []);

  const start = useCallback(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!ctxRef.current) {
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);

      const length = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      noise.connect(filter).connect(gain).connect(master);
      noise.start();

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06;
      lfoGain.gain.value = 0.018;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();

      ctxRef.current = ctx;
      masterRef.current = master;
    }
    void ctxRef.current.resume();
    timerRef.current = window.setInterval(chime, 15000);
  }, [chime]);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    void ctxRef.current?.suspend();
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev) stop();
      else start();
      return !prev;
    });
  }, [start, stop]);

  /** a distant, breathy goose call — used by the "唤一行秋雁" action */
  const playGoose = useCallback(() => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [0, 0.38].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 760;
      filter.Q.value = 2.4;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(i ? 430 : 510, now + offset);
      osc.frequency.exponentialRampToValueAtTime(i ? 300 : 360, now + offset + 0.32);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.022, now + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.42);
      osc.connect(filter).connect(gain).connect(master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.46);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      void ctxRef.current?.close();
    };
  }, []);

  return { enabled, toggle, playGoose };
}

export function useTelemetry() {
  const [fps, setFps] = useState(60);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 700) {
        setFps(Math.min(120, Math.round((frames * 1000) / (now - last))));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return { fps, frameMs: fps > 0 ? 1000 / fps : 0 };
}
