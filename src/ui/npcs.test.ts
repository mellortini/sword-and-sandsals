import { describe, expect, it } from 'vitest';
import manifest from '../../assets/npc/npcs.json';
import { BUILDINGS } from './town';
import { MOUTH_BEAT, NPC_IDS, VENDOR_AT, mouthOpen } from './npcs';
import type { Npc } from './npcs';

const npcs = manifest.npcs as Record<string, Npc>;

describe('vendor busts (#33)', () => {
  it('has the five vendors, each still and talking in one frame size', () => {
    expect(Object.keys(npcs).sort()).toEqual([...NPC_IDS].sort());
    for (const id of NPC_IDS) {
      const n = npcs[id];
      expect(n.still).toBe(`${id}.png`);
      expect(n.talk).toBe(`${id}_talk.png`);
      expect(n.name.length).toBeGreaterThan(0);
      expect(n.w).toBeGreaterThan(200);
      expect(n.h).toBeGreaterThan(200);
    }
    expect(npcs.old_crease.name).toBe('Old Crease');
    expect(npcs.mirra.name).toBe('Mirra Inkwell');
  });

  it('puts a vendor behind every town building that has one', () => {
    const ids = BUILDINGS.map((b) => b.id);
    for (const [building, npc] of Object.entries(VENDOR_AT)) {
      expect(ids, building).toContain(building);
      expect(NPC_IDS).toContain(npc);
    }
  });

  it('flaps the mouth while talking and keeps it shut otherwise', () => {
    expect(mouthOpen(-0.1, 1)).toBe(false);
    expect(mouthOpen(0, 1)).toBe(false);
    expect(mouthOpen(MOUTH_BEAT * 1.5, 1)).toBe(true);
    expect(mouthOpen(MOUTH_BEAT * 2.5, 1)).toBe(false);
    expect(mouthOpen(MOUTH_BEAT * 1.5, MOUTH_BEAT)).toBe(false);
  });
});
