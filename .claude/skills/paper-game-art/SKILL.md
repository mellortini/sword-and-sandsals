---
name: paper-game-art
description: Grafika do tej gry (papierowa wycinanka renderowana w Blenderze Cycles). Użyj, gdy zadanie dodaje lub zmienia sprite'y, zbroje, broń, części postaci, ikony i elementy UI z Blendera, popiersia, tła albo cokolwiek w blender/ i assets/ (zadania area:art, a przy wyglądzie papieru także area:fx), albo gdy ktoś prosi o grafikę „w tym stylu”. Game art in the paper cut-out style. Not for videos (that is papercraft-3d-short).
---

# Grafika do gry w stylu papierowym

Przeczytaj [`docs/GRAFIKA.md`](../../../docs/GRAFIKA.md) i pracuj według niego. Tam są: wzorce wyglądu, zasady stylu,
skala i pivot, materiały, dodawanie części postaci i nowych assetów, atlasy i kontrola przed PR.

Najważniejsze:
- Wzorcem są rendery z repo (`assets/`, widoki `?view=lineup`, `faces`, `wardrobe`), nie film referencyjny.
- Pipeline gry to `blender/` z biblioteką `blender/vendor/pc_lib.py`. Skryptów ze skilla `papercraft-3d-short` gra nie używa.
- Obejrzyj każdy render i porównaj go z istniejącym assetem, zanim uznasz zadanie za gotowe.
