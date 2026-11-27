/**
 * Act 1 story scenes (#64): short paper dioramas between Pulpport's leagues, shown once, after each league champion
 * falls. Pictures by blender/story_act1.py (assets/story/act1_<shot>.jpg); the world is docs/FABULA.md.
 * A line may get a narrator's recording later (`voice`, a path under assets/); without one the line is read as a subtitle.
 */

export interface StoryShot {
  /** path under assets/ */
  readonly image: string;
  /** subtitles in order, one at a time */
  readonly lines: readonly string[];
  /** narration per line, same order (optional; missing = subtitle only) */
  readonly voice?: readonly (string | undefined)[];
  /** where the slow camera drift goes, as a fraction of the picture: [x, y], e.g. [0.03, -0.02] */
  readonly drift?: readonly [number, number];
}

export interface StoryScene {
  readonly id: string;
  /** the league bout whose win plays this scene (a champion, src/data/leagues.ts) */
  readonly after: string;
  readonly title: string;
  readonly shots: readonly StoryShot[];
}

export const ACT1: readonly StoryScene[] = [
  {
    id: 'act1-small-letters', after: 'bronze-champion', title: 'Small Letters',
    shots: [
      { image: 'story/act1_1a.jpg', drift: [0.0, -0.02], lines: [
        'Magpie glued your first win to his wall, between a drowned champion and a man who once fought a bear.',
        '“Fresh ink,” he said. “Try not to smudge.”',
      ] },
      { image: 'story/act1_1b.jpg', drift: [0.03, 0.0], lines: [
        'In the Chronicle, a clerk wrote you down. Small letters. Very small.',
        'But ink is ink. For the first time, somewhere, you exist.',
      ] },
    ],
  },
  {
    id: 'act1-the-erased', after: 'silver-champion', title: 'The Erased',
    shots: [
      { image: 'story/act1_2a.jpg', drift: [-0.02, 0.0], lines: [
        'That night, a gladiator you had beaten went pale as a fresh sheet.',
        'By morning, nobody in Pulpport remembered his name. Not even his mother.',
      ] },
      { image: 'story/act1_2b.jpg', drift: [0.0, 0.02], lines: [
        'Archcensor Redact’s seal. The Codex does not forget.',
        'It is told to.',
      ] },
    ],
  },
  {
    id: 'act1-under-the-counter', after: 'gold-champion', title: 'Under the Counter',
    shots: [
      { image: 'story/act1_3a.jpg', drift: [0.0, -0.02], lines: [
        'Mirra Inkwell showed you what she keeps under the counter.',
        'Fire. In a jar. Forbidden, illegal, and very, very warm.',
      ] },
      { image: 'story/act1_3b.jpg', drift: [0.0, 0.03], lines: [
        'Posters went up all over the port: the Kindler, a masked champion who fights with a burning blade.',
        'The reward for his capture: a name in the Codex. Big letters.',
      ] },
    ],
  },
  {
    id: 'act1-the-kindler', after: 'champion-of-pulpport', title: 'The Kindler',
    shots: [
      { image: 'story/act1_4a.jpg', drift: [0.02, 0.0], lines: [
        'He came to the arena after dark and lit his blade where everyone could see it.',
        'Nobody called the guards.',
      ] },
      { image: 'story/act1_4b.jpg', drift: [0.0, -0.02], lines: [
        '“They erase us one by one,” he said. “Win the Grand Arena, Blank.”',
        '“Then rewrite the right sentence.”',
      ] },
    ],
  },
  {
    id: 'act1-folio-calls', after: 'legend-champion', title: 'Folio Calls',
    shots: [
      { image: 'story/act1_5a.jpg', drift: [0.0, 0.02], lines: [
        'An invitation, sealed with the Codex itself.',
        'The capital wants to see the Blank who would not stay blank.',
      ] },
      { image: 'story/act1_5b.jpg', drift: [-0.03, 0.0], lines: [
        'You sailed for Folio at dawn. Behind you, Pulpport.',
        'Ahead of you, bigger letters.',
      ] },
    ],
  },
];

/** the scene a league win unlocks, if any */
export function sceneAfter(boutId: string): StoryScene | undefined {
  return ACT1.find((s) => s.after === boutId);
}

/** seconds a subtitle stays when there is no recording: about the pace of a narrator, never rushed */
export function readingTime(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(7, Math.max(2.4, 0.9 + words * 0.36));
}
