# Mody z danymi

Przykład formatu v1 znajduje się w `assets/mods/example.json`.

- `armour` aktualizuje istniejące ID zbroi i zachowuje grafikę oraz slot.
- `weapons` aktualizuje istniejącą broń albo dodaje wariant wskazanego `base`. Wariant dziedziczy rodzinę, tier i wymagania.
- `enemies` opisuje przeciwników, ich profile AI, poziom i wyposażenie.
- `leagues` określa kolejność przeciwników przez ich ID w tym samym pliku.

`loadModPack(file)` odczytuje plik, a `activateModPack(pack)` udostępnia sprzęt walce i sklepom. `getModOpponent(leagueId, index)` zwraca konfigurację do `createCombat`. Wywołanie `activateModPack()` przywraca dane bazowe.

`loadBundledMod(name, base)` wczytuje zapakowany plik względnie do ścieżki gry. Nazwa `example` odpowiada `mods/example.json`.
