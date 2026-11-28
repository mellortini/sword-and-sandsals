import type { AiProfile } from '../core/ai';
import type { League } from '../core/leagues';
import type { Attributes, FighterSetup } from '../core/types';
import type { Look } from '../rig/PaperRig';
import { CHAMPION_DIALOGUE } from './dialogue';
import { weapon } from './weapons';
import type { Weapon, WeaponFamily } from './weapons';

export interface PulpportBout {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly profile: AiProfile;
  readonly setup: FighterSetup;
  readonly appearance: Pick<Look, 'skin' | 'face' | 'hair' | 'hairColor' | 'beard'>;
  readonly champion?: { readonly line: string; readonly weapon: Weapon };
}

function contender(
  id: string, name: string, level: number, profile: AiProfile, face: number,
  attributes: FighterSetup['attributes'], equipment: FighterSetup['equipment'],
): PulpportBout {
  return {
    id, name, level, profile, setup: { name, level, attributes, equipment },
    appearance: { skin: (face + 3) % 10, face, hair: (face + 4) % 10, hairColor: face % 4, beard: face % 3 },
  };
}

const championBlade = weapon('sword', 3);
if (!championBlade) throw new Error('Bronze champion requires the tier-three catalogue sword.');

export const PULPPORT_CHAMPION_WEAPON: Weapon = {
  ...championBlade, id: 'pulpport-laureate', name: 'Pulpport Laureate', damage: 10, minMight: 3,
};

export const PULPPORT_BRONZE: readonly PulpportBout[] = [
  contender('quay-rookie', 'Decima of the Quay', 1, 'aggressor', 1, { might: 4, guard: 3, vitality: 4 }, { armor: 1, weapon: 'sword1' }),
  contender('reed-gate', 'Tullia of the Reed Gate', 2, 'defender', 2, { guard: 7, stamina: 4 }, { helmet: 1, armor: 1, weapon: 'sword1' }),
  contender('ropewalker', 'Lucan the Ropewalker', 2, 'aggressor', 3, { agility: 8, precision: 6 }, { boots: 2, greaves: 1, weapon: 'sword2' }),
  contender('inkhand', 'Cassia Inkhand', 3, 'defender', 4, { guard: 8, precision: 6 }, { helmet: 2, armor: 1, shoulders: 1, weapon: 'sword2' }),
  contender('lamplighter', 'Drusa the Lamplighter', 3, 'aggressor', 6, { might: 8, stamina: 7 }, { armor: 2, shoulders: 2, boots: 1, weapon: 'sword2' }),
  {
    ...contender('bronze-champion', 'Varro the Gilded', 4, 'defender', 8, { might: 7, guard: 8, vitality: 7 },
      { helmet: 2, armor: 2, shoulders: 2, greaves: 2, boots: 2, weapon: 'sword3' }),
    champion: { line: CHAMPION_DIALOGUE.bronze.before[0], weapon: PULPPORT_CHAMPION_WEAPON },
  },
];

export function nextPulpportBronzeBout(defeated: readonly string[]): PulpportBout | undefined {
  const wins = new Set(defeated);
  return PULPPORT_BRONZE.find(({ id }) => !wins.has(id));
}

interface ContenderSpec {
  id: string;
  name: string;
  level: number;
  profile: AiProfile;
  face: number;
  tier: number;
  family: WeaponFamily;
  strengths: Partial<Attributes>;
}

function leagueContender(spec: ContenderSpec, completeSet = false): PulpportBout {
  const { id, name, level, profile, face, tier, family, strengths } = spec;
  const blade = weapon(family, tier);
  if (!blade) throw new Error(`Missing ${family} tier ${tier} for ${id}.`);
  const base = 5 + Math.floor((level - 1) / 4);
  const edge = (key: keyof Attributes) => base + (strengths[key] ?? 0);
  return contender(id, name, level, profile, face, {
    might: Math.max(blade.minMight, edge('might')), agility: edge('agility'), precision: edge('precision'),
    guard: edge('guard'), vitality: edge('vitality'), stamina: edge('stamina'), charm: edge('charm'), arcana: edge('arcana'),
  }, {
    helmet: tier, armor: tier, shoulders: tier, greaves: tier, boots: completeSet ? tier : tier - 1, weapon: blade.id,
  });
}

function leagueChampion(spec: ContenderSpec, id: string, name: string, line: string): PulpportBout {
  const bout = leagueContender(spec, true);
  const base = weapon(spec.family, spec.tier);
  if (!base) throw new Error(`Missing champion weapon for ${spec.id}.`);
  return { ...bout, champion: { line, weapon: { ...base, id, name, damage: base.damage + 2 + Math.floor(base.tier / 3) } } };
}

export const PULPPORT_SILVER: readonly PulpportBout[] = [
  leagueContender({ id: 'silver-bell', name: 'Aelia Bellhand', level: 5, profile: 'defender', face: 0, tier: 3, family: 'sword', strengths: { guard: 2 } }),
  leagueContender({ id: 'silver-cleaver', name: 'Cato the Laminate', level: 6, profile: 'aggressor', face: 1, tier: 3, family: 'axe', strengths: { might: 2 } }),
  leagueContender({ id: 'silver-windlass', name: 'Sabina Windlass', level: 7, profile: 'defender', face: 2, tier: 4, family: 'spear', strengths: { precision: 2 } }),
  leagueContender({ id: 'silver-press', name: 'Marcellus of the Press', level: 8, profile: 'aggressor', face: 3, tier: 4, family: 'hammer', strengths: { stamina: 2 } }),
  leagueContender({ id: 'silver-sash', name: 'Tullia Silver Sash', level: 9, profile: 'aggressor', face: 4, tier: 4, family: 'trident', strengths: { agility: 2 } }),
  leagueChampion({
    id: 'silver-champion', name: 'Livia of the Floodgate', level: 10, profile: 'defender', face: 5, tier: 4, family: 'spear',
    strengths: { guard: 3, precision: 2, vitality: 4 },
  }, 'floodgate-standard', 'Floodgate Standard', CHAMPION_DIALOGUE.silver.before[0]),
];

export const PULPPORT_GOLD: readonly PulpportBout[] = [
  leagueContender({ id: 'gold-ledge', name: 'Drusa of the Ledge', level: 11, profile: 'defender', face: 6, tier: 5, family: 'spear', strengths: { guard: 3 } }),
  leagueContender({ id: 'gold-fold', name: 'Corvin Double Fold', level: 12, profile: 'aggressor', face: 7, tier: 5, family: 'sword', strengths: { agility: 2, precision: 1 } }),
  leagueContender({ id: 'gold-stamp', name: 'Decima Sealbreaker', level: 13, profile: 'aggressor', face: 8, tier: 6, family: 'hammer', strengths: { stamina: 3 } }),
  leagueContender({ id: 'gold-copper', name: 'Vesper Copperline', level: 14, profile: 'defender', face: 9, tier: 6, family: 'spear', strengths: { precision: 3 } }),
  leagueContender({ id: 'gold-ink', name: 'Lucan Wet Ink', level: 15, profile: 'aggressor', face: 0, tier: 6, family: 'axe', strengths: { might: 3 } }),
  leagueChampion({
    id: 'gold-champion', name: 'Aurelia Giltbrand', level: 16, profile: 'aggressor', face: 1, tier: 6, family: 'axe',
    strengths: { might: 5, stamina: 3, vitality: 4 },
  }, 'giltbrand-cleaver', 'Giltbrand Cleaver', CHAMPION_DIALOGUE.gold.before[0]),
];

export const PULPPORT_CHAMPION: readonly PulpportBout[] = [
  leagueContender({ id: 'champion-lantern', name: 'Cassia of the Lantern', level: 17, profile: 'defender', face: 2, tier: 7, family: 'sword', strengths: { guard: 3 } }),
  leagueContender({ id: 'champion-plank', name: 'Fabius Plankstep', level: 18, profile: 'aggressor', face: 3, tier: 7, family: 'axe', strengths: { agility: 2, might: 2 } }),
  leagueContender({ id: 'champion-arch', name: 'Flavia Underarch', level: 19, profile: 'defender', face: 4, tier: 7, family: 'spear', strengths: { precision: 3 } }),
  leagueContender({ id: 'champion-vice', name: 'Cato the Vice', level: 20, profile: 'aggressor', face: 5, tier: 8, family: 'hammer', strengths: { stamina: 3 } }),
  leagueContender({ id: 'champion-margin', name: 'Sabina Red Margin', level: 21, profile: 'aggressor', face: 6, tier: 8, family: 'sword', strengths: { precision: 3, vitality: 2 } }),
  leagueChampion({
    id: 'champion-of-pulpport', name: 'Marcia of the Anvil', level: 22, profile: 'defender', face: 7, tier: 8, family: 'hammer',
    strengths: { guard: 4, vitality: 6, stamina: 3 },
  }, 'last-impression', 'Last Impression', CHAMPION_DIALOGUE.champion.before[0]),
];

export const PULPPORT_LEGEND: readonly PulpportBout[] = [
  leagueContender({ id: 'legend-watermark', name: 'Aelia Watermark', level: 23, profile: 'defender', face: 8, tier: 8, family: 'spear', strengths: { guard: 3, precision: 2 } }),
  leagueContender({ id: 'legend-jagged', name: 'Corvin Jagged Spine', level: 25, profile: 'aggressor', face: 9, tier: 9, family: 'axe', strengths: { might: 4 } }),
  leagueContender({ id: 'legend-vellum', name: 'Tullia Vellum', level: 26, profile: 'defender', face: 0, tier: 9, family: 'sword', strengths: { guard: 4, agility: 2 } }),
  leagueContender({ id: 'legend-rivet', name: 'Marcellus Ten Rivets', level: 27, profile: 'aggressor', face: 1, tier: 9, family: 'hammer', strengths: { stamina: 4, vitality: 2 } }),
  leagueContender({ id: 'legend-rain', name: 'Vesper of the Last Rain', level: 30, profile: 'defender', face: 2, tier: 10, family: 'spear', strengths: { precision: 4, vitality: 3 } }),
  leagueChampion({
    id: 'legend-champion', name: 'Quintus the First Fold', level: 32, profile: 'aggressor', face: 3, tier: 10, family: 'sword',
    strengths: { might: 8, precision: 5, vitality: 7, stamina: 4 },
  }, 'first-fold', 'First Fold', CHAMPION_DIALOGUE.legend.before[0]),
];

export const PULPPORT_LEAGUES: Readonly<Record<League, readonly PulpportBout[]>> = {
  bronze: PULPPORT_BRONZE, silver: PULPPORT_SILVER, gold: PULPPORT_GOLD,
  champion: PULPPORT_CHAMPION, legend: PULPPORT_LEGEND,
};
