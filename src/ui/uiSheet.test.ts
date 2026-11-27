import { describe, expect, it } from 'vitest';
import meta from '../../assets/ui/ui.json';
import { ACTION_GROUPS } from './actionBar';
import { frameCss, frameFill } from './uiSheet';

describe('paper UI kit sheet (#16)', () => {
  it('has a badge for every combat action and for items', () => {
    for (const a of [...ACTION_GROUPS.flatMap((g) => g.actions), 'item']) expect(meta.frames).toHaveProperty(`icon_${a}`);
  });

  it('has the flask parts in one frame and liquid rows inside it', () => {
    const f = meta.frames;
    for (const k of ['flask_liquid_hp', 'flask_liquid_en', 'flask_front'] as const) {
      expect([f[k].w, f[k].h]).toEqual([f.flask_back.w, f.flask_back.h]);
    }
    for (const k of ['flask_liquid_hp', 'flask_liquid_en'] as const) {
      const fill = meta.fill[k];
      expect(fill.top).toBeGreaterThan(0);
      expect(fill.bottom).toBeGreaterThan(fill.top);
      expect(fill.bottom).toBeLessThanOrEqual(f[k].h);
    }
    expect(f.scroll_top.w).toBe(f.scroll_body.w);
    expect(f.scroll_bottom.w).toBe(f.scroll_body.w);
  });

  it('frameCss scales the whole sheet so one frame fills the element', () => {
    const css = frameCss({ url: 'ui.png', width: 1000, height: 500, frames: { a: { x: 100, y: 50, w: 200, h: 100 } } }, 'a', 50);
    expect(css).toEqual({
      width: '50px', height: '25px', backgroundImage: 'url("ui.png")',
      backgroundSize: '250px 125px', backgroundPosition: '-25px -12.5px', backgroundRepeat: 'no-repeat',
    });
    expect(frameCss({ url: '', width: 1, height: 1, frames: {} }, 'missing', 10)).toBeNull();
  });

  it('frameFill stretches one frame over any element with percentages (#34)', () => {
    const css = frameFill({ url: 'ui.png', width: 1000, height: 500, frames: { a: { x: 100, y: 50, w: 200, h: 100 } } }, 'a');
    expect(css).toEqual({
      backgroundImage: 'url("ui.png")', backgroundSize: '500% 500%', backgroundPosition: '12.5% 12.5%', backgroundRepeat: 'no-repeat',
    });
    expect(frameFill({ url: '', width: 10, height: 10, frames: { all: { x: 0, y: 0, w: 10, h: 10 } } }, 'all')!.backgroundPosition).toBe('0% 0%');
    expect(frameFill({ url: '', width: 1, height: 1, frames: {} }, 'missing')).toBeNull();
  });
});
