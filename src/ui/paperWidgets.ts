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

/** Paper button, top-centre at (x, y). The primary one is gold-edged. */
export function paperButton(label: string, x: number, y: number, primary: boolean, onPress: () => void, w = 250) {
  const h = 76;
  const b = new Container();
  const face = new Graphics()
    .roundRect(-w / 2, 0, w, h, 12)
    .fill(primary ? 0x9a6a2e : 0x5a3c34)
    .stroke({ color: primary ? 0xf2c14e : 0xb58758, width: 3 });
  const t = new Text({ text: label, style: { fontFamily: 'Georgia', fontSize: 34, fontWeight: 'bold', fill: '#fff0cb' } });
  t.anchor.set(0.5);
  t.position.set(0, h / 2);
  b.addChild(face, t);
  b.position.set(x, y);
  b.eventMode = 'static';
  b.cursor = 'pointer';
  b.accessibleTitle = label;
  b.on('pointerover', () => { face.tint = 0xffe6c0; });
  b.on('pointerout', () => { face.tint = 0xffffff; });
  b.on('pointertap', onPress);
  return b;
}
