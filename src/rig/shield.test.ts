import { describe, expect, it } from 'vitest';
import kitJson from '../../assets/chars/kit/kit.json';
import { ALL_CLIPS } from '../anim/clips';
import { bake, sample } from '../anim/clip';
import type { KitJson, Pose } from './PaperRig';
import { ROUND_TIERS, SHIELD_TIERS, holdShield, isShieldTier, shieldArmInFront, shieldName, shieldShape } from './shield';
import { forwardKinematics } from './twoHand';

const kit = kitJson as unknown as KitJson;

describe('shields (#38)', () => {
  it('has a sprite for every tier, and a shield bone on the back hand', () => {
    for (let t = 1; t <= SHIELD_TIERS; t++) expect(kit.sprites[`shield${t}`], `tier ${t}`).toBeDefined();
    expect(kit.bones.find((b) => b.name === 'shield')?.parent).toBe('hand_b');
    expect(kit.layers.some((l) => l.slot === 'shield' && l.bone === 'shield')).toBe(true);
  });

  it('draws the shield over the body but under the sword arm', () => {
    const at = (slot: string, bone?: string) => kit.layers.findIndex((l) => l.slot === slot && (!bone || l.bone === bone));
    expect(at('shield')).toBeGreaterThan(at('armor', 'torso'));
    expect(at('shield')).toBeLessThan(at('body', 'arm_f_lo'));
  });

  it('gives the early tiers a round parma and the legion era a bigger scutum', () => {
    expect([1, 2, 3, 4, 5, 10].map(shieldShape)).toEqual(['round', 'round', 'round', 'round', 'scutum', 'scutum']);
    expect(ROUND_TIERS).toBe(4);
    const size = (t: number) => kit.sprites[`shield${t}`].h;   // taller with every tier
    for (let t = 2; t <= SHIELD_TIERS; t++) expect(size(t), `tier ${t}`).toBeGreaterThan(size(t - 1));
    const s = (t: number) => kit.sprites[`shield${t}`];
    expect(s(4).h / s(4).w).toBeCloseTo(1, 1);   // round
    expect(s(5).h / s(5).w).toBeGreaterThan(1.5);   // tall
  });

  it('names shields', () => {
    for (const bad of [undefined, 0, 11, 2.5]) expect(isShieldTier(bad)).toBe(false);
    expect(shieldName(3, kit.sets)).toBe('Parma · Padded Linen');
    expect(shieldName(8, kit.sets)).toBe('Scutum · Legion Plate');
    expect(shieldName(0, kit.sets)).toBe('—');
  });

  it('keeps the shield leaning with the body whatever the arm does', () => {
    const world = (pose: Pose) => forwardKinematics(kit.bones, holdShield(pose)).get('shield')!.r * 180 / Math.PI;
    const body = { pelvis: 2, torso: 6 };
    const arms: Pose[] = [{ arm_b_up: -18, arm_b_lo: 35 }, { arm_b_up: 78, arm_b_lo: 58, hand_b: 10 }, { arm_b_up: -46, arm_b_lo: 10 }];
    for (const arm of arms) {
      expect(world({ ...body, ...arm })).toBeCloseTo(8, 6);
      expect(world({ ...body, ...arm, shield: -5 })).toBeCloseTo(3, 6);
    }
  });

  it('raises the shield in front of the face when blocking', () => {
    const clip = ALL_CLIPS.find((c) => c.name === 'block@shield')!;
    expect(clip.events).toContainEqual({ f: 2, type: 'block' });
    const pose = sample(bake(clip, kit.pose_test), 2).pose;
    const J = forwardKinematics(kit.bones, holdShield(pose));
    const shield = J.get('shield')!, head = J.get('head')!, pelvis = J.get('pelvis')!;
    expect(shield.x - pelvis.x).toBeGreaterThan(1);   // ahead of the body, towards the enemy
    expect(Math.abs(shield.y - (head.y + 0.8))).toBeLessThan(1.5);   // around face height
  });

  it('draws a paired weapon a second time behind the back hand (#47)', () => {
    expect(kit.sprites.weapon_daggers.pair).toBe(true);
    expect(kit.sprites.weapon_sword5.pair).toBeUndefined();
    expect(kit.bones.find((b) => b.name === 'weapon_b')?.parent).toBe('hand_b');
    const at = (slot: string, bone: string) => kit.layers.findIndex((l) => l.slot === slot && l.bone === bone);
    expect(at('weapon_b', 'weapon_b')).toBeLessThan(at('body', 'hand_b'));
  });

  it('gives every trident its net for the back hand (#254)', () => {
    for (let t = 1; t <= 10; t++) expect(kit.sprites[`weapon_trident${t}`]?.offhand, `trident${t}`).toBe('weapon_net');
    expect(kit.sprites.weapon_net).toBeDefined();
    expect(kit.sprites.weapon_sword5.offhand).toBeUndefined();
  });
});

describe('the shield arm in front (#273)', () => {
  const at = (layers: KitJson['layers'], bone: string, slot: string) => layers.findIndex((l) => l.bone === bone && l.slot === slot);

  it('brings the whole shield arm, shoulder too, out in front of the body in full light, just under the shield', () => {
    const layers = shieldArmInFront(kit.layers);
    expect(layers).toHaveLength(kit.layers.length);
    const torso = at(layers, 'torso', 'body');
    const shield = at(layers, 'shield', 'shield');
    const arm = [['arm_b_lo', 'body'], ['arm_b_lo', 'armor'], ['arm_b_up', 'body'], ['arm_b_up', 'shoulders'], ['hand_b', 'body']]
      .map(([bone, slot]) => at(layers, bone, slot));
    expect(arm.every((i) => i > torso && i < shield)).toBe(true);
    expect(arm).toEqual([...arm].sort((a, b) => a - b));
    for (const i of arm) expect(layers[i].back).toBe(false);
    // the sword arm stays over the shield, the legs and the second dagger behind the body
    expect(at(layers, 'arm_f_up', 'body')).toBeGreaterThan(shield);
    expect(at(layers, 'weapon_b', 'weapon_b')).toBeLessThan(torso);
    // the kit's own order is untouched
    expect(at(kit.layers, 'arm_b_up', 'body')).toBeLessThan(at(kit.layers, 'torso', 'body'));
  });
});
