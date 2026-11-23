import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { MaxRectsPacker } from 'maxrects-packer';
import sharp from 'sharp';

const KIT_DIR = fileURLToPath(new URL('../assets/chars/kit/', import.meta.url));
const OUTPUT = join(KIT_DIR, 'atlas');
const PAGE_SIZE = 1024;
const BORDER = 2;
const PAGE_NAME = /^(?:base|look-\d+|gear-\d+)-[a-f0-9]{12}\.webp$/;

function groupFor(key) {
  const gear = key.match(/^(?:helmet|armor|shoulders|greaves|boots)(\d+)/);
  if (gear) return 'gear-' + gear[1];
  const look = key.match(/^(?:face|hair|beard)(\d+)/);
  if (look) return 'look-' + Math.floor(Number(look[1]) / 2);
  return 'base';
}

const { sprites } = JSON.parse(await readFile(join(KIT_DIR, 'kit.json'), 'utf8'));
const groups = new Map();
for (const key of Object.keys(sprites).sort()) {
  const group = groupFor(key);
  if (!groups.has(group)) groups.set(group, new MaxRectsPacker(PAGE_SIZE, PAGE_SIZE, 0, { pot: false, square: false, allowRotation: false }));
  const { w, h } = sprites[key];
  if (w + BORDER * 2 > PAGE_SIZE || h + BORDER * 2 > PAGE_SIZE) {
    throw new Error('Sprite is too large for the atlas: ' + key);
  }
  groups.get(group).add(w + BORDER * 2, h + BORDER * 2, { key, w, h });
}

await mkdir(OUTPUT, { recursive: true });
const frames = {};
const pages = new Set();
for (const [group, packer] of groups) {
  for (const bin of packer.bins) {
    const layers = await Promise.all(bin.rects.map(async ({ x, y, data }) => {
      const file = join(KIT_DIR, 'sprites', data.key + '.png');
      const sprite = sharp(file).ensureAlpha();
      const metadata = await sprite.metadata();
      if (metadata.width !== data.w || metadata.height !== data.h) {
        throw new Error('Sprite dimensions differ from kit.json: ' + data.key);
      }
      const input = await sprite.extend({
        top: BORDER, right: BORDER, bottom: BORDER, left: BORDER, extendWith: 'copy',
      }).png().toBuffer();
      return { input, left: x, top: y };
    }));
    const bitmap = await sharp({
      create: { width: bin.width, height: bin.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite(layers).webp({ lossless: true, effort: 6 }).toBuffer();

    const hash = createHash('sha256').update(bitmap).digest('hex').slice(0, 12);
    const page = group + '-' + hash + '.webp';
    // Content-addressed pages let cached manifests keep using their original pages until a new deploy.
    await writeFile(join(OUTPUT, page), bitmap);
    pages.add(page);
    for (const { x, y, data } of bin.rects) {
      frames[data.key] = { page, x: x + BORDER, y: y + BORDER, w: data.w, h: data.h };
    }
  }
}

const temporaryManifest = join(OUTPUT, 'manifest.tmp');
await writeFile(temporaryManifest, JSON.stringify({ version: 1, frames }, null, 2) + '\n');
await rename(temporaryManifest, join(OUTPUT, 'manifest.json'));
for (const file of await readdir(OUTPUT)) {
  if (PAGE_NAME.test(file) && !pages.has(file)) await unlink(join(OUTPUT, file));
}
stdout.write('Packed ' + Object.keys(frames).length + ' sprites into ' + pages.size + ' WebP pages.\n');
