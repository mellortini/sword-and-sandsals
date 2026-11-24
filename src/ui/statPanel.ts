import { Container, Graphics, Text } from 'pixi.js';
import type { TextStyleOptions } from 'pixi.js';
import type { StatRow } from './statRows';

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 18;
const PAD = 26;

const BETTER = '#f2c14e';
const WORSE = '#cdb99a';
const EVEN = '#f3e6d6';

/** Paper plate with a stat table: player value · label · enemy value. The better value of each row is gold. */
export class StatPanel extends Container {
  readonly panelWidth: number;
  readonly panelHeight: number;

  constructor(rows: readonly StatRow[], width = 640) {
    super();
    this.panelWidth = width;
    this.panelHeight = HEADER_HEIGHT + PAD * 2 + rows.length * ROW_HEIGHT;

    const plate = new Graphics()
      .roundRect(0, 0, width, this.panelHeight, 16)
      .fill({ color: 0x332124, alpha: 0.94 })
      .stroke({ color: 0x815a46, width: 3 });
    this.addChild(plate);

    rows.forEach((row, i) => {
      const y = PAD + HEADER_HEIGHT + i * ROW_HEIGHT;
      if (i % 2 === 0) {
        this.addChild(new Graphics().roundRect(14, y, width - 28, ROW_HEIGHT, 6).fill({ color: 0x4a3030, alpha: 0.55 }));
      }
      const cy = y + ROW_HEIGHT / 2;
      this.addChild(
        text(row.label, width / 2, cy, 0.5, { fill: '#e8cfa8', fontSize: 24, letterSpacing: 1 }),
        text(row.player, PAD + 30, cy, 0, valueStyle(row.edge === 'player', row.edge === 'even')),
        text(row.enemy, width - PAD - 30, cy, 1, valueStyle(row.edge === 'enemy', row.edge === 'even')),
      );
      if (row.edge !== 'even') {
        const x = row.edge === 'player' ? PAD + 12 : width - PAD - 12;
        this.addChild(new Graphics().circle(x, cy, 5).fill(0xf2c14e));
      }
    });
  }
}

function valueStyle(better: boolean, even: boolean): TextStyleOptions {
  return { fill: even ? EVEN : better ? BETTER : WORSE, fontSize: 27, fontWeight: better ? 'bold' : 'normal' };
}

function text(s: string, x: number, y: number, anchorX: number, style: TextStyleOptions) {
  const t = new Text({ text: s, style: { fontFamily: 'Georgia', ...style } });
  t.anchor.set(anchorX, 0.5);
  t.position.set(x, y);
  return t;
}
