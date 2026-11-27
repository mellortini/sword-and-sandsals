# Zamysł gry (GDD) — „Folded Glory” (tytuł roboczy)

**Jednym zdaniem:** turowa gra gladiatorska, w której Bezimienny niewolnik wywalcza swoje imię w średniowiecznym królestwie (narysowanym w stylu papierowej wycinanki) —
walka jak w klasycznych flashowych grach arenowych, ale z bogatym ekwipunkiem widocznym na postaci, stylami broni,
tłumem, żywiołami i światem do zwiedzenia.

Teksty w grze: angielski (z i18n, PL do dodania). Nazwy niżej są robocze.

## 1. Filary
1. **Czytelna walka turowa na dystansie 1D** — każda decyzja ma widoczny % szansy i koszt.
2. **Wszystko, co kupisz, widać na postaci** — papierowe części zbroi i broni na kukiełce.
3. **Papier to styl grafiki, nie świat**: fabuła dzieje się w zwykłym średniowieczu (`SCENARIUSZ.md`). Żywioły w walce to olejki, smoła,
   ogień grecki i alchemia; leczą medycy i bandaże.
4. **Szybki rytm**: akcja startuje w klatce kliknięcia, trafienie w pierwszej klatce, walka 2–5 minut.
5. **Długi rozwój**: od prowincjonalnego dołu do Wielkiej Areny, 4 regiony, dziesiątki championów.

## 2. Pętla gry
```
miasto (hub) → przygotowanie (zakupy, trening, zaklęcia) → arena (walka) → nagroda (złoto, XP, łup, sława)
     ↑                                                                                    │
     └──────────── poziom, nowe ligi, fabuła, nowe miasto ←──────────────────────────────┘
```

## 3. Postać
**Kreator**: imię (dosłownie wpisywane atramentem w Kodeks), papier skóry (kolor + faktura: gładki, czerpany, kraft,
gazetowy, kratka), twarz (kształt, oczy, nos, zarost, fryzura), budowa (smukły / średni / masywny — wpływa tylko na wygląd).

**Atrybuty (8)** — nazwy robocze, rola jak w klasyku + rozszerzenia:
| atrybut | wpływa na |
|---|---|
| Might (siła) | obrażenia, wymagania ciężkiej broni |
| Agility (zręczność) | długość skoku, unik, inicjatywa, uciekanie |
| Precision (atak) | szansa trafienia, krytyki |
| Guard (obrona) | szansa bloku, redukcja obrażeń |
| Vitality (witalność) | maks. zdrowie, odporność na krwawienie |
| Stamina (wytrzymałość) | maks. energia, regeneracja energii |
| Charm (charyzma) | ceny, **przychylność tłumu**, skuteczność prowokacji |
| Arcana (magia) | zaklęcia, zaklęte bronie, odporność na żywioły |

**Rozwój**: poziom 1–60, 5 pkt atrybutów na poziom, co 3 poziomy punkt umiejętności w drzewkach:
- *Blademaster* (ciosy, kontry, krytyki), *Bulwark* (tarcze, bloki, ciężkie zbroje), *Acrobat* (skoki, szarże, uniki),
- *Showman* (tłum, prowokacje, dobicia), *Inkmage* (zaklęcia), *Beastmaster* (później: walka ze zwierzętami i z towarzyszem).

## 4. Walka
**Plansza**: linia o długości ~20 jednostek, dystans decyduje o dostępnych akcjach (zwarcie ≤ 2, bliski ≤ 5, daleki).

**Akcje bazowe** (menu radialne, zależne od dystansu):
- ruch: krok w przód / w tył, skok (dystans z Agility), szarża (odrzut), wycofanie
- ataki: Quick / Normal / Power (+ ataki specjalne z broni i umiejętności)
- inne: odpoczynek (energia), prowokacja (tłum + gniew wroga), blok/postawa obronna, użyj przedmiotu, rzuć zaklęcie, poddaj się

**Rozszerzenia względem klasyka**:
- **Strefy trafienia**: głowa / tułów / nogi — różne szanse, pancerz strefowy, efekty (głowa: ogłuszenie, nogi: spowolnienie).
- **Rodziny broni** z własnymi ruchami: miecz (zbalansowany, kontra), topór (rozdarcie/krwawienie), młot (zgniecenie: łamie pancerz, ogłusza),
  włócznia (zasięg 3, trzymanie na dystans), sztylety (dwa ciosy na turę), dwuręczna (zamach obszarowy, wolna), sieć + trójząb (unieruchomienie),
  bronie rzucane (dzidy, noże — atak z dystansu), tarcze (blok, uderzenie tarczą).
- **Rodzaje obrażeń**: Cut (cięcie), Pierce (przebicie), Crush (zgniecenie) + żywioły **Fire** (bardzo groźny dla papieru, podpalenie),
  **Water** (przemoczenie: -pancerz, -szybkość), **Ink** (klątwa, wysysanie), **Wind** (odrzut).
- **Efekty stanu**: Torn (krwawienie/rozdarcie), Stunned, Burning, Soaked, Feared, Taped (leczenie w czasie), Enraged.
- **Przychylność tłumu** (0–100): rośnie od efektownych ruchów, krytyków, prowokacji, różnorodności; spada od nudy (odpoczynek w kółko, uciekanie).
  Wysoka daje bonus do obrażeń i złota oraz rzuty z trybun (bukiet = leczenie, moneta = złoto). Na końcu walki tłum decyduje „kciukiem” o losie przegranego championa (fabularnie).
- **Kontry i reakcje**: udany blok przy wysokim Guard daje okno na kontrę; szarża w przeciwnika z włócznią = nadzianie.
- **Dobicie**: przy niskim HP wroga pojawia się akcja „Finish” — efektowne dobicie (rozdarcie papieru, głowa odfruwa jak wycinanka; ustawienie gore: bibuła/konfetti vs „czerwony atrament”).

**Wrogowie i AI**: profile osobowości (agresor, obrońca, akrobata, showman, tchórz, mag), AI ocenia oczekiwaną wartość akcji
z losowością zależną od poziomu trudności. Championi mają unikalną broń, styl i kwestie.

**Bestie i bossowie**: papierowy lew (skoki), niedźwiedź z tektury (zgniecenia), sfora psów (2–3 cele), golem z kartonu, smok z lampionu (ogień!).

## 5. Ekwipunek i przedmioty
**Sloty widoczne na kukiełce**: hełm, naramienniki L/P, napierśnik, pas, karwasze, rękawice, nagolenniki, buty, peleryna, broń główna, druga ręka (tarcza/broń).
**Niewidoczne**: 2 amulety/pierścienie, 4 sloty na mikstury/zaklęcia w walce.

**Materiały = rzadkość papieru** (zamiast żelaza/stali; wygląda inaczej na kukiełce):
gazeta → karton → tektura falista → papier skórzany → laminat → folia złota → „żelazny papier” (legendarne, origami z metalicznym połyskiem).

**Rzadkości**: Common / Fine / Rare / Epic / Legendary + afiksy (np. „of Kindling” +fire, „Glued” +regeneracja), zestawy z bonusem.
**Zaklinanie**: żywioł × moc (słabe/średnie/silne), koszt rośnie z jakością przedmiotu.
**Kuźnia**: ulepszanie +1…+10 z materiałów z walk (strzępy, kleje, atrament, nici), rozbieranie przedmiotów.
**Łup z championów**: ich unikalna broń (jak w klasyku), ale z wyborem: weź / sprzedaj / rozłóż.

## 6. Miasto (hub) i budynki
Ulica-diorama z budynkami jako przyciski:
- **Arena** (ligi, turnieje, walki fabularne), **Weaponsmith** (broń), **Armourer** (zbroje),
- **Inkwell — zaklinaczka** (żywioły), **Temple of the Glue** (leczenie, mikstury: klej, taśma, zszywki),
- **Trainer** (przydział punktów, nauka umiejętności, reset za opłatą), **Tavern** (plotki, zadania poboczne, nemezis, zakłady),
- **Forge** (ulepszanie), **Mapa** (podróż do kolejnych miast, gdy odblokowane).
Sprzedawcy w dymkach po lewej, panel-zwój po prawej (układ jak w klasyku, ale nasz papierowy wygląd).

## 7. Ekonomia
Złoto z walk (× przychylność tłumu), sprzedaż łupów (30 % ceny), zakłady w tawernie, nagrody turniejowe.
Wydatki: sprzęt, zaklęcia, leczenie po walce (Temple), ulepszenia, podróże, opłaty wpisowe lig.
Rabat z Charm (do 25 %). Balans pilnowany symulatorem (krzywa złota vs ceny na poziom).

## 8. Struktura postępu
4 regiony × 5 lig (Bronze → Silver → Gold → Champion → Legend), w każdej lidze 4–6 przeciwników i champion.
Region 1 to MVP. Każdy region ma własny papier (wygląd), dominujący styl walki wrogów i jedną nową mechanikę.

## 9. Interfejs walki
- butelki HEALTH/ENERGY jako papierowe flakony z płynem (poziom się zmienia), nazwy na drewnianych tabliczkach — w naszym stylu
- menu radialne wystrzeliwuje w ~0.1 s, przy przycisku nazwa + % szansy, żółta karteczka-tooltip
- liczby obrażeń w papierowym „wybuchu” z wycinanki, pancerz w małej tarczy, „BLOCK”, „CRITICAL”, „MISS”
- miernik tłumu jako papierowe chorągiewki nad trybunami
- przed walką ekran porównania (portrety + statystyki), po walce zwój z nagrodą i pasek XP

## 10. Czego świadomie NIE robimy
- nie kopiujemy grafiki, nazw, postaci, tekstów ani ekranów oryginału — tylko gatunek i zasady
- brak walki w czasie rzeczywistym (tury to rdzeń)
- brak mikropłatności w rdzeniu
