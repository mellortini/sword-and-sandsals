import { describe, expect, it } from 'vitest';
import kitJson from '../../assets/chars/kit/kit.json';
import { ALL_CLIPS } from '../anim/clips';
import { bake, sample } from '../anim/clip';
import type { KitJson, Pose } from './PaperRig';
import { ROUND_TIERS, SHIELD_TIERS, holdShield, isShieldTier, quarterTurn, shieldName, shieldShape, turnedLayers } from './shield';
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

describe('the quarter turn of every fighter (#273, #280)', () => {
  const at = (layers: KitJson['layers'], bone: string, slot: string) => layers.findIndex((l) => l.bone === bone && l.slot === slot);

  it('draws the weapon shoulder behind the chest, the elbow in front, and the near arm with its shield on top', () => {
    const layers = turnedLayers(kit.layers);
    expect(layers).toHaveLength(kit.layers.length);
    const torso = at(layers, 'torso', 'body');
    const helmet = at(layers, 'head', 'helmet');
    const shield = at(layers, 'shield', 'shield');
    expect(shield).toBe(layers.length - 1);
    // weapon shoulder and upper arm behind the chest, shaded like a far arm
    for (const [bone, slot] of [['arm_f_up', 'body'], ['arm_f_up', 'shoulders']]) {
      const i = at(layers, bone, slot);
      expect(i, `${bone} ${slot}`).toBeLessThan(torso);
      expect(layers[i].back).toBe(true);
    }
    // the weapon forearm (the elbow), the blade and the hand in front of the chest and head, under the near arm
    const nearArm = at(layers, 'arm_b_lo', 'body');
    for (const [bone, slot] of [['arm_f_lo', 'body'], ['weapon', 'weapon'], ['hand_f', 'body']]) {
      const i = at(layers, bone, slot);
      expect(i, `${bone} ${slot}`).toBeGreaterThan(helmet);
      expect(i, `${bone} ${slot}`).toBeLessThan(nearArm);
    }
    // the whole near arm in full light, forearm to hand, with the second dagger / net in the hand, then the shield;
    // the torn halves of a cut arm (#332) sit around each part's own paper: the white rim under it, the red crepe over it
    const order = [['arm_b_lo', 'stump_rim'], ['arm_b_lo', 'body'], ['arm_b_lo', 'wound'], ['arm_b_lo', 'armor'], ['arm_b_lo', 'stump'],
      ['arm_b_up', 'stump_rim'], ['arm_b_up', 'body'], ['arm_b_up', 'wound'], ['arm_b_up', 'stump'],
      ['arm_b_up', 'shoulders'], ['weapon_b', 'weapon_b'], ['hand_b', 'body']]
      .map(([bone, slot]) => at(layers, bone, slot));
    expect(order).toEqual(order.map((_, i) => shield - order.length + i));
    for (const i of order) expect(layers[i].back).toBe(false);
    // the kit's own order is untouched
    expect(at(kit.layers, 'arm_b_up', 'body')).toBeLessThan(at(kit.layers, 'torso', 'body'));
  });

  it('turns both shoulders towards the middle of the chest', () => {
    const pose = quarterTurn({});
    expect(pose.arm_b_shift).toBeGreaterThan(0);
    expect(pose.arm_f_shift).toBeLessThan(0);
    expect(holdShield({}).arm_b_shift).toBeUndefined();
  });
});
