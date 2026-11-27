import { describe, expect, it } from 'vitest';
import kitJson from '../../assets/chars/kit/kit.json';
import { sample } from '../anim/clip';
import { ALL_CLIPS, CLIP_FACES, bakeAll } from '../anim/clips';
import { EXPRESSIONS, EXPRESSION_PIECES, pieceShown } from './expressions';

const kit = kitJson as unknown as { faces: unknown[]; layers: { slot: string; piece: string }[]; sprites: Record<string, unknown>; pose_test: Record<string, number> };

describe('expressions (#26)', () => {
  it('every face has the three expression sprites and their layers', () => {
    for (const piece of ['lids_closed', 'mouth_open', 'brows_angry']) {
      expect(kit.layers.some((l) => l.slot === 'face' && l.piece === piece)).toBe(true);
      kit.faces.forEach((_, i) => expect(kit.sprites).toHaveProperty(`face${i}_${piece}`));
    }
  });

  it('a neutral pose shows the usual face, an expression swaps the right pieces', () => {
    expect(['lids_closed', 'mouth_open', 'brows_angry'].some((p) => pieceShown(p, {}))).toBe(false);
    expect(pieceShown('brows', {})).toBe(true);
    expect(pieceShown('lids', EXPRESSIONS.pain)).toBe(true);   // the open lids stay under the shut ones
    expect(pieceShown('lids_closed', EXPRESSIONS.pain) && pieceShown('mouth_open', EXPRESSIONS.pain)).toBe(true);
    expect(pieceShown('brows_angry', EXPRESSIONS.anger) && !pieceShown('brows', EXPRESSIONS.anger)).toBe(true);
    expect(Object.keys(EXPRESSION_PIECES)).toContain('brows');
  });

  it('clip faces sit on existing key frames and come back to neutral unless the clip holds', () => {
    const baked = bakeAll(kit.pose_test);
    for (const [name, frames] of Object.entries(CLIP_FACES)) {
      const clip = ALL_CLIPS.find((c) => c.name === name);
      expect(clip, name).toBeDefined();
      for (const f of Object.keys(frames)) expect(clip!.keys.some((k) => k.f === +f), `${name} f${f}`).toBe(true);
      const end = sample(baked[name], clip!.length).pose;
      if (!clip!.hold) for (const k of ['eyes', 'mouth', 'brows']) expect(end[k] ?? 0, `${name} ${k}`).toBeLessThan(0.5);
    }
    expect(sample(baked.hit, 4).pose.eyes).toBeGreaterThan(0.5);
    expect(sample(baked.victory, 12).pose.mouth).toBeGreaterThan(0.5);
    expect(sample(baked.death, 40).pose.eyes).toBeGreaterThan(0.5);
  });
});
