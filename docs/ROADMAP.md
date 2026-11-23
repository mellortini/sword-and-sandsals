# Roadmapa — gra „Folded Glory” (tytuł roboczy)

Turowa gra gladiatorska w duchu klasycznych flashowych gier arenowych (zasady walki i pętla rozwoju),
ale **wyglądem papierowa** (nasz styl papercraft z Blendera Cycles) i **dużo szersza** w systemach i świecie.

Dokumenty:
- `ANALIZA_REFERENCJI.md` — co zmierzyłem w shorcie (zasady walki, rytm animacji klatka po klatce)
- `GDD.md` — zamysł gry i wszystkie systemy (walka, postać, ekwipunek, miasta, ekonomia, rozwój)
- `FABULA.md` — świat i fabuła w tle
- ten plik — technologie, pipeline grafiki, skille/agenci, fazy i kamienie milowe

---

## 1. Filar techniczny: papier z Cycles, animacja w grze

Cycles nie renderuje w czasie rzeczywistym, więc **nie renderujemy klatek animacji**. Robimy to tak, jak robiły to gry flash,
tylko z papierowymi częściami:

1. W Blenderze (Cycles, `pc_lib.paper_mat`, ziarno papieru, światło z lewej-góry) renderujemy **każdą część ciała osobno**
   (głowa, tułów, ramię, przedramię, dłoń, udo, łydka, stopa, + każdy element zbroi/broni) jako PNG z przezroczystością,
   kamerą ortograficzną na wprost, z zapisanym punktem obrotu (pivot) w JSON.
2. W grze składamy z nich **kukiełkę cut-out** (szkielet 2D: kości + sloty), animujemy obrotami części — dokładnie
   jak w referencji (30 fps, pozy kluczowe + tweeny).
3. **Głębia papieru w czasie rzeczywistym**: każda warstwa rzuca miękki cień na warstwę pod spodem (shader cienia
   z przesunięciem w prawo-dół, kolor bordowy, nie czarny — zasada z STYLE_BIBLE). Dzięki temu cień jest poprawny w każdej pozie.
4. **Tła** (arena, miasto, wnętrza sklepów) to pełne sceny Cycles rozbite na 3–5 warstw paralaksy (niebo, trybuny z publicznością,
   mur, piasek, pierwszy plan) z DOF wypalonym w renderze.
5. **Ekwipunek = podmiana części** na slotach kukiełki (hełm, naramienniki, napierśnik, karwasze, nagolenniki, buty, broń, tarcza,
   peleryna). Każdy przedmiot jest widoczny na postaci — to klucz rozbudowy „nie 5 mieczy na krzyż”.

Efekt: wygląd z Cycles, płynność i elastyczność gry 2D, setki kombinacji ekwipunku bez renderowania animacji.

## 2. Stos technologiczny

| warstwa | wybór | dlaczego |
|---|---|---|
| język | **TypeScript** | już go używamy (Remotion/three), typy dla danych gry |
| bundler / dev | **Vite** | szybki hot-reload, build statyczny na web |
| render 2D | **PixiJS v8** (WebGL/WebGPU) | najszybszy 2D na web, batching sprite'ów, filtry (cień papieru, rozmycie) |
| kukiełka / animacja | **własny runtime „PaperRig”** (~500 linii) | kości, sloty, skórki (ekwipunek), ścieżki klatek kluczowych z easingiem, zdarzenia (hit, sfx). Spine jest płatny, DragonBones martwy |
| edytor animacji | **Blender** (armatura 2D na płaskich częściach) + skrypt eksportu do JSON | animujemy tam, gdzie mamy pipeline; opcjonalnie ruch z nagrań przez RTMPose (już działa w projekcie) |
| UI menu (sklepy, ekwipunek, statystyki) | **HTML/CSS nad canvasem** (Preact) z papierowymi teksturami z Cycles (9-slice `border-image`) | formularze, siatki i tooltipy są w DOM dużo prostsze i dostępne |
| UI walki (menu radialne, liczby, butelki) | Pixi | musi się animować razem ze sceną |
| logika gry | **czysty TS bez renderu** (`core/`), deterministyczny RNG z ziarnem | testowalna, symulacja tysięcy walk do balansu, powtórki, w przyszłości PvP asynchroniczne |
| dane | moduły TS/JSON + walidacja **zod** | przedmioty, wrogowie, umiejętności, sklepy, questy jako dane, nie kod |
| zapis gry | **IndexedDB** (idb-keyval) + eksport/import pliku | działa offline, przeglądarka i telefon |
| dźwięk | **Howler.js** | cichy papierowy foley (szelest, cięcie, zgniecenie), muzyka, kwestie NPC |
| głosy NPC | **Qwen3-TTS VoiceClone przez ComfyUI** (EN) | ten sam pipeline co w filmach |
| testy | **Vitest** (logika, balans), **Playwright** (dymny test UI), skill **emulator-telefonu** (telefony/tablety) | |
| atlasy | `maxrects-packer` + własny skrypt → PNG/WebP (później KTX2) | |
| dystrybucja | 1) web / itch.io (PWA) 2) **Tauri** — desktop / Steam 3) **Capacitor** — Android/iOS | jeden kod na wszystko |

Rozdzielczość projektowa **1920x1080 poziomo** (gra jest pozioma jak oryginał), części renderowane 2x pod ekrany retina.
Na telefonie: wymuszony poziom + większe przyciski radialnego menu.

### Struktura repo (planowana)
```
game/
  docs/            ROADMAP, GDD, FABULA, ANALIZA_REFERENCJI
  blender/         sprite_lib.py (na bazie pc_lib), parts_*.py (postacie/zbroje/bronie), bg_*.py (tła), export_rig.py, export_anim.py
  art_src/         .blend kukiełek i animacji
  assets/          wyrenderowane PNG + atlasy + rig/anim JSON (generowane)
  src/
    core/          logika: walka, statystyki, przedmioty, AI, RNG, ekonomia, zapis (zero Pixi)
    rig/           PaperRig: szkielet, skórki, odtwarzanie animacji, cień papieru
    scenes/        arena, miasto, sklepy, kreator, mapa świata
    ui/            Preact: panele, ekwipunek, tooltipy
    data/          items, enemies, skills, shops, story
  tools/           symulator balansu, podgląd kukiełki („rig lab”), packer atlasów
  tests/
```

## 3. Pipeline grafiki (Blender → gra)
1. **Projekt postaci** na papierze: proporcje kukiełki (głowa ~14 % wzrostu, mocne barki jak w referencji, ale nasze kształty),
   paleta papierów (gładki, kratka, prążek, tektura falista — `pattern_mat`).
2. **`sprite_lib.py`**: ortho kamera, przezroczyste tło, jedno słońce z lewej-góry jak w `pc_lib`, części jako
   `layer()` z prawdziwą grubością (krawędź papieru widoczna), bez cienia rzucanego na tło (cień robi gra).
3. **Render części** headless (`D:/blender/blender.exe -b`), 4070 SUPER/OptiX, mała rozdzielczość do podglądu, pełna na końcu.
4. **Post** (`post.py` w wersji dla sprite'ów: ziarno, lekki grade, bez winiety) → **atlas** + `rig.json` (pivoty, kolejność warstw).
5. **Animacje**: armatura 2D w Blenderze na płaszczyznach z teksturami części → klatki kluczowe → `export_anim.py` → `anim/*.json`.
   Timingi z `ANALIZA_REFERENCJI.md` (30 fps, trafienie w 1. klatce, przytrzymany follow-through).
6. **Tła**: sceny Cycles 1920x1080 (+zapas na paralaksę), osobny render każdej warstwy z alfą.
7. **Rig lab** (strona w przeglądarce): podgląd kukiełki, przełączanie ekwipunku i animacji, porównanie obok klatek referencji.

## 4. Skille i agenci, których użyjemy
| do czego | skill / agent |
|---|---|
| styl, materiały papieru, Cycles, post | **`papercraft-3d-short`** (pc_lib, pattern_mat, gold_mat, post.py) — baza całego wyglądu |
| ruch z nagrań (np. nagrane przez Ciebie ciosy, prawdziwy szermierz) | **`reference-scene-rebuild`** (RTMPose-x, retarget kątów na stały rig, pętla porównania) |
| szkielet i animacja w Blenderze | `rigging`, `animation` |
| projekty przeciwników, ras, bestii | `character-archetypes`, `creature-artist` |
| tła, miasto, wnętrza | `environment-artist`, `set-dressing`, `lighting`, `rendering` |
| efekty (ogień, iskry, papierowe strzępki) | `vfx-fx` (renderowane klatki) + cząsteczki Pixi |
| testy na telefonie | `emulator-telefonu` |
| kod gry | agenci `lead-programmer` (architektura), `gameplay-programmer` (systemy walki), `technical-artist` (shader cienia papieru, atlasy) |
| dźwięk | `audio-director`, `sound-designer` (zgodnie z zasadą: cicho, papierowy foley) |
| dostępność | `accessibility-specialist` (rozmiar tekstu, daltonizm, sterowanie klawiaturą) |
| **nowy skill do zrobienia** | `paper-game-sprites` — spisany pipeline części → atlas → rig → animacja, gdy F1–F2 się ustabilizują (jak zrobiliśmy z filmami) |

## 5. Fazy i kamienie milowe

Każda faza kończy się czymś, co możesz obejrzeć i ocenić. Nic nie renderuję i nie generuję bez Twojego sygnału.

### F0 — Preprodukcja (teraz)
- [x] analiza shorta klatka po klatce, rytm animacji (`ANALIZA_REFERENCJI.md`)
- [x] roadmapa, technologie, zamysł, fabuła
- [ ] **Twoje decyzje**: tytuł, poziom „gore”, priorytet platform (web/PC/telefon), język UI (jeszcze otwarte)

### F1 — Test wyglądu (gate: akceptujesz look) — ZROBIONE 2026-11-23, czeka na ocenę
Stan: `game/docs/F1_TEST_WYGLADU.md`, zrzuty `game/out/f1_arena.png`, `f1_compare.png`.
- jedna kukiełka gladiatora: ~16 części wyrenderowanych w Cycles + 2 bronie + 1 hełm
- tło areny w 4 warstwach (trybuny z papierową publicznością)
- złożenie w Pixi z cieniem papieru, 1 poza statyczna
- porównanie: nasza klatka obok klatki z referencji (kompozycja) i obok stilli z papercraft (materiał)

### Zrobione poza kolejnością (2026-11-23)
- modułowy zestaw postaci: 10 skór, twarzy, fryzur, kolorów włosów, zarostów + 10 kompletów zbroi (5 slotów) z cenami — `docs/ZESTAW_POSTACI.md`
- prototyp garderoby/kreatora (`?view=wardrobe`) — część F4/F5

### F2 — PaperRig + 12 animacji bazowych — ZROBIONE 2026-11-23 (15 klipów, laboratorium), opis `docs/ANIMACJE.md`
- runtime kości/slotów/skórek, odtwarzanie, zdarzenia
- eksport z Blendera; animacje: idle, krok w przód/tył, skok, szarża, quick/normal/power, blok, trafienie, prowokacja, śmierć, triumf
- rig lab; weryfikacja timingów z tabelą z analizy

### F3 — Prototyp walki (pierwsza grywalna walka)
- logika tur, dystans 1D, energia/zdrowie, szanse trafienia, krytyki, bloki
- menu radialne z % szansy i tooltipami, papierowe butelki HP/EN, liczby obrażeń, ekran porównania przed walką
- proste AI, ekran zwycięstwa/porażki
- **kamień milowy: „da się wygrać pierwszą walkę”**

### F4 — Postać i progresja
- kreator (imię „wpisywane atramentem”, papier skóry: kolor + wzór, fryzury, zarost, twarze), 8 atrybutów
- poziomy, XP, punkty, zapis/odczyt gry

### F5 — Miasto i ekonomia (= MVP)
- hub pierwszego miasta, kowal, płatnerz, zaklinacz, świątynia, trener, tawerna
- ekwipunek widoczny na kukiełce, inwentarz, ceny z charyzmą
- **MVP: pełna pętla walka → złoto → zakupy → mocniejsza walka, ~10 przeciwników, 1 champion**

### F6 — Rozbudowa walki
- rodziny broni z własnymi zestawami ruchów (miecz, topór, młot, włócznia, sztylety, dwuręczne, sieć+trójząb, rzucane)
- trafianie w strefy ciała (głowa/tułów/nogi) a pancerz strefowy
- efekty stanu: krwawienie/rozdarcie, ogłuszenie, podpalenie, przemoczenie, strach
- **przychylność tłumu** (meter + bonusy + złoto), prowokacje, efektowne ruchy
- drzewka umiejętności, zaklęcia w slotach, mikstury

### F7 — Treść i fabuła akt 1–2
- 5 lig/turniejów pierwszego miasta, championi z własnym stylem walki, nemezis pamiętający poprzednie starcia
- bestie (papierowy lew, niedźwiedź), pierwszy boss
- rzadkości i afiksy przedmiotów, zestawy, kuźnia (ulepszanie z materiałów)

### F8 — Świat: kolejne miasta, akty 3–5
- mapa podróży (papierowa mapa rozkładana jak origami), 4 regiony z innym papierem i stylem walki
- zakończenie (wybór „zdania do przepisania”), New Game+

### F9 — Szlif
- dźwięk i muzyka, głosy NPC (ComfyUI), juice (mikro-zoom, strzępki, wstrząs), samouczek
- dostępność, lokalizacja (EN + PL), wydajność na telefonach, achievementy

### F10 — Wydanie
- web/itch.io (PWA) → Tauri (Steam) → Capacitor (Android)

### Później (pomysły na rozwój)
- własna szkoła gladiatorów (ludus): rekrutacja, trening, wystawianie podopiecznych
- asynchroniczne PvP (walka z zapisanymi buildami innych graczy — działa dzięki deterministycznej logice)
- walki drużynowe 2v2, wyścigi rydwanów jako minigra, wydarzenia sezonowe, wsparcie modów (dane w JSON)

## 6. Ryzyka i jak je ograniczamy
| ryzyko | środek |
|---|---|
| cut-out z Cycles wygląda „płasko” albo nie pasuje do teł | F1 jako bramka — najpierw jedna kukiełka + tło, decyzja zanim zrobimy resztę |
| wymiana ekwipunku psuje stawy (szpary, nachodzenie) | standard kukiełki: stałe pivoty i zakładki papieru na stawach; każdy przedmiot renderowany na tym samym szablonie |
| eksplozja liczby sprite'ów | przedmioty z wariantów koloru/wzoru papieru (tint + `pattern_mat`), nie każdy osobno modelowany |
| balans przy rozbudowanych systemach | logika bez renderu + symulator 10 000 walk w Vitest |
| rozrost zakresu | MVP = F1–F5; reszta dopiero po zagraniu w MVP |
