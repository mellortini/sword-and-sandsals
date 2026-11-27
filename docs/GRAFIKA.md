# Grafika do gry: jak dodać albo zmienić asset

Dla ludzi i agentów (Claude Code, Codex). Opisuje grafikę **gry**. Sam styl opisuje skill
[`papercraft-3d-short`](../.claude/skills/papercraft-3d-short/SKILL.md); jego części o filmach do gry nie są potrzebne.

Przed pierwszym renderem: `SETUP.md` → punkt 5 (Blender 5.3, Python, pobranie i rozpakowanie tekstur).
Wszystkie komendy uruchamiaj w katalogu repo. `<blender>` to ścieżka do programu. Blender działa w tle (`-b`),
dodatki ani Blender MCP nie są potrzebne.

## Wzorce wyglądu
Wzorcem są nasze rendery z repo. Zanim zaczniesz, otwórz te, które są najbliżej tego, co robisz:

| co robisz | z czym porównać |
|---|---|
| część postaci, zbroja, broń | `assets/chars/kit/sprites/*.png`, widoki `?view=lineup` i `?view=wardrobe` |
| twarz, fryzura, zarost | widok `?view=faces` |
| tło, budynek, diorama | `assets/bg/arena.png` |
| animacja z nowym sprite'em | `?view=anim`, `?view=strip&clip=attack_normal&every=2` |

Gdy grafiki to wskaźniki LFS (pliki po ~130 B): `git lfs pull`.

## Zasady stylu
- Papierowa wycinanka: kształt to płaska warstwa z grubością. **Bez konturów.** Krawędzie pokazuje światło i cień.
- Każdy materiał ma fakturę papieru, tektury albo folii. Gładki jednolity kolor wygląda jak błąd.
- Warstwy leżą prawie na sobie (`pc.ZK = 0.65`). Nie dawaj dwóch nakładających się warstw na tym samym `z`
  (czarne plamy), a spód warstwy nie może wchodzić w tę pod nią.
- Słońce z lewej góry, cień pada w prawo w dół. Ustawia je `sl.setup()`; nie dodawaj własnego bez powodu.
- Metaliczna jest tylko folia (`sl.foil`). Sprite'y renderują się bez HDRI, więc zwykły metal wyszedłby czarny.

## Układ współrzędnych i skala
- X w prawo, Y w górę, Z w stronę kamery (kolejność warstw papieru).
- 1 jednostka ≈ 1/10 wzrostu gladiatora. `sl.PPU = 90` pikseli na jednostkę.
- Część postaci budujesz w układzie jej kości: **staw (pivot) w punkcie (0, 0)**. `sl.render_coll()` sam przycina kadr
  i zwraca rozmiar oraz pivot w pikselach.
- Kształty ciała do dopasowania są w `blender/kit.py` (`torso_outline()`, `ARM_UP`, `ARM_LO`, `LEG_UP`, `LEG_LO`, `FOOT`).

## Klocki
| co | gdzie |
|---|---|
| warstwa papieru | `kit.L(coll, punkty, materiał, z, h, nazwa)`; z otworami: `pc.layer(..., holes=[...])` |
| elipsa, zaokrąglony prostokąt | `kit.E(rx, ry, x, y)`, `kit.R(szer, wys, promień, x, y, obrót)` |
| postrzępiona krawędź, przycięcie, łuk | `sl.torn`, `sl.clip_x`, `sl.clip_y`, `sl.arc_pts` |
| pas owinięty wokół kończyny | `sl.band`, w zbrojach `armor.lb` |
| kolorowy papier | `sl.tex_paper(nazwa, kolor, fiber='washi' \| 'water' \| 'white')` |
| karton, skóra, drewno | `sl.tex_board(nazwa, kind='kraft' \| 'brown' \| 'flute' \| 'craft', tint=...)` |
| metal | `sl.foil(nazwa, kolor)` |
| wzór (pikowanie, kolczuga) | `sl.pc.pattern_mat(...)` |
| gotowe materiały gry | `armor.M('steel')`, `armor.M('leather')`, `armor.M('bronze')` i inne z `blender/armor.py` |

Materiały z `sl` są zapamiętywane po parametrach. Nowy wariant dostaje nową nazwę.
`blender/vendor/pc_lib.py` to biblioteka gry. Kopii w skillu nie używa żaden skrypt gry.

## Zmiana części postaci
`blender/build_kit.py` renderuje listę `jobs`: klucz sprite'a → funkcja budująca, barwienie, czy to część głowy.

| co | gdzie dodać lub zmienić | klucz |
|---|---|---|
| zbroja | funkcja w `blender/armor.py` o nazwie `<slot><tier>[_<element>]`; rejestruje ją `pieces()` | `helmet3`, `armor3_torso` |
| ciało, twarz, fryzura, zarost | `blender/kit.py` (`BODY`, `FACES`, `HAIRS`, `BEARDS`) | `body_torso`, `face2_nose`, `hair4_front` |
| zupełnie nowy rodzaj części | wpis w `jobs`, warstwa w `LAYERS` (`build_kit.py`) i obsługa w `src/rig/PaperRig.ts` | według `ARCHITECTURE.md` |

- Sloty i elementy zbroi są w `armor.SLOTS` i `armor.PIECE_BONE`. Funkcja o innej nazwie nie zostanie wyrenderowana.
- Skórę i włosy renderuj na **neutralnym papierze** (`kit.neutral()`, `kit.HAIR_N`) z barwieniem `skin` albo `hair`.
  Kolor nadaje gra.
- Nowa broń: zanim zaczniesz, sprawdź w otwartych PR-ach (`gh pr list`) i w `AGENT_CHAT.md`, jak dodaje się broń.

### Render
```
<blender> -b --python blender/build_kit.py -- 16 helmet3          # szybki podgląd
<blender> -b --python blender/build_kit.py -- 32 helmet3,face2    # wybrane części, jakość do commita
<blender> -b --python blender/build_kit.py -- 32                  # cały zestaw
```
Liczba to próbki Cycles. Filtr działa po **początku nazwy**: `helmet1` wyrenderuje też `helmet10`, a `armor1` także
`armor10_*`. Żeby tego uniknąć przy elementach zbroi, podaj pełny klucz z końcówką (np. `armor1_torso`).

Przy filtrze `kit.json` jest scalany. Nie edytuj ręcznie `kit.json` ani `assets/` (zasady: `AGENTS.md` → „Pliki wspólne”).

### Atlasy
Serwer dev pokazuje pojedyncze PNG, a build produkcyjny strony WebP z `assets/chars/kit/atlas/`.
`build_kit.py` po renderze sam uruchamia `npm run assets:atlas` (wymaga wcześniej `npm ci`). Ze zmienną
`KIT_NO_ATLAS=1` pomija ten krok; wtedy uruchom go przed commitem. Sprite razem z marginesem 2 px z każdej strony
musi zmieścić się na stronie 1024 × 1024. Commituj razem: sprite'y, `kit.json` i cały katalog `atlas/`.

## Nowy asset poza zestawem postaci (UI, popiersia, tła)
Osobny skrypt w `blender/`, wynik w osobnym folderze w `assets/`. Najmniejszy działający przykład (`blender/example.py`):

```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
import kit  # noqa: E402

sl.setup(samples=32)
coll = sl.new_coll('sign')
kit.L(coll, kit.R(3.0, 1.2, 0.2, 0.0, 0.0), sl.tex_board('sign', 'kraft'), 0.0, 0.12, 'board')
kit.L(coll, kit.E(0.12, 0.12, -1.2, 0.0), sl.foil('nail', '#c9ccd2'), 0.13, 0.06, 'nail')
info = sl.render_coll(coll, os.path.join(sl.GAME, 'out', 'sign.png'))
print('SPRITE', info)
```
```
<blender> -b --python blender/example.py
```
Do prób zapisuj w `out/` (poza git), gotowe assety w `assets/<folder>/`. Jeśli gra potrzebuje pivotu albo prostokątów
kliknięcia, zapisz je obok w manifeście JSON. Tło z perspektywą i głębią ostrości: wzoruj się na `blender/arena.py`.
PNG, JPG i WebP idą przez Git LFS automatycznie (`.gitattributes`).

## Kontrola przed PR
1. `npm run dev` i obejrzyj widoki z tabeli „Wzorce wyglądu”. Zrzut: dodaj `&shot=nazwa` → `out/nazwa.png`.
2. Porównaj obok siebie z istniejącym assetem: faktura w skali 1:1, kierunek cienia, brak konturów i czarnych plam,
   dopasowanie do ciała w ruchu (`?view=anim`).
3. `npm run lint`, `npm test`, `npm run build`.
4. Zmiana wyglądu postaci może zmienić wzorce testów wizualnych (`lineup`, `faces`, `strip`). Zamierzoną zmianę
   zatwierdza się nowymi wzorcami z Ubuntu 24.04 (`AGENTS.md` → „Komendy projektu”).
5. Zrzut „przed i po” do opisu PR oraz wpis w `AGENT_CHAT.md`.

## Czego tu jeszcze nie ma
- Pipeline nie został potwierdzony na drugim komputerze (zadanie #8).
- Dźwięk i głosy: workflow ComfyUI i próbek głosu nie ma w repo.
