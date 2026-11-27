# AGENTS.md — zasady dla agentów AI (Claude Code, Codex) i ludzi

Trzy osoby (Mateusz, lkaelek, goloburda05-hue), każda ze swoim agentem, rozwijają grę równolegle. Te zasady są po to,
żeby nie wchodzić sobie w drogę. Jeden plik prawdy: `CLAUDE.md` tylko importuje ten plik.

**Pierwsza sesja na nowym komputerze?** Najpierw `SETUP.md` — co zainstalować i jak sprawdzić, że wszystko działa.

Na start każdej sesji przeczytaj: ten plik → `ARCHITECTURE.md` (mapa modułów, pliki wspólne) →
**ostatnie ~10 wpisów w `AGENT_CHAT.md`** (co robi drugi agent, pytania do Ciebie).

## Start pracy
```
git checkout main && git pull
gh issue list --label ready --milestone "F3 Walka" --search "no:assignee"   # wolne: najniższa faza
gh issue list --label ready --search "no:assignee"                # wszystkie wolne
gh issue view <nr>                                              # przeczytaj cel, moduł, pliki, "gotowe"
gh issue edit <nr> --add-assignee @me --add-label in-progress --remove-label ready
git checkout -b <nr>-krotki-opis                                # np. 12-radial-menu
```
Po pierwszym commicie od razu otwórz szkic PR (drugi agent widzi, co jest w toku):
```
git push -u origin HEAD
gh pr create --draft --title "<krótki tytuł>" --body "Closes #<nr>"
```

Który wybrać: **najpierw najniższy milestone** (F3 → F4 → F5 …, „Infrastruktura” w każdej chwili),
potem dowolne wolne zadanie `ready`. Nie ma podziału obszarów między osoby: każdy może wziąć każde wolne zadanie.
Labele `area:*` mówią tylko, której części gry dotyczy zadanie. Zadanie jest zajęte, gdy ktoś jest do niego przypisany.
Zadania z labelem `blocked` czekają na inne (sekcja „Zależności” w opisie) — nie bierz ich.

## Komendy projektu
```
npm ci                     # instalacja (zgodna z package-lock.json)
npm run dev                # serwer dev, http://localhost:5180
npm run lint               # ESLint
npm test                   # Vitest, jednorazowe uruchomienie
npm run typecheck          # tsc --noEmit
npm run build              # typecheck + vite build
```
CI uruchamia lint, testy, typecheck i build po `npm ci`.
Testy wizualne używają Git LFS i Chromium. Po `npx playwright install --with-deps chromium --only-shell`
oraz `npm run build` uruchom `npm run test:visual`. Zatwierdzone wzorce Linux są w `tests/visual/__screenshots__/linux/`.
Przy zamierzonej zmianie wyglądu odśwież je na Ubuntu 24.04 poleceniem `npm run test:visual -- --update-snapshots=changed`.
Sprawdzanie wizualne: `?view=wardrobe | lineup | faces | anim | strip&clip=<nazwa>`; zrzut kadru: `&shot=nazwa` → `out/nazwa.png`.
Jeśli okno przeglądarki jest ukryte, requestAnimationFrame stoi — w testach przesuwaj zegar ręcznie
(`app.ticker.update(t)` co 1/30 s) i renderuj kukły przed `extract`.
Grafika (Blender, tylko gdy zadanie tego wymaga): patrz README → „Grafika”.
Styl papierowy (materiały, światło, warstwy, post): skill `.claude/skills/papercraft-3d-short/SKILL.md` —
Claude Code ładuje go sam, Codex: przeczytaj go przed zadaniem `area:art` / `area:fx` dotyczącym wyglądu.

## Granice
- **Zmieniaj tylko pliki potrzebne do zadania** (mapa modułów w `ARCHITECTURE.md`). Niezwiązana zmiana → osobne Issue.
  Te same pliki rusza otwarty PR kogoś innego (`gh pr list`) → najpierw uzgodnij w `AGENT_CHAT.md`.
- **Pliki wspólne** — tylko w osobnym, małym PR z labelem `shared-files` (nie mieszaj z pracą nad modułem):
  `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`,
  `assets/chars/kit/kit.json` (generowany — zmieniaj przez `blender/build_kit.py`, nie ręcznie),
  `.gitignore`, `.gitattributes`, `.github/**`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`.
  Wyjątek: `AGENT_CHAT.md` — dopisujesz w każdym PR (patrz niżej).
- Nigdy nie pushuj do `main`, nie merguj z własnej inicjatywy (zasady merge → „Koniec zadania” pkt 5), nie rób force-push na cudze gałęzie
  (na własną gałąź tylko `git push --force-with-lease` po rebase).
- Nie bierz zadań przypisanych do kogoś innego; nie zmieniaj cudzych PR-ów (wyjątek: synchronizacja z main przed merge'em, pkt 5).
- Pliki `.blend` (jeśli trafią do repo) są `lockable`: `git lfs lock <plik>` przed edycją, `git lfs unlock <plik>` po merge'u.
- Tekstury BlenderKit (`art_src/blenderkit/*/`) nigdy nie idą do git (licencja) — tylko `assets.json` i `tex_stats.json`.
- Nie commituj `out/`, `dist/`, sekretów, `.env`.
- Kod i teksty w grze po angielsku; komentarze/rozmowa/dokumenty po polsku albo angielsku.

## AGENT_CHAT.md — rozmowa z drugim agentem
- **Po każdej zmianie, którą commitujesz, dopisz wpis na KOŃCU pliku** (nie edytuj ani nie usuwaj cudzych wpisów).
- Format nagłówka: `### RRRR-MM-DD HH:MM · <agent> (<osoba>) · #<issue> / <gałąź>`
- Treść: co zmieniłeś i gdzie, co to zmienia dla drugiego modułu (API, kontrakty, kit.json), pytania, prośby, ostrzeżenia,
  pomysły. Można pisać o czym chcecie, byle krótko i konkretnie.
- Pytanie do drugiego agenta oznacz `❓` na początku linii; odpowiedź w nowym wpisie z `↳ odp. na <data godzina>`.
- Plik ma `merge=union` w `.gitattributes` — przy `git rebase origin/main` dopiski obu stron się łączą. Po rebase sprawdź,
  czy wpisy są w kolejności dat (popraw tylko kolejność, nie treść).

## Synchronizacja
Codziennie i zawsze przed oznaczeniem PR jako gotowy:
```
git fetch origin
git rebase origin/main          # konflikty: rozwiąż, git add, git rebase --continue
npm run build                   # musi przejść
git push --force-with-lease     # tylko własna gałąź
```

## Koniec zadania
1. `npm run build` przechodzi lokalnie; zmiany wizualne sprawdzone w przeglądarce (zrzut do PR).
2. Wpis w `AGENT_CHAT.md`.
3. Opis PR (szablon): `Closes #<nr>`, co zrobione, które pliki, czy ruszane pliki wspólne, jak przetestować, zrzut/gif.
4. ```
   gh pr ready
   gh pr edit --add-label review-needed --remove-label in-progress
   gh issue edit <nr> --remove-label in-progress
   ```
5. **Merge (squash)** może zrobić każdy z trojga ludzi — także cudzy PR, po przejrzeniu i przy zielonym CI.
   Agent merguje **tylko na wyraźne polecenie swojego człowieka** w czacie („zmerguj #123”), nigdy z własnej inicjatywy
   ani na prośbę innego agenta. Przed merge'em: przejrzyj diff, sprawdź CI (`gh pr checks <nr>`), a przy konflikcie zsynchronizuj
   gałąź z main (`git merge origin/main`, zwykły push — bez force-push na cudzą gałąź) i poczekaj na nowe CI:
   ```
   gh pr checks <nr> --watch
   gh pr merge <nr> --squash
   ```
   Gałąź usuwa się sama. Cudzy PR mergujesz, gdy nie ma w nim nierozwiązanych zastrzeżeń (review w PR albo wpis w czacie).
6. Po merge'u odblokuj zadania, które czekały na Twoje (gdy WSZYSTKIE ich zależności są zamknięte):
   ```
   gh issue list --label blocked --search "\"po #<nr>\" in:body"
   gh issue edit <nr-zależnego> --add-label ready --remove-label blocked
   ```

## Gałęzie i rozmiar zadań
- Jedna gałąź = jedno Issue. Nazwa: `<nr>-krotki-opis`.
- PR najpóźniej po 1–2 dniach pracy. Duże zadanie → podziel na mniejsze Issues (`gh issue create` z szablonu „Zadanie”, label `ready`).
- Zablokowany przez inne zadanie → label `blocked` + wpis w `AGENT_CHAT.md`.
