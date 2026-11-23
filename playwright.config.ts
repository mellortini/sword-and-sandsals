import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.visual.ts',
  outputDir: './out/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  updateSnapshots: 'none',
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.16 },
  },
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:5181',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5181 --strictPort',
    url: 'http://127.0.0.1:5181',
    timeout: 30_000,
  },
});
