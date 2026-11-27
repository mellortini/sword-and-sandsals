# Modułowy zestaw postaci (2026-11-23)

Kukła gladiatora złożona z wymiennych części. Wszystko renderowane w Cycles (`blender/build_kit.py`, ~75 s za 162 sprite'y),
składane w grze przez `src/rig/PaperRig.ts`.

## Co jest w zestawie
| kategoria | warianty | plik / jak |
|---|---|---|
| skóra | 10 kolorów (Porcelain … Ebony) | części ciała renderowane na **neutralnym papierze**, barwione w grze per piksel (`Kit.texture`, wzmocnienie może być > 1) — można dodać dowolny kolor bez renderu |
| twarz | 10: Stoic, Brute, Youth, Veteran (blizna), Cheerful, Sly, Grim, Elder (zmarszczki), Wild, Noble | `kit.FACES`: kształt szczęki (szerokość/długość/kanciastość), oczy, powieki (zaspane/złe/chytre), brwi, nos (łza/guzik/rzymski/długi/szeroki), usta |
| fryzura | 10: Bald, Crop, Curly, Long, Mohawk, Bun, Receding, Spiky, Braids, Slicked | `kit.HAIRS`, każda ma część przednią i tylną (za ciałem) |
| kolor włosów | 10 (+ dowolny) | barwienie jak skóra; brwi i broda biorą ten sam kolor |
| zarost | 10: Clean, Stubble (półprzezroczysty), Moustache, Handlebar, Full beard, Goatee, Boxed, Mutton chops, Braided, Chin strap | `kit.BEARDS`; gra rozciąga brodę do szczęki wybranej twarzy |
| zbroje | 10 kompletów × 5 slotów (hełm, zbroja, naramienniki, nagolenniki, buty) | `armor.py`; zbroja = napierśnik + spódniczka + karwasze, nagolenniki = goleń + nakolannik, buty = stopa + cholewka |

### Komplety (tier 1 → 10)
| # | komplet | pancerz (suma) | cena (suma) | min. poziom |
|---|---|---|---|---|
| 1 | Beggar's Rags — szmaty, owijki | 5 | 40 g | 1 |
| 2 | Scrap Leather — rzemienie, czapka, sandały | 6 | 125 g | 2 |
| 3 | Padded Linen — pikowany len, kaptur | 10 | 300 g | 4 |
| 4 | Studded Hide — ćwiekowana skóra | 15 | 655 g | 6 |
| 5 | Bronze Recruit — brązowy pektorał, hełm z małym grzebieniem | 21 | 1 300 g | 9 |
| 6 | Iron Scale — łuska, żelazna galea | 28 | 2 500 g | 12 |
| 7 | Chain Veteran — kolczuga, czepiec kolczy | 35 | 4 600 g | 16 |
| 8 | Legion Plate — segmentata, galea z czerwonym grzebieniem | 45 | 8 200 g | 20 |
| 9 | Champion's Bronze — kirys anatomiczny, hełm z szerokim rondem i płetwą | 55 | 14 500 g | 25 |
| 10 | Gilded Legend — złoto, lew, purpurowa szarfa, pióropusz | 66 | 25 000 g | 30 |
Dane: `src/data/equipment.ts` (nazwy, pancerz, waga, cena, poziom, bonusy; pełny komplet = +10 % pancerza). To pierwszy szkic balansu.

## Zasady składania (runtime)
- Kolejność warstw i kości: `kit.json` → `layers` (włosy z tyłu → tylna ręka → nogi → tułów + zbroja → biodra + spódniczka → głowa: baza, oczy, powieki, brwi, broda, nos, włosy, hełm → przednia ręka, broń, dłoń).
- Hełm chowa przednie włosy; kaptury (tier 3, 7) chowają wszystkie; kok i zaczesane do tyłu chowają się pod każdym hełmem (`hood_helmets`, `hair_top_back`).
- Tylne kończyny = te same sprite'y przyciemnione (`BACK_TINT`).

## Komendy
```
<blender> -b --python blender/build_kit.py -- 32                 # cały zestaw (~75 s na GPU)
<blender> -b --python blender/build_kit.py -- 32 helmet9,face3   # tylko wybrane (kit.json scalany)
```
Gra: http://localhost:5180 — `?view=wardrobe` (garderoba/kreator), `?view=lineup` (10 kompletów), `?view=faces` (arkusz wariantów),
`?` arena z losowymi gladiatorami (`?tier=7` = wszyscy w danym komplecie).

## Lekcje
- Zrzuty z ukrytego panelu przeglądarki: requestAnimationFrame stoi → przed `extract` wyrenderować kukły ręcznie.
- Maski Pixi psuły `extract` → portrety robione wycinkiem tekstury kukły (`PaperRig.crop`).
- Zarost jako pełna warstwa wyglądał jak broda → alpha 0.42 bez cienia.
