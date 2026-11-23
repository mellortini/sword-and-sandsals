# Folded Glory (tytuł roboczy)

Turowa gra gladiatorska w przeglądarce: zasady walki jak w klasycznych flashowych grach arenowych
(dystans 1D, tury, % szansy trafienia, zdrowie i energia), wygląd **papierowej wycinanki** renderowanej
w Blenderze (Cycles) i składanej w grze jak kukiełka cut-out.

Stan (2026-11-23): wygląd (F1), modułowa postać (10 skór / twarzy / fryzur / kolorów włosów / zarostów,
10 kompletów zbroi w 5 niezależnych slotach), 15 animacji walki z laboratorium (F2). Dalej: F3 — grywalna walka.
Plan i projekt: [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/GDD.md`](docs/GDD.md), [`docs/FABULA.md`](docs/FABULA.md).

## Pliki dla współpracowników i agentów AI
| plik | po co |
|---|---|
| [`SETUP.md`](SETUP.md) | **pierwsze uruchomienie**: co zainstalować (Git, LFS, Node, gh, opcjonalnie Blender), jak sprawdzić, problemy |
| [`AGENTS.md`](AGENTS.md) | zasady pracy dla każdego agenta (Claude Code, Codex) i ludzi — **czytać na start każdej sesji** |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | mapa modułów, właściciele, pliki wspólne, interfejsy, decyzje |
| [`AGENT_CHAT.md`](AGENT_CHAT.md) | rozmowa między agentami: notatka po każdej zmianie, pytania, ostrzeżenia |
| `CLAUDE.md` | jedna linia `@AGENTS.md` (Claude Code czyta te same zasady co Codex) |

## Wymagania
- **Node.js 22 od 22.13, 24 lub 26+** (projekt rozwijany na Node 26) i npm
- **Git** + **Git LFS** (grafiki PNG/JPG/.blend idą przez LFS)
- **GitHub CLI** (`gh`) — zadania i PR-y
- tylko do generowania grafik: **Blender 5.3** (`D:/blender/blender.exe` u Mateusza; ścieżkę dopasuj) i Python 3.11+

## Uruchomienie
```
npm ci
npm run dev            # http://localhost:5180
npm run build          # typecheck + build produkcyjny do dist/
```
Widoki (parametr w adresie):

| adres | co |
|---|---|
| `/` | arena, dwóch losowych gladiatorów (`?tier=7` = komplet zbroi 7) |
| `/?view=wardrobe` | garderoba / kreator postaci |
| `/?view=lineup` | 10 kompletów zbroi obok siebie |
| `/?view=faces` | arkusz wariantów twarzy, fryzur, zarostu, skóry |
| `/?view=anim` | laboratorium animacji walki (przyciski akcji, reakcje, zwolnione tempo) |
| `/?view=strip&clip=charge&every=2` | klip klatka po klatce |
| `&shot=nazwa` | (dev) zapis kadru 1920×1080 do `out/nazwa.png` |

## Grafika (Blender)
Gotowe sprite'y są w repo (`assets/`), więc do uruchomienia gry Blender nie jest potrzebny. Żeby renderować:
```
python -I tools/fetch_blenderkit.py                                          # pobiera darmowe tekstury papieru (nie są w git — licencja)
D:/blender/blender.exe -b --disable-autoexec --python blender/unpack_blenderkit.py
D:/blender/blender.exe -b --python blender/build_kit.py -- 32                # cały zestaw postaci (~75 s, GPU)
D:/blender/blender.exe -b --python blender/build_kit.py -- 32 helmet9,face3  # tylko wybrane elementy
D:/blender/blender.exe -b --python blender/arena.py -- assets/bg/arena.png 1920 1080 128
```

Po zmianie sprite'ów zestawu odśwież atlasy produkcyjne przez `npm run assets:atlas`. Serwer dev korzysta z PNG,
a build produkcyjny pobiera odpowiednie strony WebP i może wrócić do PNG, jeśli atlas jest niedostępny.

## Start dla współpracownika
```
git lfs install
gh auth login                 # konto GitHub z dostępem do repo
gh repo clone mellortini/sword-and-sandsals
cd sword-and-sandsals
npm ci
npm run dev
```
Pełna lista z komendami sprawdzającymi: [`SETUP.md`](SETUP.md). Potem: przeczytaj `AGENTS.md` (Twój agent też), przejrzyj `ARCHITECTURE.md` i końcówkę `AGENT_CHAT.md`,
weź wolne zadanie: `gh issue list --label ready --search "no:assignee"`.
