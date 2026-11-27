/**
 * Pulpport's vendors as paper busts (#33), rendered by blender/npcs.py: assets/npc/<id>.png (mouth shut),
 * <id>_talk.png (mouth open, the same frame) and npcs.json. The shop screen with the vendor in a speech bubble is #34.
 * Busts face right in three-quarter view, like the fighters; flip them (scaleX(-1)) to face left.
 */

export const NPC_IDS = ['old_crease', 'armourer', 'mirra', 'brother_tape', 'magpie'] as const;
export type NpcId = (typeof NPC_IDS)[number];

export interface Npc {
  name: string;
  role: string;
  /** file names inside assets/npc */
  still: string;
  talk: string;
  /** px, both states */
  w: number;
  h: number;
}

/** who stands behind which town building (src/ui/town.ts BUILDINGS ids) */
export const VENDOR_AT: Readonly<Record<string, NpcId>> = {
  weaponsmith: 'old_crease',
  forge: 'old_crease',
  armourer: 'armourer',
  enchanter: 'mirra',
  temple: 'brother_tape',
  trainer: 'magpie',
};

/** seconds the mouth stays in each state while talking: shut, open, shut, ... */
export const MOUTH_BEAT = 0.13;

/** is the mouth open `t` seconds into a line that lasts `length` seconds (shut before and after)? */
export function mouthOpen(t: number, length: number): boolean {
  if (t < 0 || t >= length) return false;
  return Math.floor(t / MOUTH_BEAT) % 2 === 1;
}

let manifest: Promise<Record<NpcId, Npc> | null> | null = null;

/** loads npcs.json once; null when it is missing */
export function loadNpcs(): Promise<Record<NpcId, Npc> | null> {
  manifest ??= fetch(`${import.meta.env.BASE_URL}npc/npcs.json`)
    .then((r) => r.json() as Promise<{ npcs: Record<NpcId, Npc> }>)
    .then((j) => j.npcs)
    .catch((e) => { console.warn('npc busts not loaded', e); return null; });
  return manifest;
}

/** URL of a bust picture */
export function npcUrl(npc: Npc, talking = false): string {
  return `${import.meta.env.BASE_URL}npc/${talking ? npc.talk : npc.still}`;
}
