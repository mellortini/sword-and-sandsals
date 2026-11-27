/**
 * Quiet paper foley for the fight (#18), synthesised with Web Audio. Recorded sounds are the exception: a weapon on a
 * shield (SAMPLES below) and the wet tear of a cut (sever.ts). The synthesised kinds:
 *  - rustle: white noise through a band-pass that sweeps (paper moving, a blade cutting the air)
 *  - thump: a sine falling in pitch (cardboard slapping cardboard, a body on the sand)
 *  - ring: a few inharmonic partials with a fast decay (the foil of a shield or blade)
 * Every play varies pitch and loudness a little, so repeated blows never sound copied.
 */
import type { Animator } from '../anim/Animator';
import { getMixer } from './mixer';
import type { Mixer } from './mixer';
import { loadSample, playSample, readySample } from './sample';
import { preloadSever } from './sever';

export type Sound = 'swing' | 'miss' | 'hit' | 'crit' | 'block' | 'step' | 'land' | 'impact';

export type Layer =
  | { type: 'rustle'; from: number; to: number; q: number; dur: number; gain: number; delay?: number }
  | { type: 'thump'; from: number; to: number; dur: number; gain: number; delay?: number }
  | { type: 'ring'; freqs: readonly number[]; dur: number; gain: number; delay?: number };

/** frequencies in Hz, times in seconds, gains before the foley / master volumes (kept low: nothing dominates) */
export const RECIPES: Readonly<Record<Sound, readonly Layer[]>> = {
  swing: [{ type: 'rustle', from: 2200, to: 700, q: 1.4, dur: 0.17, gain: 0.22 }],
  miss: [{ type: 'rustle', from: 2600, to: 600, q: 1.2, dur: 0.24, gain: 0.24 }],
  hit: [
    { type: 'thump', from: 150, to: 70, dur: 0.12, gain: 0.42 },
    { type: 'rustle', from: 1100, to: 500, q: 0.9, dur: 0.11, gain: 0.3 },
  ],
  crit: [
    { type: 'thump', from: 120, to: 50, dur: 0.22, gain: 0.55 },
    { type: 'rustle', from: 1400, to: 380, q: 0.8, dur: 0.2, gain: 0.36 },
    { type: 'rustle', from: 4200, to: 2500, q: 2.5, dur: 0.12, gain: 0.12, delay: 0.02 },
  ],
  block: [
    { type: 'ring', freqs: [930, 1390, 2210], dur: 0.32, gain: 0.12 },
    { type: 'thump', from: 220, to: 140, dur: 0.07, gain: 0.25 },
    { type: 'rustle', from: 5200, to: 3200, q: 3, dur: 0.08, gain: 0.1 },
  ],
  step: [{ type: 'rustle', from: 700, to: 420, q: 1.1, dur: 0.07, gain: 0.07 }],
  land: [
    { type: 'thump', from: 120, to: 60, dur: 0.15, gain: 0.32 },
    { type: 'rustle', from: 650, to: 300, q: 0.9, dur: 0.18, gain: 0.16 },
  ],
  impact: [
    { type: 'thump', from: 95, to: 40, dur: 0.32, gain: 0.5 },
    { type: 'rustle', from: 520, to: 220, q: 0.8, dur: 0.36, gain: 0.22 },
    { type: 'rustle', from: 1800, to: 900, q: 1.5, dur: 0.18, gain: 0.08, delay: 0.05 },
  ],
};

/** recordings that replace a synthesised sound; the recipe above plays until the file is decoded */
export const SAMPLES: Readonly<Partial<Record<Sound, { file: string; gain: number }>>> = {
  // a weapon on a shield: the recording peaks at full scale, so it is turned well down
  block: { file: 'sfx/combat/shield_thud.wav', gain: 0.3 },
};

function preloadSamples() {
  const m = getMixer();
  if (m) for (const s of Object.values(SAMPLES)) void loadSample(m, s.file);
}

/** the same sound twice within this many seconds plays once (both fighters' events on one frame) */
const MIN_GAP = 0.035;
const last = new Map<Sound, number>();

function envelope(m: Mixer, at: number, dur: number, gain: number): GainNode {
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.008, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(m.foley);
  return g;
}

function layer(m: Mixer, l: Layer, at: number, pitch: number, loud: number) {
  const t = at + (l.delay ?? 0);
  const env = envelope(m, t, l.dur, l.gain * loud);
  if (l.type === 'rustle') {
    const src = m.ctx.createBufferSource();
    src.buffer = m.noise;
    const bp = m.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = l.q;
    bp.frequency.setValueAtTime(l.from * pitch, t);
    bp.frequency.exponentialRampToValueAtTime(l.to * pitch, t + l.dur);
    src.connect(bp).connect(env);
    src.start(t, Math.random() * 0.5, l.dur + 0.05);
  } else if (l.type === 'thump') {
    const osc = m.ctx.createOscillator();
    osc.frequency.setValueAtTime(l.from * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(l.to * pitch, t + l.dur);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + l.dur + 0.05);
  } else {
    for (const f of l.freqs) {
      const osc = m.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * pitch;
      osc.connect(env);
      osc.start(t);
      osc.stop(t + l.dur + 0.05);
    }
  }
}

/** play one foley sound now (silent until the player has clicked or pressed a key once) */
export function playFoley(sound: Sound, random: () => number = Math.random) {
  const m = getMixer();
  if (!m || m.ctx.state !== 'running') return;
  const now = m.ctx.currentTime;
  if (now - (last.get(sound) ?? -1) < MIN_GAP) return;
  last.set(sound, now);
  const pitch = 0.94 + random() * 0.12;
  const loud = 0.85 + random() * 0.3;
  const sample = SAMPLES[sound];
  if (sample) {
    const buffer = readySample(sample.file);
    if (buffer) return playSample(m, buffer, sample.gain * loud, pitch);
    void loadSample(m, sample.file);
  }
  for (const l of RECIPES[sound]) layer(m, l, now, pitch, loud);
}

/** clip events that make a sound by themselves; a blow's result (hit / block / miss) is played by the presenter */
export const EVENT_SOUNDS: Readonly<Partial<Record<string, Sound>>> = { swing: 'swing', land: 'land', impact: 'impact', step: 'step' };

/** sound a fighter's own clip events: wind-ups, footsteps, landings, falls */
export function attachFoley(anim: Animator): () => void {
  preloadSever();
  preloadSamples();
  const listener = (e: { type: string }) => {
    const s = EVENT_SOUNDS[e.type];
    if (s) playFoley(s);
  };
  anim.listeners.add(listener);
  return () => { anim.listeners.delete(listener); };
}
