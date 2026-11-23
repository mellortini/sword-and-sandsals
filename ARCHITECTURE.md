# ARCHITECTURE.md

## Technologia
TypeScript 7 + Vite 8 + PixiJS 8 (WebGL). Obsługiwane wersje Node.js są w `package.json` (`engines`).
Grafika: Blender 5.3 (Cycles, skrypty Python) → PNG + JSON.
Gra to statyczna strona (`npm run build` → `dist/`).

## Jak to działa
1. **Blender** renderuje każdą część postaci osobno (część ciała, element zbroi, twarz, fryzura…) jako PNG z zapisanym
   punktem obrotu i pisze manifest `assets/chars/kit/kit.json` (kości, kolejność warstw, sprite'y, listy wariantów).
2. **PaperRig** (runtime) składa z tych części kukiełkę cut-out: kości → sprite'y w kolejności warstw, barwienie skóry
   i włosów per piksel (części skóry/włosów są renderowane na neutralnym papierze), miękki cień papieru pod każdą
   warstwą, wszystko do jednej RenderTexture na postać.
   Build produkcyjny ładuje sprite'y zestawu z bezstratnych stron WebP grupowanych według części wyglądu i poziomu
   zbroi. Atlasy powstają przez `npm run assets:atlas`. Na urządzeniach obsługiwanych dotykiem RenderTexture używa rozdzielczości 1×.
3. **Animator** odtwarza klipy (30 fps, klatki kluczowe obrotów kości + ruch korzenia + zdarzenia `hit`/`block`/…).
4. **Sceny** w `src/scenes/` układają arenę, postacie, efekty i HTML-owe panele. `src/main.ts` inicjalizuje Pixi,
   dopasowuje widok do okna, wybiera scenę z `?view=` i obsługuje `?shot=`. `src/scenes/common.ts` przekazuje scenom
   kontekst i aktualizuje kukły we wspólnej pętli renderowania.

## Mapa modułów
| folder / plik | moduł | właściciel | uwagi |
|---|---|---|---|
| `blender/` (+ `blender/vendor/pc_lib.py`) | pipeline grafiki | Mateusz | `sprite_lib` (materiały, render części), `kit` (ciało, twarze, włosy, zarost), `armor` (10 kompletów), `build_kit` (render + kit.json), `arena` (tło) |
| `art_src/` | źródła grafiki | Mateusz | `blenderkit/*/` poza git (licencja), w git tylko `assets.json`, `tex_stats.json` |
| `assets/` | wyrenderowane assety | Mateusz | generowane — nie edytować ręcznie; `assets/chars/hero/` = stara kukła z F1 (nieużywana, do usunięcia w przyszłości) |
| `tools/` | narzędzia | Mateusz | `fetch_blenderkit.py` |
| `src/rig/` | PaperRig, Kit (składanie postaci) | Mateusz | |
| `src/anim/` | klipy i Animator | Mateusz | |
| `src/ui/fx.ts` | efekty walki (liczby obrażeń, BLOCK) | Mateusz | |
| `src/core/` *(nowy)* | logika gry bez renderu: walka, tury, AI, statystyki, RNG z ziarnem, zapis | kolega | czysty TS, testy (Vitest) |
| `src/data/` | dane gry: przedmioty, wrogowie, sklepy | kolega | `equipment.ts` — 50 przedmiotów, tier 1–10 |
| `src/ui/` (poza `fx.ts`) *(nowe)* | HUD, menu radialne, panele, ekrany | kolega | |
| `src/scenes/` | sceny gry: arena, garderoba | kolega | `arena.ts` (`/`), `wardrobe.ts` (`?view=wardrobe`) |
| `src/scenes/common.ts` | wspólne narzędzia scen | wspólne | wymiary, `SceneContext`, tworzenie i renderowanie kukieł |
| `src/scenes/dev/` | narzędzia wizualne | Mateusz | `lineup.ts`, `faces.ts`, `animLab.ts`, `strip.ts` (`?view=lineup`, `faces`, `anim`, `strip`) |
| `docs/` | projekt gry | wspólne | każdy dopisuje do swoich dokumentów; `ROADMAP.md` = plik wspólny |

## Pliki wspólne (osobny mały PR, label `shared-files`)
`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`,
`assets/chars/kit/kit.json` (tylko przez `build_kit.py`), `.gitignore`, `.gitattributes`, `.github/**`,
`AGENTS.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`. (`AGENT_CHAT.md` — dopisuje każdy, w każdym PR.)

## Interfejsy między modułami
- **kit.json** (Blender → runtime): `bones` (nazwa, rodzic, przesunięcie stawu w jednostkach, y w górę), `layers`
  (kolejność rysowania: kość + slot + element, `back` = przyciemniona tylna kończyna), `sprites` (rozmiar, pivot, `tint`:
  skin/hair/null, opcjonalne `alpha`), listy `skins`, `hair_colors`, `faces` (z `jaw` do dopasowania brody), `hairs`,
  `beards`, `sets`, reguły `hood_helmets` / `hair_top_back`. Klucze sprite'ów: `body_<część>`, `face<i>_<część>`,
  `hair<i>_front|back`, `beard<i>`, `<slot><tier>[_<element>]`, `weapon_<nazwa>`.
- **Wygląd postaci** (`src/rig/PaperRig.ts` → `Look`): `skin, face, hair, hairColor, beard` (0–9) + `helmet, armor,
  shoulders, greaves, boots` (0 = brak, 1–10 = poziom, **sloty niezależne**) + `weapon`. `PaperRig.setLook(look)` (async).
- **Przedmioty** (`src/data/equipment.ts`): `Item { id, slot, tier, name, armor, weight, price, minLevel, bonus }`,
  `item(slot, tier)`. Slot = jeden z `EQUIP_SLOTS`. Logika walki ma czytać pancerz stąd, nie z grafiki.
- **Animacja** (`src/anim/Animator.ts`): `play(clip, { distance, commit, then, onEvent, onEnd, blend, speed })`, `busy`,
  `home` (pozycja postaci). Zdarzenia klipów: `hit`, `block`, `swing`, `land`, `impact`. Nazwy klipów: `idle, walk_fwd,
  walk_back, jump, charge, attack_quick, attack_normal, attack_power, block, hit, knockback, taunt, rest, death, victory`.
- **Planowane** (F3): `src/core` zwraca wynik akcji jako zdarzenia (np. `{ type:'attack', kind:'normal', hit:true,
  damage:9, crit:false, blocked:false }`), scena tłumaczy je na `Animator.play` + `fx`. Core nie importuje Pixi.
- Jednostki: 1 jednostka ≈ 1/10 wzrostu postaci; dystans między postaciami w jednostkach (zwarcie ≈ 5.0 między miednicami).

## Decyzje
| data | decyzja |
|---|---|
| 2026-11-23 | Web: TS + Vite + PixiJS 8; grafika z Blendera Cycles jako części cut-out, animacja w grze (nie renderujemy klatek). |
| 2026-11-23 | Cień papieru liczony w grze: blend `multiply` z alfą (ZERO, ONE) — cień tylko na już narysowanym papierze. |
| 2026-11-23 | Skóra i włosy renderowane neutralnie, barwione per piksel w grze (dowolny kolor bez renderu). |
| 2026-11-23 | 10 kompletów zbroi × 5 niezależnych slotów; można mieszać poziomy; pełny komplet = +10 % pancerza. |
| 2026-11-23 | Animacje 30 fps; zwykły cios trafia w 1. klatce, follow-through przytrzymany ~8 kl. (pomiar referencji). |
| 2026-11-23 | Tekstury BlenderKit poza git (licencja royalty-free nie pozwala redystrybuować); pobiera je `tools/fetch_blenderkit.py`. |
| 2026-11-23 | `pc_lib.py` skopiowany do `blender/vendor/` — pipeline nie zależy od plików spoza repo. |
| 2026-11-23 | Git LFS dla grafik; `.blend` jako `lockable`; squash merge; PR + zielone CI do `main`. |
| 2026-11-23 | Rozmowa agentów w `AGENT_CHAT.md` (dopisywanie na końcu, `merge=union`). |
| 2026-11-23 | `SETUP.md` = lista instalacji i sprawdzeń dla nowego komputera / agenta (linkowana z README i AGENTS.md). |
