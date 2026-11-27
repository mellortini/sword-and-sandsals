# Balans Folded Glory

## Pomiar

Symulator używa faktycznego silnika walki, profili AI, katalogu sprzętu i cen sklepowych. Raport obejmuje 4 000 pojedynków na czterech poziomach w wersji silnika z ochroną przed serią pudeł (#158, baza e29df70). Każde zestawienie składa się z 250 par z zamianą stron, aby pierwszy ruch nie faworyzował jednego uczestnika. Pojedynek ma limit 300 akcji. W badaniu żaden nie doszedł do tego limitu.

Raport generuje polecenie PowerShell:

```powershell
npm test -- src/core/balance.test.ts --silent=false
```

## Walka

Porównanie AI używa takiego samego kompletnego wyposażenia po obu stronach. Porównanie pancerza używa dwóch agresorów z takimi samymi atrybutami i mieczami. Jeden ma pełny komplet, drugi zaczyna bez pancerza.

| Poziom | Tier | Wygrane agresora z obrońcą | Śr. akcji | Wygrane kompletu z brakiem pancerza | Śr. akcji |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 52,6% | 37,1 | 70,0% | 33,1 |
| 5 | 3 | 52,6% | 29,0 | 81,6% | 22,4 |
| 12 | 6 | 52,8% | 24,8 | 96,2% | 14,3 |
| 25 | 9 | 54,6% | 24,8 | 99,6% | 10,9 |

Stan po #282 (przed nim agresor wygrywał 59,6 / 58,6 / 55,4 / 59,0%).

Przewaga pełnej zbroi szybko rośnie w tych scenariuszach. Kolejny pomiar powinien porównać sąsiednie tiery i mieszane zestawy, bliższe rzeczywistej ścieżce gracza.

## Złoto i ceny

Cena obejmuje pięć części kompletu i miecz jednego tieru przy Charm 5. Symulator zakłada bazową wypłatę `15 + 5 × poziom przeciwnika` oraz rzeczywiste premie i monety od tłumu. Wiersze używają wyników agresora przeciw obrońcy z takim samym sprzętem. Liczby walk odpowiadają startowi od zera i wydaniu wszystkich wpływów na sprzęt. Kampania może też zapewniać łup, stan początkowy złota, leczenie i inne koszty.

| Poziom | Cena zestawu | Złoto na wygraną | Złoto na próbę | Wygrane do zakupu | Próby do zakupu |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 59 | 23,9 | 12,9 | 3 | 5 |
| 5 | 415 | 45,6 | 24,1 | 10 | 18 |
| 12 | 3 445 | 84,3 | 44,6 | 41 | 78 |
| 25 | 19 975 | 162,5 | 89,0 | 123 | 225 |

Stan po #282: agresor wygrywa rzadziej, więc na próbę przypada mniej złota (zakup zestawu wymaga więcej prób).

Ceny rosną szybciej niż wpływy z samych walk. Przed strojeniem późnych lig trzeba określić, ile wyposażenia zapewniają nagrody i jaki udział ma mieć zakup.

## Następne pomiary

- Wpływ pancerza przy sąsiednich tierach. [#164](https://github.com/mellortini/sword-and-sandsals/issues/164)
- Krzywa cen i nagród w wyższych ligach. [#163](https://github.com/mellortini/sword-and-sandsals/issues/163)

## Sąsiednie tiery i mieszane zestawy (#164)

Powtórzyłem pomiar na bazie `5839fd0`. W każdej komórce jest odsetek wygranych zawodnika w pełnym wyższym komplecie oraz średnia liczba akcji. Każdy wariant to 250 par z zamianą stron. Obaj zawodnicy mają ten sam profil, atrybuty i miecz. Łącznie odbyło się 12 000 walk, każda poniżej limitu 300 akcji.

- **Sąsiedni** — rywal nosi pełny komplet o tier niżej.
- **Mieszany** — rywal ma napierśnik i nagolenniki z wyższego tieru, a hełm, naramienniki i buty z niższego.
- **Tylko komplet** — obaj mają te same części. Rywal zachowuje bazowy pancerz tych części i ich ciężar. Odejmuje się od jego ochrony zaokrągloną premię +10%.
- **Tylko ciężar** — obaj mają tę samą ochronę. Rywal ma ciężar mniejszy o 4 jednostki.

| Tiers | AI | Sąsiedni | Mieszany | Tylko komplet | Tylko ciężar |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 / 2 | Agresor | 59,6% / 24,2 | 55,4% / 25,0 | 53,2% / 25,2 | 50,0% / 25,8 |
| 3 / 2 | Obrońca | 61,8% / 29,6 | 60,4% / 30,3 | 56,0% / 31,0 | 50,0% / 31,9 |
| 6 / 5 | Agresor | 64,0% / 20,0 | 62,8% / 20,4 | 57,6% / 21,0 | 50,0% / 21,7 |
| 6 / 5 | Obrońca | 63,0% / 25,0 | 61,0% / 25,3 | 54,2% / 26,1 | 50,0% / 26,7 |
| 9 / 8 | Agresor | 63,8% / 20,5 | 63,8% / 20,5 | 60,4% / 21,2 | 50,0% / 22,2 |
| 9 / 8 | Obrońca | 64,2% / 26,0 | 64,2% / 26,0 | 59,4% / 26,7 | 50,0% / 27,9 |

| Tiers | Wyższy komplet | Baza wyższego | Niższy komplet | Mieszany |
| --- | ---: | ---: | ---: | ---: |
| 3 / 2 | 11 | 10 | 7 | 9 |
| 6 / 5 | 31 | 28 | 23 | 25 |
| 9 / 8 | 61 | 55 | 50 | 50 |

Sam bonus kompletu daje 53,2–60,4% wygranych. Zmiana tieru dodaje jeszcze różnicę w bazowym pancerzu. Na tierach 9 i 8 dwa warianty rywala mają po 50 pancerza i dają identyczny wynik przy tych samych ziarnach. Sam ciężar daje dokładnie 50,0% w każdej kontroli, bo obecny silnik i AI nie używają ciężaru do rozstrzygania akcji.

```powershell
npm test -- src/core/armourBalance.test.ts --silent=false
```

## Tarcza z HP (#273)

Tarcza jest przedmiotem drugiej ręki (`shield1..10`, płatnerz). HP: 24, 32, 42, 56, 72, 92, 112, 138, 168, 204. Udany blok
nadal daje 0 obrażeń, ale zabiera tarczy surową siłę ciosu: `attackPower × moc ataku` (quick 0,7, normal 1, power 1,6, charge 1,2),
bez pancerza i krytyka. Przy 0 HP tarcza pęka do końca walki. W tym kroku szansa bloku się nie zmienia.

Symulator (`npm test -- src/core/balance.test.ts --silent=false`) ma dwa nowe zestawienia: ta sama postać z tarczą swojego tieru
przeciw postaci bez tarczy, raz jako obrońca, raz jako agresor. Oba dają dokładnie 50,0% wygranych na każdym poziomie, a
dotychczasowe tabele się nie zmieniły (cena zestawu liczy tylko pięć części zbroi). Tarcza zaczyna wpływać na wynik dopiero
razem ze słabszym blokiem bez tarczy (#274).

Dodatkowa próba (400 walk na wiersz, tarcza przeciw agresorowi bez tarczy):

| Poziom | Tier | Udane bloki tarczą na walkę (obrońca) | Walki z pękniętą tarczą (obrońca) | Bloki do pęknięcia |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 0,41 | 2,0% | 2,5 |
| 5 | 3 | 0,36 | 0,5% | 3,0 |
| 12 | 6 | 0,30 | 0,0% | — |
| 25 | 9 | 0,43 | 0,3% | 3,0 |

AI blokuje rzadko (agresor ~0,07 udanego bloku na walkę), więc tarcza pęka głównie graczowi, który często blokuje.
Wytrzymałość 2–3 mocnych bloków trzeba sprawdzić ponownie w #274, gdy blok bez tarczy osłabnie, a AI zacznie liczyć się z tarczą.

## Słabszy blok bez tarczy (#274)

Bez całej tarczy (brak, pęknięta, broń dwuręczna) blok ma `PARRY_SHARE = 0,5` szansy z tarczą
(`blockChance` w `core/combat.ts`). Przy Guard 10: 65% z tarczą, 33% samym ostrzem. AI waży blok proporcjonalnie do tej szansy.
Karta Blok pokazuje teraz szansę bloku tak jak ataki procent trafienia.

Pomiar (250 par na wiersz, ten sam symulator):

| Poziom | Tier | Agresor z obrońcą (przed → po) | Tarcza: obrońca | Tarcza: agresor |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 59,6% → 61,2% | 50,0% | 50,6% |
| 5 | 3 | 58,6% → 62,0% | 49,4% | 49,2% |
| 12 | 6 | 55,4% → 58,8% | 48,4% | 48,6% |
| 25 | 9 | 59,0% → 59,8% | 50,2% | 49,6% |

Obrońca bez tarczy słabnie o 1–3 punkty. Tarcza w rękach AI nadal nie zmienia wyniku (różnice w granicach szumu),
bo AI blokuje rzadko, a blok zabiera całą turę: lepsza szansa bloku nie zwraca straconego ataku. Dla gracza, który
blokuje świadomie, różnica jest duża (dwa razy więcej udanych bloków i kontr). Żeby tarcza liczyła się także dla AI,
trzeba osobno podnieść wartość bloku (np. tańszy blok albo częstsze kontry) — poza zakresem #274.
Tabela „Walka” wyżej pokazuje stan sprzed #274.

## Odcięcie ręki z tarczą (#275)

`severChance` w `core/combat.ts`: tylko mocny cios albo szarża, tylko gdy obrońca **nie blokował w chwili ataku**, tylko
w całą tarczę i tylko przy przewadze Might napastnika: 0,5 pkt procentowego za punkt przewagi, topór ×1,5, maksymalnie 5%.
Skutek: tarcza na 0 (blok samym ostrzem, #274) i stan `torn`. Rzut losuje się tylko przy szansie > 0, więc walki bez
tych warunków (w tym cały symulator, który ma równe Might) losują dokładnie jak wcześniej i tabele wyżej się nie zmieniają.
Test: przy przewadze 20 Might około 5% trafionych mocnych ciosów odcina rękę; przy bloku 0 na 3000 ciosów.

## Tempo: agresor kontra obrońca bliżej 50/50 (#282)

Analiza (2000 walk na wariant, agresor kontra obrońca, równy sprzęt bez tarcz, start: agresor 60,5%):

| Strategia | Agresor wygrywa |
| --- | ---: |
| Darmowy blok | 60,4% |
| Blok odnawia 4 energii | 60,0% |
| Nieudany blok połowi obrażenia | 59,5% |
| Częstsze kontry | 60,3% |
| Udany blok zabiera napastnikowi 5 energii | 60,1% |
| Droższa szarża (14) | 60,0% |
| Obrońca w AI mniej pasywny | 55,8% |
| Mocny cios droższy (11) | 56,9% |
| Mocny cios mniej celny (48) | 56,6% |
| AI obrońcy + mocny cios 11 + celność 48 | 52,9% |

Zmiany bloku nic nie dają: udanych bloków jest 0,11 na walkę. O wyniku decyduje tempo: mocny cios zadaje najwięcej
obrażeń na turę (agresor ~8,5 HP na użycie wobec ~6 HP szybkiego), a energia rzadko go hamuje; agresor zadaje pierwszy
cios w 60% walk. Wdrożone: profil `defender` w AI mniej pasywny (więcej ataków, blok 1,2 → 1,0), mocny cios kosztuje
11 energii (było 8) i ma celność 48 (było 55). Wynik w pełnym symulatorze: 52,6 / 52,6 / 52,8 / 54,6% (średnio 53,2%),
obrońca z tarczą przeciw agresorowi bez tarczy 46–51%. Dotyczy to też gracza: mocny cios jest teraz droższy i mniej pewny.
