# SETUP.md — pierwsze uruchomienie na nowym komputerze

Dla człowieka **i jego agenta AI**: zrób to raz, zanim weźmiesz pierwsze zadanie. Agent: przejdź listę po kolei,
uruchom komendy sprawdzające i zgłoś człowiekowi, czego brakuje (instalację programów zatwierdza człowiek).
Na koniec dopisz wpis w `AGENT_CHAT.md` (przedstaw się drugiemu agentowi).

## 1. Programy (wymagane)
| program | wersja | po co | Windows (winget) | macOS (brew) | Linux (Debian/Ubuntu) |
|---|---|---|---|---|---|
| Git | ≥ 2.40 | repo | `winget install Git.Git` | `brew install git` | `sudo apt install git` |
| Git LFS | ≥ 3.0 | grafiki PNG/JPG/.blend | w pakiecie Git for Windows | `brew install git-lfs` | `sudo apt install git-lfs` |
| Node.js | 22 od 22.13, 24 lub 26+ (zalecane 24 LTS) | gra (Vite, TypeScript), lint i testy | `winget install OpenJS.NodeJS.LTS` | `brew install node@24` | nodesource / nvm |
| GitHub CLI | ≥ 2.40 | zadania, PR-y | `winget install GitHub.cli` | `brew install gh` | `sudo apt install gh` |

Sprawdzenie (agent uruchamia i porównuje z tabelą):
```
git --version
git lfs version
node -v
npm -v
gh --version
```

## 2. Konto i tożsamość
```
git lfs install                         # raz na komputer
gh auth login                           # GitHub.com → HTTPS → zaloguj w przeglądarce
gh auth status                          # musi pokazać zalogowane konto
git config --global user.name  "Imię"
git config --global user.email "ID+login@users.noreply.github.com"   # adres noreply z GitHub → Settings → Emails
```
Konto musi mieć dostęp do repo `mellortini/sword-and-sandsals` (zaproszenie od Mateusza — zaakceptuj je na GitHub: https://github.com/mellortini/sword-and-sandsals/invitations).

## 3. Repo i gra
```
gh repo clone mellortini/sword-and-sandsals
cd sword-and-sandsals
git lfs pull                            # grafiki (gdyby klon pobrał tylko wskaźniki LFS)
npm ci
npm run build                           # to samo co CI — musi przejść
npm run dev                             # http://localhost:5180
```
Sprawdzenie, że grafiki są prawdziwe (nie wskaźniki LFS ~130 bajtów):
```
git lfs ls-files | head -5
ls -la assets/bg/arena.png              # ~4-5 MB; jeśli ~130 B → git lfs pull
```
Otwórz w przeglądarce: `/` (arena), `/?view=wardrobe`, `/?view=anim`. Postacie muszą być widoczne.

## 4. Agent AI
- **Codex** czyta `AGENTS.md` sam. **Claude Code** czyta `CLAUDE.md`, który importuje `AGENTS.md`.
- Każdą sesję zaczynaj od: *„przeczytaj AGENTS.md i weź wolne zadanie”*.
- Agent na starcie: `AGENTS.md` → `ARCHITECTURE.md` → ostatnie wpisy `AGENT_CHAT.md`.
- Pierwszy wpis w `AGENT_CHAT.md`: kim jesteś (agent + osoba), co masz zainstalowane, czym chcesz się zająć,
  odpowiedzi na pytania `❓` skierowane do Ciebie.

## 5. Opcjonalnie: grafika (tylko zadania w `blender/`, `assets/`)
Gra działa bez tego — wyrenderowane sprite'y są w repo.
| program | wersja | uwagi |
|---|---|---|
| Blender | 5.3 | render Cycles; karta NVIDIA (OptiX/CUDA) mocno przyspiesza, na CPU działa wolno |
| Python | ≥ 3.11 | tylko do `tools/fetch_blenderkit.py` (biblioteka standardowa, bez pip) |

```
python -I tools/fetch_blenderkit.py                         # darmowe tekstury papieru (~50 MB pobrania, nie są w git — licencja)
python -I tools/blender.py --where                          # który Blender zostanie użyty
python -I tools/blender.py blender/unpack_blenderkit.py     # rozpakowanie tekstur do art_src/blenderkit/*/tex
KIT_NO_ATLAS=1 python -I tools/blender.py blender/build_kit.py -- 16 helmet1   # próbny render jednego elementu
git checkout -- assets/chars/kit                            # próbny render nie idzie do commita
```
Blender jest szukany w zmiennej **`BLENDER`** (pełna ścieżka do programu), potem w typowych miejscach instalacji i w `PATH`.
Bez karty graficznej render idzie na CPU (wolniej); `CYCLES_DEVICE=CPU` wymusza CPU. W logu renderu linia `CYCLES_DEVICE` mówi, czego użył.
Sprawdzone na drugim komputerze (#8, Windows 11, Blender 5.3): pobranie → rozpakowanie → `helmet1` / `helmet10` dają te same sprite'y co w repo
(ten sam rozmiar i pivot, średnia różnica pikseli 0,2–0,5 % = szum Cycles przy 16 próbkach).

## 6. Problemy
| objaw | przyczyna / rozwiązanie |
|---|---|
| puste / niewidoczne postacie, błędy dekodowania PNG | grafiki są wskaźnikami LFS → `git lfs install && git lfs pull` |
| `npm ci` narzeka na wersję Node.js | sprawdź `engines` w `package.json` albo zainstaluj Node 24 LTS |
| port 5180 zajęty | zamknij inny `npm run dev` (port jest stały: `vite.config.ts`) |
| animacje stoją w testach agenta | ukryte okno przeglądarki = stoi requestAnimationFrame; przesuwaj zegar ręcznie (`AGENTS.md`) |
| `gh: command not found` | zainstaluj GitHub CLI (pkt 1), potem `gh auth login` |
| render Blendera: brak tekstur | najpierw `tools/fetch_blenderkit.py` i `tools/blender.py blender/unpack_blenderkit.py` |
| `Blender not found` | zainstaluj Blender 5.3 albo ustaw `BLENDER=<ścieżka do blender / blender.exe>` |
