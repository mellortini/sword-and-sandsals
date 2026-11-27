/**
 * Quiet paper themes (#73) for the arena and the town, synthesised with Web Audio like the foley (no files):
 * a plucked lyre playing a slowly wandering tune over a soft drone, and in the arena a low frame drum.
 * The tune is generated bar by bar from a seed (barNotes, pure and tested): it never loops exactly, yet the same seed
 * always gives the same music. It sits on the mixer's music channel, under everything else.
 */
import { getMixer } from './mixer';

export type Theme = 'arena' | 'town';
export type Voice = 'lyre' | 'drone' | 'drum';

export interface Note {
  /** beats from the start of the bar */
  readonly beat: number;
  readonly midi: number;
  /** beats */
  readonly dur: number;
  readonly voice: Voice;
  /** 0..1 */
  readonly vel: number;
}

export const THEMES: Readonly<Record<Theme, { bpm: number; root: number; scale: readonly number[]; drum: boolean }>> = {
  // D dorian, a walking pulse: tense but not loud
  arena: { bpm: 92, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], drum: true },
  // G major pentatonic, slower: the forum in the afternoon
  town: { bpm: 72, root: 55, scale: [0, 2, 4, 7, 9], drum: false },
};

export const BEATS_PER_BAR = 4;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** scale degree (may be negative or past an octave) -> midi note */
export function degreeToMidi(theme: Theme, degree: number): number {
  const { root, scale } = THEMES[theme];
  const n = scale.length;
  const octave = Math.floor(degree / n);
  return root + 12 * octave + scale[((degree % n) + n) % n];
}

/**
 * The notes of bar `index`. Phrases are 4 bars; the harmony moves home / away every 4 bars (i - iv in the arena,
 * I - IV in the town). The tune walks by small steps around the middle of the lyre's range and rests now and then.
 */
export function barNotes(theme: Theme, index: number, seed = 73): Note[] {
  const t = THEMES[theme];
  const away = Math.floor(index / 4) % 2 === 1;
  const chordRoot = away ? 3 : 0;   // the 4th degree in both modes
  const notes: Note[] = [
    // drone: the chord's root and fifth held through the bar, an octave below the tune
    { beat: 0, midi: degreeToMidi(theme, chordRoot) - 12, dur: BEATS_PER_BAR, voice: 'drone', vel: 0.5 },
    { beat: 0, midi: degreeToMidi(theme, chordRoot) - 12 + 7, dur: BEATS_PER_BAR, voice: 'drone', vel: 0.35 },
  ];
  // the tune: the same phrase shape every 4 bars, varied by the seed per phrase
  const r = rng(seed * 7919 + Math.floor(index / 4) * 104729 + (index % 4) * 31);
  let degree = t.scale.length + chordRoot + Math.floor(r() * 3);   // start near the chord, an octave above the root
  const step = theme === 'arena' ? 0.5 : 1;
  for (let beat = 0; beat < BEATS_PER_BAR; beat += step) {
    if (r() < (theme === 'arena' ? 0.3 : 0.35)) continue;   // breathing space
    degree += [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)];
    degree = Math.max(t.scale.length - 2, Math.min(t.scale.length * 2 + 1, degree));   // keep to the lyre's range
    const accent = beat === 0 || beat === 2 ? 0.75 : 0.5;
    notes.push({ beat, midi: degreeToMidi(theme, degree), dur: step * (r() < 0.2 ? 2 : 1), voice: 'lyre', vel: accent + r() * 0.15 });
  }
  if (t.drum) {
    notes.push({ beat: 0, midi: 0, dur: 0.5, voice: 'drum', vel: 0.8 });
    notes.push({ beat: 2, midi: 0, dur: 0.5, voice: 'drum', vel: 0.55 });
    if (index % 2 === 1) notes.push({ beat: 3.5, midi: 0, dur: 0.25, voice: 'drum', vel: 0.35 });
  }
  return notes;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export interface MusicPlayer { stop(fade?: number): void }

const SILENT: MusicPlayer = { stop: () => {} };
let playing: MusicPlayer | null = null;

/** plays a theme until stopped; starting another theme fades this one out */
export function startMusic(theme: Theme, seed = Math.floor(Math.random() * 1000)): MusicPlayer {
  playing?.stop(1.5);
  const m = getMixer();
  if (!m) return SILENT;
  const { ctx } = m;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(m.music);
  out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);   // fade in
  const secPerBeat = 60 / THEMES[theme].bpm;
  let bar = 0;
  let barStart = ctx.currentTime + 0.2;
  let stopped = false;

  const play = (n: Note, at: number) => {
    const dur = n.dur * secPerBeat;
    if (n.voice === 'drum') {
      // a frame drum: a sine falling in pitch, and the skin's slap as a short band of noise
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(95, at);
      o.frequency.exponentialRampToValueAtTime(48, at + 0.18);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.32 * n.vel, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.32);
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      src.buffer = m.noise;
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
      ng.gain.setValueAtTime(0.06 * n.vel, at);
      ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      src.connect(bp).connect(ng).connect(out);
      src.start(at, Math.random() * 0.5, 0.1);
      return;
    }
    const f = hz(n.midi);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    if (n.voice === 'drone') {
      // two detuned saws, filtered dark, swelling in and out with the bar
      lp.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.03 * n.vel, at + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.2);
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(lp);
        o.start(at);
        o.stop(at + dur + 0.25);
      }
    } else {
      // the lyre: a plucked triangle with its octave, bright at the attack, ringing out
      lp.frequency.setValueAtTime(3200, at);
      lp.frequency.exponentialRampToValueAtTime(900, at + 0.4);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.09 * n.vel, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.5, dur * 1.6));
      for (const [mult, type, level] of [[1, 'triangle', 1], [2, 'sine', 0.35]] as const) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type;
        o.frequency.value = f * mult;
        og.gain.value = level;
        o.connect(og).connect(lp);
        o.start(at);
        o.stop(at + Math.max(0.55, dur * 1.7));
      }
    }
    lp.connect(g).connect(out);
  };

  // schedule a bar ahead of the clock: steady timing whatever the frame rate
  const timer = setInterval(() => {
    if (stopped) return;
    while (barStart < ctx.currentTime + 0.4) {
      for (const n of barNotes(theme, bar, seed)) play(n, barStart + n.beat * secPerBeat);
      bar++;
      barStart += BEATS_PER_BAR * secPerBeat;
    }
  }, 100);

  const player: MusicPlayer = {
    stop(fade = 1) {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
      setTimeout(() => out.disconnect(), fade * 1000 + 600);
      if (playing === player) playing = null;
    },
  };
  playing = player;
  return player;
}
