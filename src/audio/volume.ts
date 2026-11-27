/**
 * Volume settings (#18, #73): master, foley (fight sounds), crowd, music and voices, 0..1 each, saved in the browser.
 * Pure: the mixer (src/audio/mixer.ts) applies them, the settings screen (#80) only has to call setVolume.
 * Quiet by default: the fight is heard, nothing dominates.
 */
export const CHANNELS = ['master', 'foley', 'crowd', 'music', 'voices'] as const;
export type Channel = (typeof CHANNELS)[number];
export type Volumes = Record<Channel, number>;

/** music sits under everything (#73); voices (the story's narrator) are clear */
export const DEFAULT_VOLUMES: Readonly<Volumes> = { master: 0.6, foley: 0.8, crowd: 0.5, music: 0.35, voices: 0.8 };
const KEY = 'folded-glory.volume';

const clamp = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

/** a saved JSON string (or anything broken) -> complete, clamped volumes */
export function parseVolumes(raw: string | null): Volumes {
  let saved: Partial<Record<Channel, unknown>> = {};
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (v && typeof v === 'object') saved = v as Partial<Record<Channel, unknown>>;
  } catch {
    // unreadable: defaults
  }
  return Object.fromEntries(CHANNELS.map((c) => [c, clamp(saved[c], DEFAULT_VOLUMES[c])])) as Volumes;
}

let current: Volumes | null = null;
const listeners = new Set<(v: Volumes) => void>();

export function volumes(): Volumes {
  if (!current) {
    let raw: string | null = null;
    try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    current = parseVolumes(raw);
  }
  return current;
}

export function setVolume(channel: Channel, value: number) {
  current = { ...volumes(), [channel]: clamp(value, DEFAULT_VOLUMES[channel]) };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private mode: holds until reload */ }
  for (const l of listeners) l(current);
}

const MUSIC_OFF_KEY = 'folded-glory.music-off';
let off: boolean | null = null;

/** music switched off as a whole (the settings' On / Off row); the music slider keeps its level for later */
export function musicOff(): boolean {
  if (off === null) {
    try { off = localStorage.getItem(MUSIC_OFF_KEY) === '1'; } catch { off = false; }
  }
  return off;
}

export function setMusicOff(value: boolean) {
  off = value;
  try { localStorage.setItem(MUSIC_OFF_KEY, value ? '1' : '0'); } catch { /* private mode: holds until reload */ }
  for (const l of listeners) l(volumes());
}

/** the level the music really plays at: 0 when switched off, or turned all the way down (itself or the master) */
export const musicLevel = (v: Volumes = volumes()) => (musicOff() || v.master === 0 ? 0 : v.music);

// a change made in another tab of the game applies here at once
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== MUSIC_OFF_KEY) return;
    current = null;
    off = null;
    for (const l of listeners) l(volumes());
  });
}

export function onVolumeChange(listener: (v: Volumes) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
