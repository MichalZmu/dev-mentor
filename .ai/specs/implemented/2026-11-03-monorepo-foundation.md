# DevMentor — konfiguracja monorepo

Data utworzenia: 2026-11-03
Wersja: 1
Status: done
Zatwierdzenie zakresu: użytkownik, 2026-11-03, „Konfiguracja monorepo i instalacja bibliotek [...] lecimy z tym”, po uzgodnieniu architektury w AGENTS.md i README.md.

## Cel i zakres

Przekształcić starter w działające monorepo npm workspaces z pakietami @devmentor/app, @devmentor/core, @devmentor/db i @devmentor/ui. Zainstalować i połączyć Next.js, React, TypeScript, Tailwind, shadcn/ui, PostgreSQL/MikroORM oraz Awilix. Zachować wcześniejsze instrukcje i zmiany użytkownika.

Zakres obejmuje konfigurację, minimalny przykład współdzielonego UI, serwerowe składanie zależności, narzędzia bazy i testy infrastruktury. Bez funkcji biznesowych, logowania, wdrożenia, commita ani zmian danych w istniejącej bazie. Nie dodawać publicznych operacji zapisu ani arbitralnych encji domenowych. Można dodać prosty widok /admin demonstrujący komponent UI, bez danych i operacji administracyjnych.

## Plan i zależności

1. Przenieść aplikację, public i konfigurację Next.js do packages/app; utworzyć npm workspaces i wspólne ustawienia TypeScript/ESLint. Zachować jeden lockfile.
2. Zdefiniować publiczne interfejsy pakietów core/db/ui i zależności zgodne z AGENTS.md. Zainstalować aktualne stabilne, zgodne wersje bibliotek; skorzystać z dokumentacji lokalnej Next.js i oficjalnej MikroORM 7.
3. Skonfigurować PostgreSQL i MikroORM: środowisko, pula, współdzielona instancja, kontekst żądania/zadania, CLI migracji i polecenie sprawdzenia połączenia; dodać lokalny Compose i przykładową konfigurację bez sekretów.
4. Skonfigurować serwerowy Awilix z izolacją scope; dodać miarodajne testy współbieżności/izolacji i konfiguracji ORM bez potrzeby dostępności bazy.
5. Przygotować Tailwind i shadcn/ui w ui, konfigurację CLI po obu stronach oraz minimalne użycie komponentu w aplikacji.
6. Zaktualizować dokumentację i reguły do stanu wdrożonego, wykonać niezależną weryfikację i review, poprawić wykryte problemy.

## Kryteria akceptacji i scenariusze weryfikacji

| ID | Oczekiwane zachowanie | Weryfikacja |
| --- | --- | --- |
| AC1 | Cztery pakiety w packages, npm workspaces, publiczne eksporty i jeden aktualny package-lock.json. Komendy uruchamiane z root. | npm ci; npm ls; kontrola konfiguracji i granic zależności. |
| AC2 | Aplikacja kompiluje się po przeniesieniu; uruchomienie nie wymaga bazy. Wspólne UI i Tailwind działają. | lint, typecheck, build, HTTP / oraz /admin (jeśli dodany), kontrola działającego UI. |
| AC3 | db ma konfigurację PostgreSQL/MikroORM, pulę i bezpieczny cykl życia. CLI migracji oraz db:check korzystają z tej samej konfiguracji. | testy konfiguracji, inicjalizacja metadanych bez połączenia, CLI --help/debug; db:check i migracje na odizolowanej lokalnej bazie, jeśli środowisko dostępne. Brak bazy jest jawnym ograniczeniem, nie sukcesem integracji. |
| AC4 | Awilix działa po stronie serwera, oddziela stan żądań i udostępnia zależności jawnie. Baza i DI nie trafiają do klienta. | test współbieżnych zakresów, obsługi błędów i zwalniania zasobów; review importów i build. |
| AC5 | README opisuje rzeczywiste komendy, env, uruchomienie PostgreSQL, migracje i pakiety; CLAUDE.md nadal importuje AGENTS.md, blok Next.js zachowany. | kontrola dokumentacji i git diff --check. |

## Ryzyka i ograniczenia

- Aktualizacje Next.js i MikroORM wymagają weryfikacji nowych API; używać dokumentacji z zainstalowanych paczek i źródeł oficjalnych.
- Wspólny ORM/pula nie oznaczają wspólnego EntityManager i scope żądania. Błąd inicjalizacji nie może trwale blokować kolejnej próby.
- Nie wykonywać destrukcyjnych migracji lub usuwania istniejących danych. Baza do testów musi być nowa i izolowana.
- Docker Desktop nie udostępnia obecnie polecenia docker w dystrybucji WSL; dostępność silnika hosta wymaga sprawdzenia.

## Wynik weryfikacji — 2026-11-03

- AC1–AC5 spełnione. Stan źródeł r1: 8396d4e150486a063026f8317d5a68be99596a0fbec5b0a6d0a97efe29c49188; [manifest](../../runs/evidence/2026-11-03-monorepo-foundation-r1.json).
- Niezależny verifier: clean npm ci, cztery workspaces, lint, typecheck, 8 testów i build przy niedostępnej bazie — PASS. Po r1 powtórzono kontrole dotknięte czterema plikami konfiguracji; lock/deps i kod runtime pozostają bez zmian wobec sprawdzonego r0.
- PostgreSQL 18.6: db:check/debug/list, idempotentne migrate, rzeczywista izolacja SELECT1/EM/DI i obsługa błędu — PASS. Nowy projekt Compose z --wait osiągnął Healthy, następnie db:check przeszedł.
- Produkcyjne / i /admin HTTP200, własne kontrole DOM/CSS verifiera oraz wizualna kontrola i nawigacja w przeglądarce przez prowadzącego — PASS. Child nie ma IAB; natywna próba nie wykonała inputu.
- Review r1 bez blokerów: zamknięte R1 (aliasy/eksporty shadcn), R2 (gotowość Compose), S1 (typecheck migracji). Dry-run/view sidebara sprawdzono bez dodawania komponentów.
- Lokalne serwery i wyłącznie nowe bazy testowe usunięte; root .env nie utworzono na stałe. Docker Desktop wymaga integracji WSL dla polecenia docker w dystrybucji, zgodnie z README.
- Pozostałe ograniczenia narzędzi: ESLint9 jest zgodny z peer dependencies aktualnego Next; ESLint10 nie jest jeszcze zgodny z dostarczonymi pluginami. Audit: 0 runtime, 21 dev (2 low/19 moderate); bez automatycznego poszerzania zmian zależności.
