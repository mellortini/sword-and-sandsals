/// <reference types="vite/client" />
import type { SavedCharacter } from '../core/save';
import { SKILL_TREES } from '../data/skills';
import type { SkillId } from '../data/skills';
import { commitSkills, skillState, skillsLeft, startSkillDraft, toggleSkill } from './skillTreeRules';
import type { SkillDraft } from './skillTreeRules';
import './skillTree.css';
import { dressRoom } from './counter';

const STATE_TEXT = { learned: 'learned', picked: 'chosen', open: 'can learn', locked: 'locked' } as const;

/**
 * The skill screen (#54): six paper trees of four skills. A skill opens once the one above it is learned; clicking an
 * open skill picks it (one skill point each), clicking it again puts it back. Keep learns the picked skills through
 * the core and saves; Later (or Escape) closes without changes. Arrows move between skills, Enter or Space picks.
 * While it is open, keys do not reach the screen underneath.
 */
export function openSkillTree(character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'skill-tree';
  backdrop.innerHTML = `
    <div class="skill-tree__panel" role="dialog" aria-modal="true" aria-labelledby="skTitle">
      <div class="skill-tree__head">
        <h3 id="skTitle">Skills</h3>
        <div class="skill-tree__name">${escapeHtml(character.name)} · level ${character.level}</div>
        <div class="skill-tree__points">Skill points <b id="skFree"></b></div>
      </div>
      <div class="skill-tree__trees">
        ${SKILL_TREES.map((tree, t) => `<section class="skill-tree__tree" aria-label="${tree.name}">
          <h4>${tree.name}</h4>
          ${tree.skills.map((s, i) => `<button type="button" class="skill" data-skill="${s.id}" data-tree="${t}" data-row="${i}">
            <span class="skill__name">${s.name}</span><span class="skill__state"></span><span class="skill__text">${s.description}</span>
            </button>`).join('')}
        </section>`).join('')}
      </div>
      <div class="skill-tree__hint">One point per skill · a skill opens once the one above it is learned · a new point every third level</div>
      <div class="skill-tree__problem" id="skProblem" role="status"></div>
      <div class="skill-tree__actions">
        <button type="button" data-act="later">Later</button>
        <button type="button" data-act="keep" class="keep">Keep</button>
      </div>
    </div>`;
  document.body.append(backdrop);
  // the building's counter frame: room, vendor, door (#267)
  dressRoom(backdrop, 'skills');

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  const skillButtons = [...backdrop.querySelectorAll<HTMLButtonElement>('button.skill')];
  let draft: SkillDraft = startSkillDraft(character);
  let busy = false;

  const refresh = () => {
    const left = skillsLeft(draft);
    $('skFree').textContent = String(left);
    $('skFree').classList.toggle('done', left === 0);
    for (const b of skillButtons) {
      const state = skillState(draft, b.dataset.skill as SkillId);
      b.dataset.state = state;
      b.querySelector('.skill__state')!.textContent = STATE_TEXT[state];
      const usable = state === 'picked' || (state === 'open' && left > 0);
      b.setAttribute('aria-disabled', String(!usable));
      b.setAttribute('aria-pressed', String(state === 'picked' || state === 'learned'));
    }
    backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]')!.disabled = draft.picked.length === 0 || busy;
  };

  // arrows: up/down inside a tree, left/right to the same row of the next tree
  const moveFocus = (key: string) => {
    const at = skillButtons.indexOf(document.activeElement as HTMLButtonElement);
    const tree = at < 0 ? 0 : +skillButtons[at].dataset.tree!;
    const row = at < 0 ? 0 : +skillButtons[at].dataset.row!;
    const trees = SKILL_TREES.length;
    const [t, r] = key === 'ArrowDown' ? [tree, Math.min(3, row + 1)] : key === 'ArrowUp' ? [tree, Math.max(0, row - 1)]
      : key === 'ArrowRight' ? [(tree + 1) % trees, row] : [(tree - 1 + trees) % trees, row];
    skillButtons.find((b) => +b.dataset.tree! === t && +b.dataset.row! === r)?.focus();
  };

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = (result: SavedCharacter) => {
      keys.abort();
      backdrop.remove();
      resolve(result);
    };
    backdrop.addEventListener('click', async (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button || button.disabled || busy) return;
      if (button.dataset.skill) {
        const id = button.dataset.skill as SkillId;
        const before = draft;
        draft = toggleSkill(draft, id);
        $('skProblem').textContent = draft === before && skillState(draft, id) === 'open' ? 'No skill points left.'
          : draft === before && skillState(draft, id) === 'locked' ? 'Learn the skill above it first.' : '';
        refresh();
      } else if (button.dataset.act === 'later') {
        close(character);
      } else if (button.dataset.act === 'keep') {
        const kept = commitSkills(character, draft);
        busy = true;
        refresh();
        try {
          await save(kept);
          close(kept);
        } catch {
          busy = false;
          $('skProblem').textContent = 'The game could not be saved. Try again.';
          refresh();
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(character);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        moveFocus(e.key);
      }
    }, { capture: true, signal: keys.signal });
    refresh();
    (skillButtons.find((b) => b.dataset.state === 'open') ?? skillButtons[0]).focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
