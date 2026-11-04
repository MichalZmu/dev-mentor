# DevMentor — architektura i aktualizacja Next.js

Data utworzenia: 2026-11-03
Status: done

## Cel i zakres

Potwierdzić monorepo app/core/db/ui i uzgodniony stos, uzupełnić README oraz AGENTS.md i zastosować najnowszy stabilny patch Next.js zgodny z React. Zachować zastane zmiany produktu, bez zmian funkcji biznesowych, migracji i wdrożenia.

## Plan i ryzyka

1. Porównać manifesty, eksporty, konfigurację DI, ORM i shadcn z dokumentacją.
2. Uzupełnić opis ról technologii i przepływu zależności oraz regułę spójności dokumentacji.
3. Zaktualizować Next.js 16.4.4 do 16.4.5 i eslint-config-next do tego samego patcha, zachowując React 19.3.1 i jeden lockfile.
4. Sprawdzić diff, format, lint, typy, granice pakietów, coverage, build i audyt. Wykonać integrację/E2E, jeśli infrastruktura pozwala; niewykonane kontrole jawnie odnotować.

Ryzyka: rozbudowane zastane zmiany nie należą do tej aktualizacji; instalacja może ujawnić istniejące ostrzeżenia peer/audytu. Nie naprawiać ich przez --force ani rozszerzanie wyjątków.

## Kryteria akceptacji

- README opisuje cztery pakiety, role technologii oraz izolację serwera, DI i EntityManager.
- AGENTS.md zachowuje obecne reguły i wymaga zgodności opisu architektury z manifestami oraz eksportami.
- Manifesty i lockfile używają Next.js 16.4.5 i zgodnego eslint-config-next, bez zmiany React.
- Wyniki kontroli i ograniczenia są zapisane w dotychczasowym dzienniku zadania.

## Wyniki weryfikacji

- npm registry: Next.js16.4.5 jest stabilnym latest; React/ReactDOM19.3.1 spełniają peerDependencies. Zainstalowano także eslint-config-next16.4.5.
- npm run check: PASS — format, lint, typecheck czterech pakietów i narzędzi, deps:check oraz 396 unit/41plików; coverage100% wszystkich czterech metryk dla kodu wykonywalnego.
- npm run build: PASS — produkcyjny Turbopack16.4.5, strony i API.
- npm run security:check: PASS — runtime czysty, tylko istniejące niewygasłe wyjątki developerskie. npm ls potwierdza zgodne wersje.
- Integracja: pierwsze uruchomienie53/54PASS, jeden błąd startu Chromium z powodu brakujących bibliotek systemowych. Ponowiono dotknięty plik z LD_LIBRARY_PATH=/tmp/devmentor-chrome-libs i AGENT_BROWSER_EXECUTABLE_PATH wskazującym zainstalowany Chrome:2/2PASS. Łącznie wszystkie54przypadki zweryfikowane, bez zmiany testów i pominięć.
- npm run test:e2e z tym samym LD_LIBRARY_PATH:6/6PASS, desktop/mobile, rzeczywisty serwer produkcyjny i własny PostgreSQL18.6.
- Przegląd README/AGENTS i manifestów: zgodność czterech pakietów, publicznych eksportów, DI/ORM i shadcn; git diff --check: PASS.
- Bez commita, wdrożenia i zmian danych lokalnej bazy użytkownika.
