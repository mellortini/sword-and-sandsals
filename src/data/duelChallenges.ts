/**
 * The challenges of the Book of Duels (#293, docs/SCENARIUSZ.md 5.1): a won bout that meets one is signed into the
 * book once, worth 1-5, by its witness. Rules for `met` read the bout's tally (`core/duelBook.ts`).
 */
import type { DuelBout } from '../core/duelBook';

export interface DuelChallenge {
  readonly id: string;
  readonly title: string;
  /** the condition in plain words, for the book */
  readonly goal: string;
  readonly value: number;
  readonly witness: string;
  readonly met: (bout: DuelBout) => boolean;
}

const HERALD = 'Łukasz the Herald';
const MAGPIE = 'Magpie';
const JUDGES = 'the Brackwater judges';

/** in the order the book lists them */
export const DUEL_CHALLENGES: readonly DuelChallenge[] = [
  { id: 'sword', title: 'The Plain Blade', goal: 'Win with a sword.', value: 1, witness: HERALD, met: (b) => b.weapon === 'sword' },
  { id: 'spear', title: 'Long Reach', goal: 'Win with a spear.', value: 2, witness: HERALD, met: (b) => b.weapon === 'spear' },
  { id: 'axe', title: 'The Woodcutter', goal: 'Win with an axe.', value: 2, witness: HERALD, met: (b) => b.weapon === 'axe' },
  { id: 'hammer', title: 'Anvil Hands', goal: 'Win with a hammer.', value: 2, witness: HERALD, met: (b) => b.weapon === 'hammer' },
  { id: 'daggers', title: 'Two Bites', goal: 'Win with two daggers.', value: 2, witness: HERALD, met: (b) => b.weapon === 'daggers' },
  { id: 'trident', title: 'The Fisherman', goal: 'Win with a trident.', value: 2, witness: HERALD, met: (b) => b.weapon === 'trident' },
  { id: 'unarmoured', title: 'Bare Skin', goal: 'Win without any armour.', value: 3, witness: MAGPIE, met: (b) => b.unarmoured },
  { id: 'no-step-back', title: 'Not One Step Back', goal: 'Win without stepping back.', value: 2, witness: JUDGES, met: (b) => !b.steppedBack },
  { id: 'no-block', title: 'Open Guard', goal: 'Win without blocking.', value: 1, witness: JUDGES, met: (b) => !b.blocked },
  { id: 'no-rest', title: 'No Breath Taken', goal: 'Win without resting.', value: 1, witness: JUDGES, met: (b) => !b.rested },
  { id: 'untouched', title: 'Untouched', goal: 'Win without losing any health.', value: 4, witness: MAGPIE, met: (b) => b.healthLost === 0 },
  { id: 'last-breath', title: 'On the Last Breath', goal: 'Win with a tenth of your health or less.', value: 3, witness: HERALD, met: (b) => b.healthLeft <= 0.1 },
  { id: 'quick-work', title: 'Short Work', goal: 'Win in six actions or fewer.', value: 2, witness: HERALD, met: (b) => b.turns <= 6 },
  { id: 'seventh-step', title: 'The Seventh Step', goal: 'Strike on the Seventh Step and win.', value: 2, witness: MAGPIE, met: (b) => b.seventhStep },
  { id: 'crowd', title: 'Darling of the Stands', goal: 'Win with the crowd’s favour at 90 or more.', value: 2, witness: HERALD, met: (b) => b.favour >= 90 },
  { id: 'net', title: 'Caught in the Net', goal: 'Catch the opponent in a net and win.', value: 2, witness: JUDGES, met: (b) => b.netCaught },
  { id: 'counter', title: 'The Answer', goal: 'Land a counter-attack and win.', value: 1, witness: JUDGES, met: (b) => b.counterLanded },
  { id: 'head-crit', title: 'Crack the Helm', goal: 'Land a critical blow to the head and win.', value: 2, witness: JUDGES, met: (b) => b.headCrit },
  { id: 'giant-slayer', title: 'Giant Slayer', goal: 'Beat an opponent three or more levels above you.', value: 3, witness: HERALD, met: (b) => b.levelGap >= 3 },
  { id: 'technique', title: 'The Masters’ Way', goal: 'Use a Master’s technique and win.', value: 2, witness: MAGPIE, met: (b) => b.technique },
  { id: 'showman', title: 'The Showman', goal: 'Taunt three times and win.', value: 1, witness: HERALD, met: (b) => b.taunts >= 3 },
  { id: 'broken-shield', title: 'Shield in Splinters', goal: 'Win after your shield broke.', value: 3, witness: MAGPIE, met: (b) => b.shieldBroken },
  { id: 'severed', title: 'Off at the Elbow', goal: 'Take off the opponent’s shield arm and win.', value: 3, witness: JUDGES, met: (b) => b.severed },
  { id: 'power-finish', title: 'The Heavy End', goal: 'Finish the bout with a power blow.', value: 1, witness: HERALD, met: (b) => b.powerFinish },
  { id: 'champion', title: 'Champion Slayer', goal: 'Beat a league champion.', value: 3, witness: HERALD, met: (b) => b.champion },
];

export const findChallenge = (id: string) => DUEL_CHALLENGES.find((c) => c.id === id);
