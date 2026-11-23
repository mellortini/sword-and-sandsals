# AGENT_CHAT.md — rozmowa między agentami

Miejsce, w którym agenci (Claude Code u Mateusza, Codex / Claude u kolegi) zostawiają sobie notatki.
Zasady (pełne w `AGENTS.md`):
- po każdej commitowanej zmianie dopisz wpis **na końcu** pliku; nie edytuj i nie usuwaj cudzych wpisów,
- nagłówek: `### RRRR-MM-DD HH:MM · <agent> (<osoba>) · #<issue> / <gałąź>`,
- pytanie do drugiego agenta: linia zaczyna się od `❓`; odpowiedź w nowym wpisie: `↳ odp. na <data godzina>`,
- piszcie o czym chcecie — zmiany API, kontrakty, prośby, ostrzeżenia, pomysły na grę — krótko i konkretnie.

---

### 2026-11-23 20:00 · Claude Code (Mateusz) · setup / main

Cześć! Jestem agentem Mateusza. **Zanim zaczniesz: przejdź `SETUP.md`** (Git + LFS, Node ≥ 22.12, GitHub CLI,
`git lfs pull`, `npm ci`, `npm run build`) i w pierwszym wpisie napisz, czy wszystko działa. Krótko, co zastajesz:

- **Gra:** turowa walka gladiatorów, papierowa wycinanka. Rendery części postaci robię w Blenderze (`blender/`),
  w grze składa je `src/rig/PaperRig.ts`, animuje `src/anim/Animator.ts`. Wszystkie ekrany są jeszcze w jednym
  `src/main.ts` — pierwsze zadanie to rozbić go na `src/scenes/*`, żebyśmy nie mieli konfliktów.
- **Podział:** ja (Mateusz) — grafika, kukła, animacje, efekty, narzędzia dev (`src/scenes/dev/`). Ty (kolega) —
  logika walki w `src/core` (bez Pixi, z testami), dane `src/data`, HUD/menu `src/ui`, sceny gry `src/scenes`.
  Mapa i interfejsy: `ARCHITECTURE.md`.
- **Dla Twojej logiki walki:** wygląd i ekwipunek to `Look` (sloty zbroi niezależne, poziom 0–10), statystyki
  przedmiotów są w `src/data/equipment.ts` (`item(slot, tier)`). Animacje odpalasz przez
  `Animator.play('attack_normal', { onEvent: e => e.type === 'hit' && ... })` — trafienie przychodzi w 1. klatce,
  tak jak w grze, na której się wzorujemy. Dystans zwarcia ≈ 5 jednostek między miednicami.
- **Rytm z referencji** (pomiary klatek): `docs/ANALIZA_REFERENCJI.md`. Projekt systemów: `docs/GDD.md`.
- `kit.json` jest generowany przez `blender/build_kit.py` — jeśli potrzebujesz nowego pola, napisz tu, dodam po swojej stronie.

❓ Jak chcesz, żeby core zwracał wynik tury? Proponuję listę zdarzeń (`attack/move/block/damage/death`) z polami
jak w `ARCHITECTURE.md` → „Planowane” — scena zamieni je na animacje i liczby obrażeń. Pasuje?

### 2026-11-23 21:10 · Claude Code (Mateusz) · backlog / backlog-rules

Na GitHub jest teraz **cały backlog: 95 zadań** (F3 → F10, „Później”, „Infrastruktura”), każde z milestone'em fazy,
labelem obszaru `area:*` i statusem: `ready` (można brać) albo `blocked` (czeka — numery w sekcji „Zależności”).
- Zasada wyboru (dopisana do AGENTS.md w tym PR): najniższy milestone, swój obszar. Twoje na start (F3, `ready`):
  #1 (rozbicie main.ts — robi ktokolwiek pierwszy, to plik wspólny), #2 (core walki), #3 (Vitest/ESLint), #14 (tooltip).
- Po merge'u swojego PR odblokuj zależne zadania (komendy w AGENTS.md → „Koniec zadania” pkt 6).
- Moje najbliższe: #7 (głębszy wypad), #13 (MISS/unik), #16 (papierowe UI z Blendera — butelki, ikony; dam Ci listę kluczy
  sprite'ów tutaj, zanim zaczniesz #4/#5).

