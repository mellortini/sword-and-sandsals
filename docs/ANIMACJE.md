# F2 — animacje walki (2026-11-23)

## System
- `src/anim/clip.ts` — format klipu: klatki kluczowe (30 fps) z obrotami kości w stopniach, przesunięciem korzenia (x do przodu, y w górę), easingiem segmentu i zdarzeniami (`hit`, `block`, `swing`, `land`, `impact`). Brakujące kości przechodzą z poprzedniego klucza. Pomocnicze: `blade` = kąt miecza w świecie (gra liczy kość broni), stopy same trzymają się płasko na ziemi.
- `src/anim/Animator.ts` — odtwarzanie: płynne wejście z poprzedniej pozy (blend), ruch korzenia, `distance` (skaluje przesunięcie klipu do realnej odległości), `commit` (postać naprawdę się przemieszcza), zdarzenia, powrót do idle. Kontakt z podłożem: dla klatek „na ziemi” miednica jest podnoszona/opuszczana tak, by najniższa podeszwa stała na piasku (`PaperRig.soleLow`, kinematyka `PaperRig.fk`).
- `src/anim/clips.ts` — 15 klipów.
- `src/ui/fx.ts` — liczba obrażeń (mała szara w klatce trafienia → czerwony papierowy „wybuch” z przestrzeleniem w 2–3 kl., zostaje do następnego trafienia, CRITICAL), tarcza BLOCK.

## Klipy (klatki @30 fps)
| klip | długość | rytm |
|---|---|---|
| idle | 60 (pętla) | oddech papieru |
| walk_fwd / walk_back | 20 | krok 1.6 jednostki |
| jump | 24 | przysiad 3 → lot łukiem → lądowanie w przysiadzie (16) |
| charge | 36 | zamach 2 kl. → skok → nurkowanie z mieczem → trafienie (14) → ślizg → wstawanie z klęczek |
| attack_quick | 14 | pchnięcie od razu, trafienie 1, przytrzymanie do 6 |
| attack_normal | 16 | cięcie od razu, trafienie 1, wypad przytrzymany 2–10, powrót 11–16 (jak referencja) |
| attack_power | 26 | zamach nad głowę 5 kl., cios 2 kl. (trafienie 7), przytrzymanie do 16 |
| block | 18 | gardę w 2 kl. |
| hit | 16 | odrzut tułowia i głowy 2 kl. |
| knockback | 30 | odrzucenie po udanej szarży, potknięcie |
| taunt | 44 | miecz w górę, pięść pompuje |
| rest | 48 | zgarbiony oddech |
| death | 40 (trzyma) | chwiejba → ugięte kolana → upadek na plecy z odbiciem |
| victory | 12 (trzyma) | miecz w górę |

Porównanie rytmu normalnego ciosu z referencją: `out/compare_normal_attack.jpg`. Różnica: w oryginale wypad jest głębszy (niższy przysiad).

## Laboratorium
http://localhost:5180/?view=anim (`&tier=N` = komplet zbroi): przyciski dla każdej akcji, przeciwnik reaguje (trafienie / blok / odrzut), odpowiada atakiem, `finish` = dobicie + zwycięstwo, prędkość 1× … 0.1×.
Paski klatek: `?view=strip&clip=charge&every=2`.

## Lekcje
- Ukryty panel przeglądarki = stoi requestAnimationFrame. Testy: `app.ticker.update(T)` ręcznie co 1/30 s; opóźnienia w grze liczyć zegarem gry, nie `setTimeout`.
- Dystans zwarcia 5.0 jednostki (między miednicami); przy 3.3 postacie wchodziły w siebie.
