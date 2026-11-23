# Analiza referencji — gameplay i animacja walki

Źródło: short YouTube `4Oyc2O7sz1k` (44 s, 1080x1920, 59.94 fps, nagranie gameplayu flashowej gry o gladiatorach).
Pliki: `ref_game/short/short.mp4`, wszystkie klatki `ref_game/short/frames_all/` (2640 szt., 360 px),
2 fps `frames_2fps/`, arkusze 2 fps `sheets/`, arkusze 10 fps samej areny `seq10/`, 30 fps ruchów `seq30/`
(`charge.jpg`, `normal.jpg`, `finish.jpg`, `death.jpg`).

> Referencja to materiał do nauki. Bierzemy z niej **zasady gry i rytm animacji**, nie grafikę, nazwy, postacie ani teksty.
> Wygląd robimy w naszym stylu papierowym (Blender Cycles, skill `papercraft-3d-short`).

## 1. Co jest w nagraniu (oś czasu)
| czas | co się dzieje |
|---|---|
| 0–1 s | miniatura |
| 1–4 s | plansza „CHAMPION BATTLE”: czerwona sylwetka, napis wjeżdża z boków (slide-in 2 linii w przeciwnych kierunkach), wyjazd |
| 4–6 s | ekran porównania: 2 portrety, statystyki obu (level, armour, hitpoints, strength, agility, attack, defence, vitality, charisma, stamina), przyciski ✓ / ucieczka |
| 6–35 s | walka: radialne menu akcji, ruch, skok, szarża, ataki quick/normal/power, bloki, liczby obrażeń |
| 33–36 s | dobicie: odcięcie głowy, przeciwnik pada, kałuża, zwycięzca unosi broń, napis „Arena champion … has fallen!” |
| 36–41 s | nagroda: zwój z bronią pokonanego („weź / zostaw”), pasek doświadczenia do następnego poziomu |
| 41–44 s | powrót do miasta (hub z budynkami: arena, kowal, magia, kościół, zbrojmistrz) |

## 2. Zasady walki (to kopiujemy jako bazę i rozbudowujemy)
- **Arena 1D**: dwie postacie na jednej linii, liczy się odległość. Kamera stała, scena 16:10 (800x500 we flashu).
- **Tury**: gracz → przeciwnik → gracz… Każda akcja to jedna tura.
- **Radialne menu** wokół gracza: 6 przycisków po bokach (ruch do przodu, ruch do tyłu, skok, szarża, odpoczynek, prowokacja,
  ataki) — zestaw zmienia się z odległością (z daleka: ruch/skok/szarża; w zwarciu: Power / Normal / Quick + inne).
- **Szansa trafienia na przycisku** („Normal (60% chance)”, „Quick (79% chance)”, „Charge (39%)”) — gracz widzi % przed decyzją.
- **Dwa zasoby** jako butelki: HEALTH (czerwona) i ENERGY (niebieska). Ataki i ruchy kosztują energię, odpoczynek ją odnawia.
- **Typy ataku**: Quick (wysoka szansa, małe obrażenia, mało energii), Normal (średnio), Power (niska szansa, duże obrażenia).
  Szarża: akrobatyczny skok na wroga, dużo energii, może go odrzucić. Skok: szybkie zbliżenie, wysokość zależy od zręczności.
- **Wynik ciosu**: liczba obrażeń w czerwonym „rozprysku”, „BLOCK” z ikoną tarczy, „CRITICAL” nad liczbą, chybienie.
- **Koniec walki**: animacja dobicia + nagroda (broń pokonanego championa) + XP.
- **Tooltipy** (żółte karteczki) przy każdym przycisku z opisem i kosztem.

## 3. Rytm animacji (zmierzone na klatkach)
Gra chodzi w **30 fps** (co druga klatka nagrania to duplikat: 686 odstępów po 2 klatki z 60). Animacje to klasyczny
**cut-out**: sztywne części ciała obracane wokół przegubów, tweeny między pozami kluczowymi. To idealnie pasuje do
papierowej wycinanki.

| ruch | przebieg (klatki @30 fps) | uwagi |
|---|---|---|
| **Otwarcie menu** | 1–2 kl. puste czerwone kółka wystrzeliwują ze środka postaci na okrąg, 1–2 kl. pojawiają się ikony | całość ~0.1 s, bez easingu |
| **Zamknięcie menu** | po kliknięciu menu znika w 1 kl. i od razu jest pierwsza poza ruchu | zero opóźnienia między kliknięciem a akcją |
| **Normal attack** | kl. 0: od razu poza uderzenia (brak antycypacji); kl. 1–2 mała szara liczba; kl. 3–4 liczba „wybucha” w czerwony rozprysk z lekkim przeskalowaniem; kl. 4–10 głęboki wypad przytrzymany (follow-through ~0.25 s); kl. 11–13 powrót; kl. 14–15 neutral | cios „trafia” w 1. klatce — szybkość daje snap |
| **Odpowiedź wroga** | ~0.5 s po końcu ciosu gracza; „BLOCK” tekst → srebrna tarcza „wskakuje” (2 kl.) nad głową; zamach nad głowę 3–4 kl., cios w dół 2 kl., przytrzymanie 4 kl., powrót 4 kl. | tura wroga ~1.2–1.5 s |
| **Szarża** | kl. 0–1 przysiad + broń w górę (antycypacja 2 kl.); kl. 2–8 wybicie i łuk w górę; kl. 9–15 lot w dół, ciało prawie poziomo, broń przed sobą; kl. 16–22 leży/ślizga się u stóp wroga (gdy nie odrzuci); kl. 23–27 wstaje; kl. 28+ stoi | łącznie ~1.4 s |
| **Skok w przód** | przysiad 2 kl. → lot łukiem ~10 kl. → lądowanie w przysiadzie 3 kl. → wstanie 3 kl. | dystans zależny od zręczności |
| **Trafienie (reakcja)** | odchylenie tułowia/głowy 2–3 kl., czerwone drobinki | brak odrzutu przy zwykłym ciosie |
| **Liczba obrażeń** | pojawia się w klatce trafienia, rośnie w 2–3 kl. z przestrzeleniem, **zostaje** nad głową do następnego trafienia, na końcu walki zanika zmniejszając się (~4 kl.) | obok mała tarcza z liczbą pancerza |
| **Dobicie (dekapitacja)** | cios → głowa leci łukiem w lewo i spada (~5 kl.); ciało chwieje się ~6 kl., pada do tyłu ~8 kl.; kałuża rozlewa się ~10 kl.; zwycięzca od razu w pozie triumfu z bronią w górze (trzymana do końca) | |
| **Idle** | prawie bezruch; postacie stoją, broń w ręce | u nas dodamy lekkie „oddychanie” papieru (1–2 px, 0.5 Hz) |
| **Plansza tytułowa** | 2 linie napisu wjeżdżają z przeciwnych stron (~6 kl.), trzymają się ~1 s, wyjeżdżają dalej w tę samą stronę | |

### Wnioski dla naszej animacji
1. **30 fps, cut-out, pozy kluczowe + tweeny** — renderujemy części ciała w Cycles, animujemy w grze (szkielet 2D).
2. **Zero antycypacji przy zwykłych ciosach**, antycypacja 2 kl. tylko przy skoku/szarży. Trafienie w pierwszej klatce.
3. **Follow-through przytrzymany** (~8 kl.) — to on czyta się jako „mocny cios”, nie sam zamach.
4. **UI „wystrzeliwuje”** (menu, liczby, tarcze) w 1–3 kl. z lekkim przeskalowaniem, nic nie wjeżdża wolno.
5. **Kamera stała** w oryginale — u nas opcjonalnie dodamy papierowy „juice”: mikro-zoom 2–3 % przy krytyku,
   lekkie trzęsienie przy szarży, dryf kamery 2–5 px/s jak w skillu papercraft. Domyślnie subtelnie.
6. Na papierze zamiast krwi: **rozdarcie i czerwone papierowe strzępki / bibuła** (ustawienie „gore” on/off).

## 4. Inne ekrany z obrazków użytkownika (do zaprojektowania po swojemu)
- **Kreator postaci**: imię, kolor skóry, fryzura, zarost, losuj; 8 atrybutów z punktami do rozdania.
- **Miasto (hub)**: ulica z budynkami jako przyciski (arena, kowal, sklep magiczny, świątynia, zbrojmistrz).
- **Sklep**: sprzedawca w dymku po lewej, panel-zwój z przedmiotami po prawej, zakładki stats/armour/items/info, cena i rabat z charyzmy.
- **Zaklinacz**: wybór żywiołu (ogień, natura/trucizna, śmierć…) i mocy zaklęcia, cena.
- **Świątynia**: mikstury i zaklęcia do slotów ekwipunku.
