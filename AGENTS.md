# AGENTS.md — zasady dla agentów AI (Claude Code, Codex) i ludzi

Dwie osoby (Mateusz + kolega), każda ze swoim agentem, rozwijają grę równolegle. Te zasady są po to,
żeby nie wchodzić sobie w drogę. Jeden plik prawdy: `CLAUDE.md` tylko importuje ten plik.

**Pierwsza sesja na nowym komputerze?** Najpierw `SETUP.md` — co zainstalować i jak sprawdzić, że wszystko działa.

Na start każdej sesji przeczytaj: ten plik → `ARCHITECTURE.md` (mapa modułów, pliki wspólne) →
**ostatnie ~10 wpisów w `AGENT_CHAT.md`** (co robi drugi agent, pytania do Ciebie).

## Start pracy
```
git checkout main && git pull
gh issue list --label ready --no-assignee --label area:core --milestone "F3 Walka"   # wolne zadania: swój obszar, najniższa faza
gh issue list --label ready --no-assignee                       # wszystkie wolne
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
**w swoim obszarze** (`area:core|data|ui|scenes` = kolega, `area:art|anim|fx|audio` = Mateusz, `area:infra` = oboje).
Zadania z labelem `blocked` czekają na inne (sekcja „Zależności” w opisie) — nie bierz ich.

## Komendy projektu
```
npm ci                     # instalacja (zgodna z package-lock.json)
npm run dev                # serwer dev, http://localhost:5180
npm run typecheck          # tsc --noEmit
npm run build              # typecheck + vite build (to samo co CI)
```
Sprawdzanie wizualne: `?view=wardrobe | lineup | faces | anim | strip&clip=<nazwa>`; zrzut kadru: `&shot=nazwa` → `out/nazwa.png`.
Jeśli okno przeglądarki jest ukryte, requestAnimationFrame stoi — w testach przesuwaj zegar ręcznie
(`app.ticker.update(t)` co 1/30 s) i renderuj kukły przed `extract`.
Grafika (Blender, tylko gdy zadanie tego wymaga): patrz README → „Grafika”.

## Granice
- **Zmieniaj tylko pliki modułu z zadania** (mapa w `ARCHITECTURE.md`). Potrzebujesz czegoś w cudzym module →
  napisz w `AGENT_CHAT.md` albo załóż Issue, nie edytuj sam.
- **Pliki wspólne** — tylko w osobnym, małym PR z labelem `shared-files` (nie mieszaj z pracą nad modułem):
  `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`,
  `assets/chars/kit/kit.json` (generowany — zmieniaj przez `blender/build_kit.py`, nie ręcznie),
  `.gitignore`, `.gitattributes`, `.github/**`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`.
  Wyjątek: `AGENT_CHAT.md` — dopisujesz w każdym PR (patrz niżej).
- Nigdy nie pushuj do `main`, nigdy nie merguj sam, nie rób force-push na cudze gałęzie
  (na własną gałąź tylko `git push --force-with-lease` po rebase).
- Nie bierz zadań przypisanych do kogoś innego; nie zmieniaj cudzych PR-ów.
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
5. Merge robi człowiek (squash). Gałąź usuwa się sama.
6. Po merge'u odblokuj zadania, które czekały na Twoje (gdy WSZYSTKIE ich zależności są zamknięte):
   ```
   gh issue list --label blocked --search "\"po #<nr>\" in:body"
   gh issue edit <nr-zależnego> --add-label ready --remove-label blocked
   ```

## Gałęzie i rozmiar zadań
- Jedna gałąź = jedno Issue. Nazwa: `<nr>-krotki-opis`.
- PR najpóźniej po 1–2 dniach pracy. Duże zadanie → podziel na mniejsze Issues (`gh issue create` z szablonu „Zadanie”, label `ready`).
- Zablokowany przez inne zadanie → label `blocked` + wpis w `AGENT_CHAT.md`.
