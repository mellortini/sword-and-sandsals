/**
 * The settings screen (#80), as data: every row reads and changes one saved setting. Choices step left / right
 * (wrapping), volumes are sliders 0..100 %. The screen (src/ui/settings.ts) only draws these rows.
 */
import { CHANNELS, musicOff, setMusicOff, setVolume, volumes } from '../audio/volume';
import type { Channel } from '../audio/volume';
import { GORE_MODES, goreMode, setGoreMode } from './gore';
import { paperShadows, setPaperShadows } from './graphics';
import { MOTION_MODES, motionMode, setMotionMode } from './motion';
import { TEXT_SIZES, cycleTextSize, textSizeIndex } from './textSize';

export interface ChoiceRow {
  readonly kind: 'choice';
  readonly id: string;
  readonly label: string;
  /** what the row says now */
  readonly value: () => string;
  /** -1 / +1: the previous / next choice, saved at once */
  readonly step: (dir: 1 | -1) => void;
  readonly hint: string;
}

export interface SliderRow {
  readonly kind: 'slider';
  readonly id: string;
  readonly label: string;
  /** 0..100 */
  readonly value: () => number;
  readonly set: (percent: number) => void;
  readonly hint: string;
}

export type SettingRow = ChoiceRow | SliderRow;

function cycle<T extends { id: string }>(list: readonly T[], now: string, dir: 1 | -1): T {
  const i = list.findIndex((x) => x.id === now);
  return list[(i + dir + list.length) % list.length];
}

const VOLUME_NAMES: Readonly<Record<Channel, string>> = { master: 'Volume', foley: 'Fight sounds', crowd: 'Crowd', music: 'Music volume', voices: 'Voices' };
const VOLUME_HINTS: Readonly<Record<Channel, string>> = {
  master: 'Everything you hear', foley: 'Blows, steps, blocks', crowd: 'The stands', music: 'The arena and town themes', voices: 'The narrator of the story',
};

export const SETTINGS: readonly SettingRow[] = [
  {
    kind: 'choice', id: 'text', label: 'Text size', hint: 'Menus, panels and the fight HUD',
    value: () => TEXT_SIZES[textSizeIndex()].name, step: (dir) => { cycleTextSize(dir); },
  },
  {
    kind: 'choice', id: 'gore', label: 'Gore', hint: 'How a finishing blow tears the paper',
    value: () => GORE_MODES.find((m) => m.id === goreMode())!.name, step: (dir) => setGoreMode(cycle(GORE_MODES, goreMode(), dir).id),
  },
  {
    kind: 'choice', id: 'motion', label: 'Motion', hint: 'Reduced: no camera zoom, shake or drift',
    value: () => MOTION_MODES.find((m) => m.id === motionMode())!.name, step: (dir) => setMotionMode(cycle(MOTION_MODES, motionMode(), dir).id),
  },
  {
    kind: 'choice', id: 'shadows', label: 'Paper shadows', hint: 'Soft shadows under the puppets (off is faster)',
    value: () => (paperShadows() ? 'On' : 'Off'), step: () => setPaperShadows(!paperShadows()),
  },
  {
    kind: 'choice', id: 'music', label: 'Music', hint: 'The arena and town themes, on or off',
    value: () => (musicOff() ? 'Off' : 'On'), step: () => setMusicOff(!musicOff()),
  },
  ...CHANNELS.map((c): SliderRow => ({
    kind: 'slider', id: `volume-${c}`, label: VOLUME_NAMES[c], hint: VOLUME_HINTS[c],
    value: () => Math.round(volumes()[c] * 100), set: (percent) => setVolume(c, Math.min(100, Math.max(0, percent)) / 100),
  })),
];

/** a slider moves in steps of 5 % with the arrow keys */
export const SLIDER_STEP = 5;
