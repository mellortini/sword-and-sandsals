/**
 * The crowd in the stands (#18): a low murmur of filtered noise that breathes slowly, and a short swell of cheering
 * for a critical blow or the end of a bout. Sits on the crowd channel, well under the foley.
 */
import { getMixer } from './mixer';

export interface CrowdAmbience { cheer(strength?: number): void; stop(): void }

const SILENT: CrowdAmbience = { cheer: () => {}, stop: () => {} };

/** five seconds of noise: a one-second loop would be heard repeating under the murmur */
let murmur: AudioBuffer | null = null;
function murmurBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (!murmur) {
    murmur = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate);
    const d = murmur.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return murmur;
}

export function startCrowd(): CrowdAmbience {
  const m = getMixer();
  if (!m) return SILENT;
  const { ctx } = m;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(m.crowd);
  // two bands of murmur (voices low and mid), each with its own slow swell
  const sources: AudioScheduledSourceNode[] = [];
  for (const [freq, q, level, rate] of [[420, 0.7, 0.2, 0.13], [1150, 1.1, 0.1, 0.21]] as const) {
    const src = ctx.createBufferSource();
    src.buffer = murmurBuffer(ctx);
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = level * 0.45;
    lfo.connect(depth).connect(g.gain);
    src.connect(bp).connect(g).connect(out);
    src.start();
    lfo.start();
    sources.push(src, lfo);
  }
  // fade in over a second, so entering the arena never starts with a burst
  out.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
  let stopped = false;
  return {
    cheer(strength = 1) {
      if (stopped) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = m.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25 * strength, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      src.connect(bp).connect(g).connect(out);
      src.start(t, Math.random() * 0.3, 1.7);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      for (const s of sources) s.stop(ctx.currentTime + 1);
    },
  };
}
