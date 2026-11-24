import { Container, Graphics, Text } from 'pixi.js';
import { firstEnabled, moveSelection } from './menuNav';
import type { MenuEntry } from './menuNav';

export interface PaperMenuEntry extends MenuEntry {
  /** small line under the label: what a disabled entry waits for, or a detail (the saved gladiator's name) */
  readonly note?: string;
}

const ROW_H = 84;
const PAD = 22;

/**
 * Vertical paper menu in the HUD style. Hover or ↑/↓ (via `move`) selects, click or `choose()` picks.
 * Disabled entries are drawn faded with their note and are skipped.
 */
export class PaperMenu extends Container {
  readonly menuWidth: number;
  readonly menuHeight: number;
  selected: number;
  private readonly rows: Graphics[] = [];

  /** `initial` picks the entry selected first (when enabled); otherwise the first enabled one */
  constructor(private readonly entries: readonly PaperMenuEntry[], private readonly onChoose: (index: number) => void, width = 480, initial?: number) {
    super();
    this.menuWidth = width;
    this.menuHeight = PAD * 2 + entries.length * ROW_H;
    this.addChild(new Graphics()
      .roundRect(0, 0, width, this.menuHeight, 16)
      .fill({ color: 0x332124, alpha: 0.94 })
      .stroke({ color: 0x815a46, width: 3 }));

    entries.forEach((entry, i) => {
      const y = PAD + i * ROW_H;
      const row = new Graphics();
      row.position.set(0, y);
      this.rows.push(row);
      const label = new Text({
        text: entry.label,
        style: { fontFamily: 'Georgia', fontSize: 36, fontWeight: 'bold', fill: entry.enabled ? '#fff0cb' : '#8f7b70' },
      });
      label.anchor.set(0.5);
      label.position.set(width / 2, y + (entry.note ? ROW_H / 2 - 12 : ROW_H / 2));
      this.addChild(row, label);
      if (entry.note) {
        const note = new Text({ text: entry.note, style: { fontFamily: 'Georgia', fontSize: 19, fontStyle: 'italic', fill: entry.enabled ? '#f4d3a7' : '#a8907e' } });
        note.anchor.set(0.5);
        note.position.set(width / 2, y + ROW_H / 2 + 22);
        this.addChild(note);
      }
      if (entry.enabled) {
        row.eventMode = 'static';
        row.cursor = 'pointer';
        row.accessibleTitle = entry.label;
        row.on('pointerover', () => this.select(i));
        row.on('pointertap', () => { this.select(i); this.choose(); });
      }
    });

    this.selected = initial !== undefined && entries[initial]?.enabled ? initial : firstEnabled(entries);
    this.redraw();
  }

  select(index: number) {
    if (index === this.selected || !this.entries[index]?.enabled) return;
    this.selected = index;
    this.redraw();
  }

  move(step: 1 | -1) {
    if (this.selected >= 0) this.select(moveSelection(this.entries, this.selected, step));
  }

  choose() {
    if (this.selected >= 0) this.onChoose(this.selected);
  }

  private redraw() {
    const w = this.menuWidth;
    this.rows.forEach((row, i) => {
      row.clear().rect(14, 4, w - 28, ROW_H - 8).fill({ color: 0x000000, alpha: 0.001 });
      if (i === this.selected) {
        row.roundRect(14, 4, w - 28, ROW_H - 8, 10)
          .fill({ color: 0x9a6a2e, alpha: 0.9 })
          .stroke({ color: 0xf2c14e, width: 3 });
      }
    });
  }
}
