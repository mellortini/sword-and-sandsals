import { Container, Graphics, Text } from 'pixi.js';

/** Gold screen title in capitals, centred on (x, y). */
export function screenTitle(s: string, x: number, y: number, fill = '#e8be4c', fontSize = 52) {
  const t = new Text({ text: s.toUpperCase(), style: { fontFamily: 'Georgia', fontSize, fill, letterSpacing: 6 } });
  t.anchor.set(0.5);
  t.position.set(x, y);
  return t;
}

/** Centred text squeezed horizontally to `maxWidth` when it is longer (long names). */
export function fittedText(s: string, x: number, y: number, maxWidth: number, style: { fontSize: number; fill: string; fontWeight?: 'bold' }) {
  const t = new Text({ text: s, style: { fontFamily: 'Georgia', ...style } });
  t.anchor.set(0.5);
  if (t.width > maxWidth) t.scale.x = maxWidth / t.width;
  t.position.set(x, y);
  return t;
}

/** A paper button that the keyboard can select (gold ring) and press. */
export type PaperButton = Container & { press(): void; setSelected(on: boolean): void };

/** Paper button, top-centre at (x, y). The primary one is gold-edged. */
export function paperButton(label: string, x: number, y: number, primary: boolean, onPress: () => void, w = 250): PaperButton {
  const h = 76;
  const b = new Container() as PaperButton;
  const face = new Graphics()
    .roundRect(-w / 2, 0, w, h, 12)
    .fill(primary ? 0x9a6a2e : 0x5a3c34)
    .stroke({ color: primary ? 0xf2c14e : 0xb58758, width: 3 });
  // keyboard selection: a light ring outside the button, so it never relies on colour alone
  const ring = new Graphics().roundRect(-w / 2 - 9, -9, w + 18, h + 18, 18).stroke({ color: 0xfff0d0, width: 4 });
  ring.visible = false;
  const t = new Text({ text: label, style: { fontFamily: 'Georgia', fontSize: 34, fontWeight: 'bold', fill: '#fff0cb' } });
  t.anchor.set(0.5);
  t.position.set(0, h / 2);
  b.addChild(ring, face, t);
  b.position.set(x, y);
  b.eventMode = 'static';
  b.cursor = 'pointer';
  b.accessibleTitle = label;
  b.on('pointerover', () => { face.tint = 0xffe6c0; });
  b.on('pointerout', () => { if (!ring.visible) face.tint = 0xffffff; });
  b.on('pointertap', onPress);
  b.press = onPress;
  b.setSelected = (on) => {
    ring.visible = on;
    face.tint = on ? 0xffe6c0 : 0xffffff;
  };
  return b;
}

/**
 * Keyboard for a screen of paper buttons: ←/→ (or ↑/↓, Tab) move the selection ring, Enter or Space presses the
 * selected button. Buttons can be added later (the result screen's "Spend points"); destroyed ones are skipped.
 */
export function buttonKeys(signal: AbortSignal) {
  const buttons: PaperButton[] = [];
  let selected = 0;
  const alive = () => buttons.filter((b) => !b.destroyed);
  const show = () => alive().forEach((b, i) => b.setSelected(i === selected));
  window.addEventListener('keydown', (e) => {
    const list = alive();
    if (list.length === 0) return;
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey) ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 0;
    if (step) {
      e.preventDefault();
      selected = (Math.min(selected, list.length - 1) + step + list.length) % list.length;
      show();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      list[Math.min(selected, list.length - 1)].press();
    }
  }, { signal });
  return {
    add(...more: PaperButton[]) {
      buttons.push(...more);
      show();
    },
  };
}

/** Small line of key hints under a row of buttons. */
export function keyHint(s: string, x: number, y: number) {
  const t = new Text({ text: s, style: { fontFamily: 'Georgia', fontSize: 22, fill: '#cdb99a' } });
  t.anchor.set(0.5, 0);
  t.position.set(x, y);
  return t;
}
