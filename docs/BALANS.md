# Balans Folded Glory

## Pomiar

Symulator używa faktycznego silnika walki, profili AI, katalogu sprzętu i cen sklepowych. Raport obejmuje 4 000 pojedynków na czterech poziomach. Każde zestawienie składa się z 250 par z zamianą stron, aby pierwszy ruch nie faworyzował jednego uczestnika. Pojedynek ma limit 300 akcji. W badaniu żaden nie doszedł do tego limitu.

Raport generuje polecenie PowerShell:

```powershell
npm test -- src/core/balance.test.ts --silent=false
```

## Walka

Porównanie AI używa takiego samego kompletnego wyposażenia po obu stronach. Porównanie pancerza używa dwóch agresorów z takimi samymi atrybutami i mieczami. Jeden ma pełny komplet, drugi zaczyna bez pancerza.

| Poziom | Tier | Wygrane agresora z obrońcą | Śr. akcji | Wygrane kompletu z brakiem pancerza | Śr. akcji |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 54,6% | 35,9 | 67,6% | 29,8 |
| 5 | 3 | 57,2% | 27,6 | 77,8% | 20,2 |
| 12 | 6 | 54,8% | 23,4 | 92,0% | 13,2 |
| 25 | 9 | 57,4% | 24,1 | 98,2% | 10,4 |

Przewaga pełnej zbroi szybko rośnie w tych scenariuszach. Kolejny pomiar powinien porównać sąsiednie tiery i mieszane zestawy, bliższe rzeczywistej ścieżce gracza.

## Złoto i ceny

Cena obejmuje pięć części kompletu i miecz jednego tieru przy Charm 5. Symulator zakłada bazową wypłatę `15 + 5 × poziom przeciwnika` oraz rzeczywiste premie i monety od tłumu. Wiersze używają wyników agresora przeciw obrońcy z takim samym sprzętem. Liczby walk odpowiadają startowi od zera i wydaniu wszystkich wpływów na sprzęt. Kampania może też zapewniać łup, stan początkowy złota, leczenie i inne koszty.

| Poziom | Cena zestawu | Złoto na wygraną | Złoto na próbę | Wygrane do zakupu | Próby do zakupu |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 59 | 24,7 | 13,8 | 3 | 5 |
| 5 | 415 | 46,5 | 26,7 | 9 | 16 |
| 12 | 3 445 | 85,1 | 46,8 | 41 | 74 |
| 25 | 19 975 | 162,1 | 93,2 | 124 | 215 |

Ceny rosną szybciej niż wpływy z samych walk. Przed strojeniem późnych lig trzeba określić, ile wyposażenia zapewniają nagrody i jaki udział ma mieć zakup.

## Następne pomiary

- Wpływ pancerza przy sąsiednich tierach. [#164](https://github.com/mellortini/sword-and-sandsals/issues/164)
- Krzywa cen i nagród w wyższych ligach. [#163](https://github.com/mellortini/sword-and-sandsals/issues/163)
