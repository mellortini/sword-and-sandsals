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
| 1 | 1 | 59,6% | 36,9 | 68,2% | 30,5 |
| 5 | 3 | 58,6% | 28,3 | 80,4% | 20,9 |
| 12 | 6 | 55,4% | 24,2 | 95,2% | 13,2 |
| 25 | 9 | 59,0% | 24,9 | 98,8% | 10,4 |

Przewaga pełnej zbroi szybko rośnie w tych scenariuszach. Kolejny pomiar powinien porównać sąsiednie tiery i mieszane zestawy, bliższe rzeczywistej ścieżce gracza.

## Złoto i ceny

Cena obejmuje pięć części kompletu i miecz jednego tieru przy Charm 5. Symulator zakłada bazową wypłatę `15 + 5 × poziom przeciwnika` oraz rzeczywiste premie i monety od tłumu. Wiersze używają wyników agresora przeciw obrońcy z takim samym sprzętem. Liczby walk odpowiadają startowi od zera i wydaniu wszystkich wpływów na sprzęt. Kampania może też zapewniać łup, stan początkowy złota, leczenie i inne koszty.

| Poziom | Cena zestawu | Złoto na wygraną | Złoto na próbę | Wygrane do zakupu | Próby do zakupu |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 59 | 24,5 | 14,9 | 3 | 4 |
| 5 | 415 | 46,6 | 27,4 | 9 | 16 |
| 12 | 3 445 | 85,4 | 47,5 | 41 | 73 |
| 25 | 19 975 | 163,1 | 96,4 | 123 | 208 |

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
