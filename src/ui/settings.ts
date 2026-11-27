/**
 * The settings screen (#80), a panel over the title: text size, gore, motion, paper shadows and three volumes. Every
 * change is saved at once (each setting lives in its own module, src/ui/settingsRules.ts lists them). ↑/↓ move between
 * rows, ←/→ change the row, Escape or Done closes.
 */
import { SETTINGS, SLIDER_STEP } from './settingsRules';
import type { SettingRow } from './settingsRules';
import './forge.css';
import './settings.css';

export function openSettings(): Promise<void> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge settings';
  backdrop.innerHTML = `
    <div class="forge__panel settings__panel" role="dialog" aria-modal="true" aria-labelledby="stTitle">
      <div class="forge__head"><h3 id="stTitle">Settings</h3><div class="forge__name">saved in this browser</div></div>
      <div class="settings__rows">${SETTINGS.map(rowHtml).join('')}</div>
      <div class="forge__actions"><button type="button" data-act="done" class="keep">Done</button></div>
    </div>`;
  document.body.append(backdrop);

  const refresh = (row: SettingRow) => {
    const el = backdrop.querySelector<HTMLElement>(`[data-row="${row.id}"]`)!;
    if (row.kind === 'choice') el.querySelector('.settings__value')!.textContent = row.value();
    else {
      const input = el.querySelector<HTMLInputElement>('input')!;
      input.value = String(row.value());
      el.querySelector('.settings__value')!.textContent = `${row.value()} %`;
    }
  };
  const change = (row: SettingRow, dir: 1 | -1) => {
    if (row.kind === 'choice') row.step(dir);
    else row.set(row.value() + dir * SLIDER_STEP);
    refresh(row);
  };

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = () => {
      keys.abort();
      backdrop.remove();
      resolve();
    };
    backdrop.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button) return;
      if (button.dataset.act === 'done') return close();
      const row = SETTINGS.find((r) => r.id === button.closest<HTMLElement>('[data-row]')?.dataset.row);
      if (row && button.dataset.dir) change(row, +button.dataset.dir as 1 | -1);
    });
    backdrop.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const row = SETTINGS.find((r) => r.id === input.closest<HTMLElement>('[data-row]')?.dataset.row);
      if (row?.kind === 'slider') { row.set(+input.value); refresh(row); }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      const rows = [...backdrop.querySelectorAll<HTMLElement>('[data-row]')];
      const at = rows.findIndex((r) => r.contains(document.activeElement));
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = rows[Math.max(0, Math.min(rows.length - 1, (at < 0 ? -1 : at) + (e.key === 'ArrowDown' ? 1 : -1)))];
        next?.querySelector<HTMLElement>('input, .settings__value')?.focus();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && at >= 0) {
        e.preventDefault();
        change(SETTINGS.find((r) => r.id === rows[at].dataset.row)!, e.key === 'ArrowRight' ? 1 : -1);
      }
    }, { capture: true, signal: keys.signal });
    backdrop.querySelector<HTMLElement>('.settings__value')?.focus();
  });
}

function rowHtml(row: SettingRow): string {
  const head = `<span class="settings__label">${row.label}<small>${row.hint}</small></span>`;
  if (row.kind === 'choice') {
    return `<div class="settings__row" data-row="${row.id}">${head}
      <span class="settings__choice"><button type="button" data-dir="-1" aria-label="previous ${row.label}">◀</button>
      <span class="settings__value" tabindex="0" role="status">${row.value()}</span>
      <button type="button" data-dir="1" aria-label="next ${row.label}">▶</button></span></div>`;
  }
  return `<div class="settings__row" data-row="${row.id}">${head}
    <span class="settings__choice"><input type="range" min="0" max="100" step="${SLIDER_STEP}" value="${row.value()}" aria-label="${row.label}">
    <span class="settings__value settings__value--pct">${row.value()} %</span></span></div>`;
}
