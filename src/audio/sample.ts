/**
 * Recorded sounds (assets/sfx/): each file is fetched and decoded once, then played through the mixer's foley channel.
 */
import type { Mixer } from './mixer';

const loading = new Map<string, Promise<AudioBuffer | null>>();
const ready = new Map<string, AudioBuffer>();

/** `file` = path under assets/; null when it can't be loaded (the next call tries again) */
export function loadSample(m: Mixer, file: string): Promise<AudioBuffer | null> {
  let p = loading.get(file);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
        if (!res.ok) throw new Error(`${res.status} ${file}`);
        const buffer = await m.ctx.decodeAudioData(await res.arrayBuffer());
        ready.set(file, buffer);
        return buffer;
      } catch (e) {
        console.warn('sound not loaded', file, e);
        loading.delete(file);
        return null;
      }
    })();
    loading.set(file, p);
  }
  return p;
}

/** the recording if it is already decoded, for sounds that must start on this very frame */
export const readySample = (file: string): AudioBuffer | undefined => ready.get(file);

export function playSample(m: Mixer, buffer: AudioBuffer, gain: number, rate = 1) {
  const src = m.ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = m.ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(m.foley);
  src.start();
}
