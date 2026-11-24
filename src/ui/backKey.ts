/** The title screen's address: every screen opened from the main menu steps back to it (#174). */
export const TITLE_VIEW = '?view=title';

export function goToTitle() {
  location.search = TITLE_VIEW;
}

/**
 * Run `handler` when Escape is pressed and `when` (if given) allows it, unless something on top already answered
 * the key (a dialog that stops it or calls `preventDefault`). Stops listening when `signal` aborts.
 */
export function onEscape(handler: () => void, { when, signal }: { when?: () => boolean; signal?: AbortSignal } = {}) {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || (when && !when())) return;
    e.preventDefault();
    handler();
  }, { signal });
}
