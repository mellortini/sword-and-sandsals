/**
 * Dialogues with choices (#292, docs/SCENARIUSZ.md 5.11): trees of lines as data (src/data/dialogues), choices with
 * requirements, a check with a visible chance (a failure leads on too) and effects on the save. Pure: the screen
 * (src/ui/dialogue.ts) shows a node, asks `choiceOptions` what can be picked and applies `choose`.
 *
 * Wards (#301), loyalty and the Book of Duels (#293) do not exist yet: their requirements and effects live in story
 * flags (`ward.<id>`, `loyalty.<id>`, `book.<entry>`) until those modules take them over.
 */
import type { SavedCharacter } from './save';
import { changeReputation, flagOf, setFlag, storyOf } from './story';
import type { FlagValue, Reputation, ReputationAxis } from './story';
import type { Attributes } from './types';

export type Attribute = keyof Attributes;

export type Condition =
  | { readonly kind: 'attribute'; readonly attribute: Attribute; readonly min: number }
  | { readonly kind: 'reputation'; readonly axis: ReputationAxis; readonly min?: number; readonly max?: number }
  /** the flag is set (to `equals`, or to anything but `false` without it) */
  | { readonly kind: 'flag'; readonly flag: string; readonly equals?: FlagValue }
  | { readonly kind: 'noFlag'; readonly flag: string }
  | { readonly kind: 'gold'; readonly min: number }
  | { readonly kind: 'item'; readonly item: string; readonly name: string }
  /** a ward is in the ludus (flag `ward.<id>` until #301) */
  | { readonly kind: 'ward'; readonly ward: string; readonly name: string };

export type Effect =
  | { readonly kind: 'flag'; readonly flag: string; readonly value?: FlagValue }
  | { readonly kind: 'reputation'; readonly changes: Partial<Reputation> }
  /** gold paid (negative) or received; never below 0 */
  | { readonly kind: 'gold'; readonly amount: number }
  | { readonly kind: 'item'; readonly item: string }
  /** a recruit joins the ludus (flag `ward.<id>` until #301) */
  | { readonly kind: 'recruit'; readonly ward: string }
  /** a ward's loyalty changes (flag `loyalty.<id>` until #301) */
  | { readonly kind: 'loyalty'; readonly ward: string; readonly amount: number }
  /** an entry in the Book of Duels (flag `book.<entry>` until #293) */
  | { readonly kind: 'duelBook'; readonly entry: string; readonly value: number };

/** a check against an attribute: the chance is shown on the button before the choice */
export interface Check {
  readonly attribute: Attribute;
  readonly difficulty: number;
}

export interface Choice {
  readonly label: string;
  readonly requires?: readonly Condition[];
  readonly check?: Check;
  /** applied when chosen (with a check: when it succeeds) */
  readonly effects?: readonly Effect[];
  /** applied when the check fails */
  readonly failEffects?: readonly Effect[];
  /** node after the choice (with a check: after a success); none = the dialogue ends */
  readonly next?: string;
  /** node after a failed check; none = `next` */
  readonly nextOnFail?: string;
}

export interface DialogueNode {
  readonly id: string;
  readonly speaker: string;
  readonly lines: readonly string[];
  readonly choices?: readonly Choice[];
  /** the node after this one when it has no choices; none = the dialogue ends */
  readonly next?: string;
}

export interface Dialogue {
  readonly id: string;
  readonly start: string;
  readonly nodes: readonly DialogueNode[];
}

const ATTRIBUTE_NAME: Readonly<Record<Attribute, string>> = {
  might: 'Might', agility: 'Agility', precision: 'Precision', guard: 'Guard',
  vitality: 'Vitality', stamina: 'Stamina', charm: 'Charm', arcana: 'Arcana',
};
const AXIS_NAME: Readonly<Record<ReputationAxis, string>> = { fame: 'Fame', order: 'Order', guild: 'Guild', underworld: 'Underworld' };

export const findNode = (dialogue: Dialogue, id: string) => dialogue.nodes.find((n) => n.id === id);

/** the gear the gladiator owns: worn in the hands or carried */
const owns = (c: SavedCharacter, item: string) => c.inventory.includes(item) || c.hands?.weapon === item || c.hands?.offHand === item;

export function meets(character: SavedCharacter, condition: Condition): boolean {
  const story = storyOf(character);
  switch (condition.kind) {
    case 'attribute': return character.attributes[condition.attribute] >= condition.min;
    case 'reputation': {
      const value = story.reputation[condition.axis];
      return value >= (condition.min ?? -Infinity) && value <= (condition.max ?? Infinity);
    }
    case 'flag': {
      const value = flagOf(story, condition.flag);
      return condition.equals === undefined ? value !== undefined && value !== false : value === condition.equals;
    }
    case 'noFlag': {
      const value = flagOf(story, condition.flag);
      return value === undefined || value === false;
    }
    case 'gold': return character.gold >= condition.min;
    case 'item': return owns(character, condition.item);
    case 'ward': return flagOf(story, `ward.${condition.ward}`) === true;
  }
}

/** how a requirement reads on a button, as in the script: `Charm 8`, `Order ≥ 20`, `Sorrel in ludus` */
export function conditionLabel(condition: Condition): string {
  switch (condition.kind) {
    case 'attribute': return `${ATTRIBUTE_NAME[condition.attribute]} ${condition.min}`;
    case 'reputation': {
      const axis = AXIS_NAME[condition.axis];
      if (condition.min !== undefined && condition.max !== undefined) return `${axis} ${condition.min}–${condition.max}`;
      return condition.max !== undefined ? `${axis} ≤ ${condition.max}` : `${axis} ≥ ${condition.min ?? 0}`;
    }
    case 'flag':
    case 'noFlag': return condition.flag;
    case 'gold': return `${condition.min} gold`;
    case 'item': return condition.name;
    case 'ward': return `${condition.name} in ludus`;
  }
}

/** points of chance per point of the attribute over (or under) the difficulty */
export const CHECK_STEP = 8;

/** Chance (percent, 5–95) that a check succeeds: 50% when the attribute equals the difficulty. */
export function checkChance(character: SavedCharacter, check: Check): number {
  const chance = 50 + CHECK_STEP * (character.attributes[check.attribute] - check.difficulty);
  return Math.max(5, Math.min(95, chance));
}

export interface ChoiceOption {
  readonly index: number;
  readonly choice: Choice;
  readonly available: boolean;
  /** the requirements not met, as their labels (greyed out on the button) */
  readonly unmet: readonly string[];
  /** with a check: its chance in percent */
  readonly chance?: number;
  /** the button's tag: `[Charm 8]`, `[Precision 62%]` */
  readonly tag?: string;
}

/** Every choice of a node, with whether it can be picked, what it lacks and the chance of its check. */
export function choiceOptions(character: SavedCharacter, node: DialogueNode): ChoiceOption[] {
  return (node.choices ?? []).map((choice, index) => {
    const unmet = (choice.requires ?? []).filter((c) => !meets(character, c)).map(conditionLabel);
    const chance = choice.check ? checkChance(character, choice.check) : undefined;
    const tags = [
      ...(choice.requires ?? []).filter((c) => c.kind !== 'flag' && c.kind !== 'noFlag').map(conditionLabel),
      ...(choice.check ? [`${ATTRIBUTE_NAME[choice.check.attribute]} ${chance}%`] : []),
    ];
    return { index, choice, available: unmet.length === 0, unmet, ...(chance !== undefined && { chance }), ...(tags.length && { tag: `[${tags.join(', ')}]` }) };
  });
}

/** The save after the effects. */
export function applyEffects(character: SavedCharacter, effects: readonly Effect[] = []): SavedCharacter {
  let c = character;
  const before = storyOf(c);
  let story = before;
  for (const e of effects) {
    switch (e.kind) {
      case 'flag': story = setFlag(story, e.flag, e.value ?? true); break;
      case 'reputation': story = changeReputation(story, e.changes); break;
      case 'gold': c = { ...c, gold: Math.max(0, c.gold + e.amount) }; break;
      case 'item': c = { ...c, inventory: [...c.inventory, e.item] }; break;
      case 'recruit': story = setFlag(story, `ward.${e.ward}`, true); break;
      case 'loyalty': {
        const now = flagOf(story, `loyalty.${e.ward}`);
        story = setFlag(story, `loyalty.${e.ward}`, (typeof now === 'number' ? now : 0) + e.amount);
        break;
      }
      case 'duelBook': story = setFlag(story, `book.${e.entry}`, e.value); break;
    }
  }
  return story === before && c === character ? character : { ...c, story };
}

export type ChooseResult =
  | { ok: true; character: SavedCharacter; next?: string; success?: boolean; chance?: number }
  | { ok: false; character: SavedCharacter; reason: 'unknown-node' | 'unknown-choice' | 'unavailable' };

/**
 * Take a choice of a node. `roll` is a number in [0, 1) (the screen passes Math.random()); a check succeeds when
 * `roll × 100` is under its chance. The effects of the outcome are applied; `next` is the node that follows.
 */
export function choose(character: SavedCharacter, dialogue: Dialogue, nodeId: string, index: number, roll: number): ChooseResult {
  const node = findNode(dialogue, nodeId);
  if (!node) return { ok: false, character, reason: 'unknown-node' };
  const option = choiceOptions(character, node)[index];
  if (!option) return { ok: false, character, reason: 'unknown-choice' };
  if (!option.available) return { ok: false, character, reason: 'unavailable' };
  const { choice } = option;
  if (!choice.check) return { ok: true, character: applyEffects(character, choice.effects), next: choice.next };
  const success = roll * 100 < option.chance!;
  return {
    ok: true, success, chance: option.chance,
    character: applyEffects(character, success ? choice.effects : choice.failEffects),
    next: success ? choice.next : (choice.nextOnFail ?? choice.next),
  };
}

/** Problems in a dialogue's data: a missing start, links to nodes that do not exist, duplicate node ids. */
export function dialogueProblems(dialogue: Dialogue): string[] {
  const ids = new Set<string>();
  const problems: string[] = [];
  for (const n of dialogue.nodes) {
    if (ids.has(n.id)) problems.push(`duplicate node ${n.id}`);
    ids.add(n.id);
  }
  if (!ids.has(dialogue.start)) problems.push(`missing start ${dialogue.start}`);
  for (const n of dialogue.nodes) {
    if (!n.lines.length) problems.push(`${n.id} has no lines`);
    for (const target of [n.next, ...(n.choices ?? []).flatMap((c) => [c.next, c.nextOnFail])]) {
      if (target !== undefined && !ids.has(target)) problems.push(`${n.id} leads to missing ${target}`);
    }
  }
  return problems;
}
