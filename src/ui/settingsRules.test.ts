import { describe, expect, it } from 'vitest';
import { volumes } from '../audio/volume';
import { goreMode } from './gore';
import { paperShadows } from './graphics';
import { motionMode } from './motion';
import { SETTINGS, SLIDER_STEP } from './settingsRules';
import type { ChoiceRow, SliderRow } from './settingsRules';
import { textSizeIndex } from './textSize';

const row = <T extends ChoiceRow | SliderRow>(id: string) => SETTINGS.find((r) => r.id === id) as T;

describe('settings (#80)', () => {
  it('has every switch the game reads: text, gore, motion, shadows and the volumes', () => {
    expect(SETTINGS.map((r) => r.id)).toEqual(['text', 'gore', 'motion', 'shadows', 'volume-master', 'volume-foley', 'volume-crowd', 'volume-music', 'volume-voices']);
    for (const r of SETTINGS) expect(r.hint.length).toBeGreaterThan(5);
  });

  it('steps every choice through its values and back, changing the real setting', () => {
    const reads: Record<string, () => unknown> = { text: textSizeIndex, gore: goreMode, motion: motionMode, shadows: paperShadows };
    for (const id of Object.keys(reads)) {
      const r = row<ChoiceRow>(id);
      const shown = r.value(), real = reads[id]();
      r.step(1);
      expect(reads[id](), id).not.toEqual(real);
      expect(r.value(), id).not.toBe(shown);
      r.step(-1);
      expect(reads[id](), id).toEqual(real);
      expect(r.value(), id).toBe(shown);
    }
  });

  it('sets volumes in percent, clamped, saved for the mixer', () => {
    const r = row<SliderRow>('volume-crowd');
    r.set(35);
    expect(r.value()).toBe(35);
    expect(volumes().crowd).toBeCloseTo(0.35);
    r.set(140);
    expect(r.value()).toBe(100);
    r.set(-5);
    expect(r.value()).toBe(0);
    expect(SLIDER_STEP).toBe(5);
  });
});
