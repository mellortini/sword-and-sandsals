import { choiceOptions, choose, findNode } from '../core/dialogue';
import type { Dialogue, DialogueNode } from '../core/dialogue';
import type { SavedCharacter } from '../core/save';
import { addFonts } from './counter';
import './dialogue.css';

/** text of a line: HTML escaped, `*stage directions*` in italics */
function lineHtml(line: string): string {
  const safe = line.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/**
 * A dialogue with choices (#292) as a parchment panel over the scene: who speaks, the lines, and the choices as
 * buttons. A choice that is not met is greyed out with what it lacks, a check shows its chance (`[Precision 62%]`),
 * and after it the result. Every choice is saved at once (a failed check cannot be undone by leaving). Keys 1–9 pick,
 * Enter continues, Escape leaves. Resolves with the save as it is when the dialogue ends or is left.
 */
export function openDialogue(
  character: SavedCharacter, dialogue: Dialogue, save: (character: SavedCharacter) => Promise<void>,
): Promise<SavedCharacter> {
  addFonts();
  const root = document.createElement('div');
  root.className = 'dialogue';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `<div class="dialogue__panel">
      <div class="dialogue__speaker" id="dlSpeaker"></div>
      <div class="dialogue__result" role="status"></div>
      <div class="dialogue__lines" aria-live="polite"></div>
      <div class="dialogue__choices"></div>
      <div class="dialogue__problem" role="status"></div>
    </div>`;
  root.setAttribute('aria-labelledby', 'dlSpeaker');
  document.body.append(root);
  const $ = (sel: string) => root.querySelector<HTMLElement>(sel)!;

  let current = character;
  let busy = false;

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = () => {
      keys.abort();
      root.remove();
      resolve(current);
    };

    const show = (node: DialogueNode, result = '') => {
      $('.dialogue__speaker').textContent = node.speaker;
      $('.dialogue__result').textContent = result;
      $('.dialogue__result').hidden = !result;
      $('.dialogue__lines').innerHTML = node.lines.map((l) => `<p>${lineHtml(l)}</p>`).join('');
      $('.dialogue__problem').textContent = '';
      const box = $('.dialogue__choices');
      box.replaceChildren();
      const options = choiceOptions(current, node);
      if (options.length) {
        for (const o of options) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'dialogue__choice';
          b.dataset.index = String(o.index);
          b.setAttribute('aria-disabled', String(!o.available));
          b.innerHTML = `<span class="dialogue__key">${o.index + 1}</span>`
            + (o.tag ? `<span class="dialogue__tag">${lineHtml(o.tag)}</span> ` : '') + `<span>${lineHtml(o.choice.label)}</span>`;
          if (!o.available) b.title = `Needs ${o.unmet.join(', ')}`;
          b.addEventListener('click', () => void pick(node, o.index));
          box.append(b);
        }
      } else {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dialogue__choice dialogue__choice--go';
        b.textContent = node.next ? 'Continue' : 'Leave';
        b.addEventListener('click', () => {
          const next = node.next && findNode(dialogue, node.next);
          if (next) show(next);
          else close();
        });
        box.append(b);
      }
      box.querySelector<HTMLButtonElement>('button:not([aria-disabled="true"])')?.focus();
    };

    const pick = async (node: DialogueNode, index: number) => {
      if (busy) return;
      const option = choiceOptions(current, node)[index];
      if (!option?.available) return;
      const result = choose(current, dialogue, node.id, index, Math.random());
      if (!result.ok) return;
      if (result.character !== current) {
        busy = true;
        try {
          await save(result.character);
        } catch {
          $('.dialogue__problem').textContent = 'The game could not be saved. Try again.';
          return;
        } finally {
          busy = false;
        }
        current = result.character;
      }
      const check = option.choice.check;
      const note = check ? `${option.tag?.slice(1, -1)}: ${result.success ? 'success' : 'failed'}.` : '';
      const next = result.next && findNode(dialogue, result.next);
      if (next) show(next, note);
      else close();
    };

    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') return close();
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1) {
        root.querySelector<HTMLButtonElement>(`[data-index="${n - 1}"]`)?.click();
        e.preventDefault();
      }
    }, { capture: true, signal: keys.signal });

    const start = findNode(dialogue, dialogue.start);
    if (start) show(start);
    else close();
  });
}
