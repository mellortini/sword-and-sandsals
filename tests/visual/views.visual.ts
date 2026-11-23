import { expect, test } from '@playwright/test';
import type { Application } from 'pixi.js';

type GameWindow = Window & { __game?: { app: Application; rigs: unknown[] } };

const cases = [
  { name: 'lineup', query: '?view=lineup', rigs: 10 },
  { name: 'faces', query: '?view=faces', rigs: 40 },
  { name: 'strip', query: '?view=strip&clip=attack_normal&every=2', rigs: 9 },
];

for (const view of cases) {
  test(`${view.name} matches its reference image`, async ({ page }) => {
    await page.addInitScript(() => {
      // The frame strip uses a random look. Reuse the same look in every screenshot.
      let state = 93;
      Math.random = () => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        return state / 0x1_0000_0000;
      };
    });
    await page.goto(`/${view.query}`);
    await page.waitForFunction((rigs) => (window as GameWindow).__game?.rigs.length === rigs, view.rigs);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const { app } = (window as GameWindow).__game!;
      app.ticker.stop();
      app.ticker.update(performance.now() + 1000 / 30);
      app.render();
    });

    await expect(page.locator('#stage canvas')).toHaveScreenshot(`${view.name}.png`, { animations: 'disabled' });
  });
}
