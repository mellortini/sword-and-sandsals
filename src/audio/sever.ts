/**
 * The wet tear of something cut off: a head today (finishers, src/ui/finisher.ts), limbs next (#275).
 * One call, `playSever()`, plays one of the recordings in assets/sfx/gore/, never the same one twice in a row.
 * It goes through the mixer's foley channel (master + fight sounds volumes) and is silent with gore off.
 */
import { goreMode } from '../ui/gore';
import type { GoreMode } from '../ui/gore';
import { getMixer } from './mixer';
import type { Mixer } from './mixer';

/** paths under assets/ */
export const SEVER_FILES = ['sfx/gore/squelch_1.wav', 'sfx/gore/squelch_2.wav', 'sfx/gore/squelch_3.wav'] as const;

/** the recordings peak at full scale: turned down to sit with the paper foley, under the voices */
export const SEVER_GAIN = 0.3;

/** two cuts within this many seconds make one sound */
const MIN_GAP = 0.08;
/** a recording that finishes loading later than this after the cut stays silent */
const MAX_LATE = 0.25;

/** the next variant: any of `count` except the one played last */
export function pickVariant(count: number, previous: number, random: () => number = Math.random): number {
  if (previous < 0 || count < 2) return Math.floor(random() * count);
  const i = Math.floor(random() * (count - 1));
  return i >= previous ? i + 1 : i;
}

let buffers: Promise<AudioBuffer | null>[] | null = null;
let lastVariant = -1;
let lastAt = -1;

function load(m: Mixer): Promise<AudioBuffer | null>[] {
  buffers ??= SEVER_FILES.map(async (file) => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!res.ok) throw new Error(`${res.status} ${file}`);
      return await m.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) {
      console.warn('sever sound not loaded', e);
      buffers = null; // try again next time
      return null;
    }
  });
  return buffers;
}

/** fetch the recordings ahead of the first cut (a fight calls this through attachFoley) */
export function preloadSever() {
  const m = getMixer();
  if (m) void load(m);
}

/**
 * Call on the frame a head or a limb comes off. Does nothing with gore off (nobody loses anything then).
 * `mode` defaults to the saved gore setting; pass it only when the picture was drawn with another one.
 */
export function playSever(mode: GoreMode = goreMode(), random: () => number = Math.random) {
  if (mode === 'off') return;
  const m = getMixer();
  if (!m || m.ctx.state !== 'running') return;
  const asked = m.ctx.currentTime;
  if (lastAt >= 0 && asked - lastAt < MIN_GAP) return;
  lastAt = asked;
  lastVariant = pickVariant(SEVER_FILES.length, lastVariant, random);
  const pitch = 0.95 + random() * 0.1;
  void load(m)[lastVariant].then((buffer) => {
    if (!buffer || m.ctx.currentTime - asked > MAX_LATE) return;
    const src = m.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pitch;
    const gain = m.ctx.createGain();
    gain.gain.value = SEVER_GAIN;
    src.connect(gain).connect(m.foley);
    src.start();
  });
}
