import './inkName.css';

/** Letters a name may hold (same rule as `nameProblem`): anything else is drawn as a smudge. */
const INKABLE = /^[\p{L}' -]$/u;

/**
 * Which letters changed between two values of the field, in code points (so Polish and other letters count as one).
 * `prefix` letters at the start and `suffix` letters at the end are the same; the `fresh` ones in between were just written.
 */
export function inkDiff(before: string, after: string): { prefix: number; suffix: number; fresh: number } {
  const a = Array.from(before);
  const b = Array.from(after);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  return { prefix, suffix, fresh: b.length - prefix - suffix };
}

/** True when the letter is drawn as a smudge because a name cannot hold it. */
export const isSmudge = (letter: string) => !INKABLE.test(letter);

export interface InkName {
  /** Redraw after the field's value was set from code. */
  sync(): void;
}

/**
 * Writes the name in ink: the real `<input>` keeps typing, caret, paste and phone keyboards, but its own text is hidden
 * and each new letter is drawn over it with a pen stroke and a blot of ink that soaks into the parchment.
 * `maxLength` limits the name; a letter past the limit makes the field shake instead of writing.
 */
export function inkName(input: HTMLInputElement, maxLength: number): InkName {
  const field = document.createElement('div');
  field.className = 'ink-name';
  input.replaceWith(field);
  input.classList.add('ink-input');
  input.maxLength = maxLength;
  const layer = document.createElement('div');
  layer.className = 'ink-text';
  layer.setAttribute('aria-hidden', 'true');
  const line = document.createElement('span');
  line.className = 'ink-line';
  layer.append(line);
  field.append(input, layer);

  let shown = '';

  const letterSpan = (letter: string, fresh: number) => {
    const s = document.createElement('span');
    s.className = letter.trim() === '' ? 'ink-ch space' : isSmudge(letter) ? 'ink-ch smudge' : 'ink-ch';
    s.textContent = letter;
    if (fresh >= 0) {
      s.classList.add('fresh');
      // Pasted words are written letter after letter, not all at once.
      s.style.animationDelay = `${fresh * 60}ms`;
      s.style.setProperty('--tilt', `${(Math.random() * 2 - 1) * 4}deg`);
      s.style.setProperty('--blot-x', `${30 + Math.random() * 40}%`);
      const dry = (e: AnimationEvent) => {
        if (e.animationName !== (letter.trim() === '' ? 'ink-write' : 'ink-blot')) return;
        s.classList.remove('fresh');
        s.removeEventListener('animationend', dry);
      };
      s.addEventListener('animationend', dry);
    }
    return s;
  };

  const follow = () => { line.style.transform = `translateX(${-input.scrollLeft}px)`; };

  const sync = () => {
    const next = input.value;
    if (next === shown) { follow(); return; }
    const { prefix, suffix, fresh } = inkDiff(shown, next);
    const old = Array.from(line.children);
    old.slice(prefix, old.length - suffix).forEach((n) => n.remove());
    const before = old[old.length - suffix] ?? null;
    const letters = Array.from(next).slice(prefix, prefix + fresh);
    letters.forEach((l, i) => line.insertBefore(letterSpan(l, i), suffix > 0 ? before : null));
    shown = next;
    follow();
  };

  const shake = () => {
    field.classList.remove('full');
    void field.offsetWidth;
    field.classList.add('full');
  };

  input.addEventListener('beforeinput', (e) => {
    const adds = e.inputType.startsWith('insert') && !e.inputType.includes('Composition') && e.data !== '';
    const selected = (input.selectionEnd ?? 0) - (input.selectionStart ?? 0);
    if (adds && input.value.length - selected >= maxLength) shake();
  });
  field.addEventListener('animationend', (e) => { if (e.target === field) field.classList.remove('full'); });
  input.addEventListener('input', sync);
  input.addEventListener('scroll', follow);
  input.addEventListener('keyup', follow);
  input.addEventListener('select', follow);
  sync();
  return { sync };
}
