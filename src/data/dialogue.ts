import type { League } from '../core/leagues';

interface ChampionDialogue {
  readonly before: readonly [string, string];
  readonly after: { readonly playerWon: string; readonly playerLost: string };
}

/** English lines for each Pulpport champion. After-bout lines use the player's result. */
export const CHAMPION_DIALOGUE = {
  bronze: {
    before: [
      'Pulpport has heard your name. Now show us what it is worth.',
      "The quay takes wagers in copper. The scribes take names in ink. Let's see who leaves with yours.",
    ],
    after: {
      playerWon: 'Tell the scribe to turn the page. You have earned a line of your own.',
      playerLost: 'I had to block twice. Come back when you can make me block three times.',
    },
  },
  silver: {
    before: [
      'A gate is only as strong as the one who holds it.',
      'I held the floodgate through three storms. You have until the bell.',
    ],
    after: {
      playerWon: 'Go on through. I know the sound a gate makes when it gives.',
      playerLost: 'The river never takes the same run at a gate twice. Learn from it.',
    },
  },
  gold: {
    before: [
      'The gold leaf comes off. The cut stays.',
      'The scribes charge extra for gilding. I charge nothing for taking it off.',
    ],
    after: {
      playerWon: 'They will weigh my leaf after this. Let them. You earned the blade underneath.',
      playerLost: 'Keep your gold. Spend a little of that patience next time.',
    },
  },
  champion: {
    before: [
      'Stand where you like. The floor remembers everyone.',
      'There is a dent under your left foot. Last champion stood there too.',
    ],
    after: {
      playerWon: 'Leave the dent. The next one should know where you stood.',
      playerLost: 'You watched the hammer. Next time, watch the hand that lets it fall.',
    },
  },
  legend: {
    before: [
      'I made the first crease. I have been undoing it ever since.',
      'A scribe can scrape a name off a page. The paper still remembers the pressure.',
    ],
    after: {
      playerWon: 'I remember my sister. She was never in the Codex. Take these first letters. Write the rest yourself.',
      playerLost: 'Before you come back, ask the scribes what they do with a page after they scrape it clean.',
    },
  },
} as const satisfies Readonly<Record<League, ChampionDialogue>>;
