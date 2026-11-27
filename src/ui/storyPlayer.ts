/// <reference types="vite/client" />
/**
 * Plays a story scene (#64) over the game: the title on black, then each shot with a slow drift of the camera and
 * its lines as subtitles on a paper strip, cross-fading between shots. A line waits for its narration when it has one
 * (src/data/story.ts `voice`), otherwise for the time it takes to read it. Click, Space or Enter moves on to the next
 * line; Escape (or Skip) ends the scene. Nothing moves with prefers-reduced-motion.
 */
import type { StoryIntro } from '../data/story';
import { readingTime } from '../data/story';
import { volumes } from '../audio/volume';
import './story.css';

const TITLE_FOR = 1.6;

export function playStory(scene: StoryIntro): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div');
  root.className = 'story';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', scene.title);
  root.innerHTML = `
    <div class="story__frame"><img class="story__shot" alt=""><img class="story__shot" alt=""></div>
    <div class="story__title">${scene.title}</div>
    <p class="story__line" aria-live="polite"></p>
    <button type="button" class="story__skip">Skip ▸▸</button>`;
  document.body.append(root);
  const shots = [...root.querySelectorAll<HTMLImageElement>('.story__shot')];
  const line = root.querySelector<HTMLElement>('.story__line')!;
  const title = root.querySelector<HTMLElement>('.story__title')!;
  // the pictures load while the title shows
  for (const s of scene.shots) new Image().src = base + s.image;

  return new Promise((resolve) => {
    const keys = new AbortController();
    let done = false;
    let advance: (() => void) | null = null;
    let voice: HTMLAudioElement | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      voice?.pause();
      keys.abort();
      root.classList.add('story--out');
      setTimeout(() => { root.remove(); resolve(); }, still ? 0 : 400);
    };
    /** wait `seconds`, or less if the player moves on */
    const hold = (seconds: number) => new Promise<void>((next) => {
      const timer = setTimeout(() => { advance = null; next(); }, seconds * 1000);
      advance = () => { clearTimeout(timer); advance = null; next(); };
    });
    const say = async (text: string, src?: string) => {
      line.textContent = text;
      line.classList.remove('story__line--in');
      void line.offsetWidth;
      line.classList.add('story__line--in');
      if (src) {
        const v = new Audio(base + src);
        voice = v;
        // the narrator on the voices channel (#73), under the master volume
        v.volume = Math.min(1, volumes().master * volumes().voices);
        // one wait per line: the recording ends (or fails, or runs past 30 s), or the player moves on; a click while it
        // plays moves on at once. If the browser refuses to play it (autoplay), the line stays as long as a subtitle.
        const blocked = await new Promise<boolean>((next) => {
          let settled = false;   // play() rejects late (AbortError) when the line was skipped: ignore it then
          const timer = setTimeout(() => done(false), 30_000);
          const done = (refused: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            advance = null;
            next(refused);
          };
          v.onended = () => done(false);
          v.onerror = () => done(false);
          advance = () => done(false);
          v.play().catch(() => done(true));
        });
        v.pause();
        voice = null;
        if (blocked) await hold(readingTime(text));
      } else await hold(readingTime(text));
    };

    root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.story__skip')) finish();
      else advance?.();
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') finish();
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance?.(); }
    }, { capture: true, signal: keys.signal });

    void (async () => {
      await hold(TITLE_FOR);
      title.classList.add('story__title--out');
      let front = 0;
      for (const shot of scene.shots) {
        if (done) return;
        const img = shots[front];
        const [dx, dy] = shot.drift ?? [0, 0];
        const length = shot.lines.reduce((t, l, i) => t + (shot.voice?.[i] ? 8 : readingTime(l)), 0) + 1;
        img.src = base + shot.image;
        img.style.setProperty('--dx', `${dx * 100}%`);
        img.style.setProperty('--dy', `${dy * 100}%`);
        img.style.setProperty('--drift', `${length}s`);
        img.classList.toggle('story__shot--still', still);
        img.classList.remove('story__shot--on');
        void img.offsetWidth;
        img.classList.add('story__shot--on');
        shots[1 - front].classList.remove('story__shot--on');
        front = 1 - front;
        for (let i = 0; i < shot.lines.length && !done; i++) await say(shot.lines[i], shot.voice?.[i]);
      }
      finish();
    })();
  });
}
