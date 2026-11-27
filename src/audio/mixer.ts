/**
 * One Web Audio graph for the game (#18): sources -> foley / crowd bus -> master -> speakers, with the saved volumes.
 * The context is created on first use and resumed on the first click or key press (browsers keep audio locked until then).
 */
import { onVolumeChange, volumes } from './volume';
import type { Volumes } from './volume';

export interface Mixer {
  ctx: AudioContext;
  foley: GainNode;
  crowd: GainNode;
  /** the quiet themes of the arena and the town (#73) */
  music: GainNode;
  /** one second of white noise, shared by every paper sound */
  noise: AudioBuffer;
}

let mixer: Mixer | null = null;

/** the mixer, or null where Web Audio is missing (tests, old browsers): callers then stay silent */
export function getMixer(): Mixer | null {
  if (mixer) return mixer;
  const Ctx = typeof window !== 'undefined' ? window.AudioContext : undefined;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  // a gentle limiter: many blows at once never clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  const foley = ctx.createGain();
  const crowd = ctx.createGain();
  const music = ctx.createGain();
  foley.connect(master);
  crowd.connect(master);
  music.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  mixer = { ctx, foley, crowd, music, noise };
  const apply = (v: Volumes) => {
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(v.master, t, 0.03);
    foley.gain.setTargetAtTime(v.foley, t, 0.03);
    crowd.gain.setTargetAtTime(v.crowd, t, 0.03);
    music.gain.setTargetAtTime(v.music, t, 0.08);
  };
  master.gain.value = volumes().master;
  foley.gain.value = volumes().foley;
  crowd.gain.value = volumes().crowd;
  music.gain.value = volumes().music;
  onVolumeChange(apply);
  const unlock = () => { void ctx.resume(); };
  for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlock, { passive: true });
  return mixer;
}
