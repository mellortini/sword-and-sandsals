import type { Dialogue } from '../../core/dialogue';

/**
 * Old Hask in the tavern (docs/SCENARIUSZ.md 6.3): the drunk who says he is a Master of the Seventh Step, and the
 * trial that teaches Feint Step (#299 plays the trial itself; here only the talk and its flags).
 * Flags: `hask.trial` = 'accepted' | 'shown' (the easier trial), `hask.round` (the gladiator bought a round).
 */
export const OLD_HASK: Dialogue = {
  id: 'old-hask',
  start: 'offer',
  nodes: [
    {
      id: 'offer', speaker: 'Old Hask',
      lines: [
        'Master of the Seventh Step? Me? *hic* There\'s four of us left, boy, and the other three owe me money.',
        'Fight Gerro tomorrow. Don\'t step back. Not once. Step back, and you buy my drinks till winter.',
      ],
      choices: [
        { label: '“Deal.”', effects: [{ kind: 'flag', flag: 'hask.trial', value: 'accepted' }], next: 'deal' },
        {
          label: '“Show me first.”', check: { attribute: 'precision', difficulty: 7 },
          effects: [{ kind: 'flag', flag: 'hask.trial', value: 'shown' }], next: 'shown',
          failEffects: [{ kind: 'flag', flag: 'hask.trial', value: 'accepted' }], nextOnFail: 'spilled',
        },
        {
          label: '“Another round first. On me.”',
          requires: [{ kind: 'gold', min: 5 }, { kind: 'noFlag', flag: 'hask.round' }],
          effects: [{ kind: 'gold', amount: -5 }, { kind: 'flag', flag: 'hask.round' }, { kind: 'reputation', changes: { underworld: 2 } }],
          next: 'round',
        },
        {
          label: '“The Order sent me.”', requires: [{ kind: 'reputation', axis: 'order', min: 20 }],
          effects: [{ kind: 'flag', flag: 'hask.trial', value: 'accepted' }, { kind: 'reputation', changes: { order: 5 } }], next: 'order',
        },
      ],
    },
    {
      id: 'deal', speaker: 'Old Hask',
      lines: ['Ha! A cobbler\'s boy with spine. Tomorrow, then. Forward or nowhere.'],
    },
    {
      id: 'shown', speaker: 'Old Hask',
      lines: [
        '*He rises, sways, and his foot slides half a step to the side. The mug follows the foot. Most of the beer does not.*',
        'There. The step after the step they expect. Now you\'ve seen it — tomorrow you won\'t have to guess.',
      ],
    },
    {
      id: 'spilled', speaker: 'Old Hask',
      lines: [
        '*He rises, sways, and pours the whole mug down your shirt.*',
        'Hah. That was the step. You missed it. You\'ll see it tomorrow, from the sand.',
      ],
    },
    {
      id: 'round', speaker: 'Old Hask',
      lines: [
        'Now that\'s manners. Four of us, I said. Brann up in Kragmoor, Sefa out in the Red Sands, the Kindler somewhere he oughtn\'t be.',
        'And me. The best-looking one. Now — Gerro, tomorrow. Yes or no?',
      ],
      next: 'offer',
    },
    {
      id: 'order', speaker: 'Old Hask',
      lines: ['*He stops laughing.* Did they now. Then they still remember me. Tomorrow, boy. Don\'t make me look a fool to them.'],
    },
  ],
};
