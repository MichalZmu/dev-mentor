# DevMentor

DevMentor to projekt portalu mentoringu technologicznego, który łączy osoby rozwijające karierę w IT z doświadczonymi praktykami. Uczestnik wybiera mentora, umawia sesję online 1:1 i pracuje nad uzgodnionym planem rozwoju.

Koncepcja korzysta z Preply jako benchmarku funkcjonalnego i UX. Identyfikacja wizualna, treści i kod prototypu zostały przygotowane niezależnie. Założenia początkowe to mentoring dla dorosłych, rynek polski, rozliczenia w PLN i sesje w języku polskim lub angielskim.

## Użytkownicy i planowane funkcje

| Użytkownik | Potrzeby i planowane możliwości |
| --- | --- |
| Gość | Poznanie oferty, wyszukanie i porównanie mentorów, sprawdzenie specjalizacji, opinii, ceny i dostępności. |
| Uczestnik (mentee) | Określenie celu, rezerwacja i opłacenie sesji, kontakt z mentorem, zarządzanie terminami, opinie i śledzenie postępów. |
| Kandydat i mentor | Zgłoszenie do weryfikacji, publikacja profilu, zarządzanie ofertą i dostępnością, prowadzenie sesji oraz kontrola zarobków. |
| Obsługa i administrator | Obsługa problemów i zgłoszeń, moderacja aplikacji mentorów oraz decyzje z uzasadnieniem i historią zmian. |

Planowany zakres MVP obejmuje:

- Katalog mentorów z filtrami, profile, opinie i ulubionych.
- Cele uczestnika, rezerwację sesji 50-minutowych, płatność, potwierdzenie oraz przełożenie i anulowanie spotkania.
- Panele uczestnika i mentora, wiadomości, pokój sesji, notatki, opinie i plan rozwoju.
- Dobrowolne pakiety dalszej współpracy, rozliczenia, dostępność mentorów, moderację i zgłoszenia pomocy.

Główna ścieżka uczestnika: **wybór mentora → określenie celu → termin i płatność → sesja → opinia i plan rozwoju → decyzja o dalszej współpracy**. Szczegóły, warianty błędów i pozostałe przepływy opisuje [koncepcja produktu](docs/mentoring-concept/docs/01-koncepcja.md).

## Status projektu

Repozytorium zawiera aplikację produktu z PostgreSQL oraz zachowany, osobny klikalny prototyp koncepcji.

| Obszar | Aktualny stan |
| --- | --- |
| Aplikacja w `packages/` | Cztery pakiety, encje i wersjonowane migracje domeny, API `/api/v1`, sesje BetterAuth w osobnym schemacie `auth`, serwerowe DI oraz współdzielone UI. |
| Strony produktu | Katalog i profile, auth z weryfikacją/resetem/MFA, panel uczestnika, panel mentora, administracja, checkout oraz jawny pokój demonstracyjny. |
| Rezerwacje i rozliczenia | Hold15min, constraints nakładania terminów, idempotencja, checkout, trwały inbox/outbox, worker, retry, refundy i uzgadnianie; lokalna bramka demo korzysta z tej samej trwałej ścieżki. |
| Funkcje uczestnika/mentora | Terminy, anulowanie/przełożenie, kalendarz, prywatne notatki, opinie, wiadomości, cele/plan, pakiety i kredyty, profile, reguły dostępności ze strefami/DST, moderacja i zgłoszenia. |
| Integracje zewnętrzne | Adaptery Stripe Checkout/Connect/refund i SMTP są konfigurowalne. Użytkownik wybrał lokalne demo bez kont dostawców; prawdziwe płatności, KYC, poczta/OAuth i wideousługa nie zostały zweryfikowane w sandboxach. |
| Prototyp w `docs/mentoring-concept/` | Niezależna makieta25ekranów na fikcyjnych danych; nie jest aplikacją serwerową. |

Lokalne demo ma syntetyczne konta i płatności, trwałą bazę oraz prawdziwe sesje/autoryzację. `APP_MODE=demo` jest jawny i wymaga loopback; nie stanowi konfiguracji do publikacji. Bezpieczne uruchomienie opisuje [runbook](docs/operations/runbook.md), a kontrakt [OpenAPI](docs/api/openapi.json). Cele produkcyjne, hosting, backup/PITR, sekrety dostawców i ostateczne zasady rozliczeń wymagają rzeczywistego środowiska i osobnej walidacji.

## Specyfikacja techniczna

[Stos i standardy inżynieryjne](.ai/specs/2026-11-03-engineering-standards.md) zawiera research technologii, porównanie alternatyw, docelową architekturę, coding standards, wzorce projektowe oraz plan wdrożenia i testów. Dokument rozróżnia istniejący fundament od rekomendowanych integracji i decyzji wymagających uzgodnienia.

## Koncepcja i klikalny prototyp

| Materiał | Zawartość |
| --- | --- |
| [Dokumentacja HTML](docs/mentoring-concept/START.html) | Punkt wejścia do koncepcji, mapy ekranów i prototypu. |
| [Koncepcja produktu](docs/mentoring-concept/docs/01-koncepcja.md) | Użytkownicy i potrzeby, benchmark ze źródłami, zakres, reguły, przepływy i nawigacja. |
| [Katalog 25 ekranów](docs/mentoring-concept/docs/02-ekrany.md) | Cele, funkcje, komponenty UI, stany, walidacje i powiązane endpointy. |
| [Projekt API](docs/mentoring-concept/docs/03-api.md) | Proponowane kontrakty, uprawnienia, błędy i zasady spójności operacji. |
| [Weryfikacja](docs/mentoring-concept/docs/04-weryfikacja.md) | Scenariusze, wyniki kontroli i ograniczenia testów. |
| [Instrukcja prototypu](docs/mentoring-concept/README.md) | Obsługa makiety, źródła TypeScript i granice symulacji. |
| [Paczka ZIP](docs/DevMentor-koncepcja.zip) | Dokumentacja i samodzielny prototyp do pobrania i rozpakowania. |

Aby obejrzeć prototyp, otwórz lokalnie `docs/mentoring-concept/START.html`, a następnie wybierz „Otwórz klikalny prototyp”. W paczce ZIP najpierw rozpakuj cały katalog. Do tego sposobu uruchomienia nie potrzeba instalacji zależności ani internetu. Bezpośrednie otwieranie przez `file://` nie mogło zostać sprawdzone w automatyzowanej przeglądarce; UI zweryfikowano przez lokalny HTTP.

Podgląd HTTP uruchom z głównego katalogu repozytorium:

```bash
node docs/mentoring-concept/serve.mjs
```

Otwórz [prototyp na localhost:4173](http://127.0.0.1:4173/prototype/index.html). Serwer słucha tylko na `127.0.0.1`; zatrzymasz go przez `Ctrl+C`. Ten podgląd działa niezależnie od aplikacji Next.js uruchamianej na porcie 3000.

Pasek demo udostępnia wybór roli, stanów ekranu, mapę ekranów, przykładowe dane i reset. Stan jest zapisywany w `localStorage`, z trybem pamięci awaryjnej, jeśli zapis jest niedostępny. Prototyp używa stałego zegara i przykładowych terminów z listopada 2026.

Polecenia do pracy nad artefaktem, również z root:

```bash
# Kontrola kompletności plików, ekranów i odnośników do API
node docs/mentoring-concept/verify.mjs

# Kompilacja źródła TypeScript prototypu
node node_modules/typescript/bin/tsc -p docs/mentoring-concept/prototype/tsconfig.json

# Odtworzenie START.html po zmianach dokumentacji
node docs/mentoring-concept/build-docs.mjs
```

Prototyp zawiera gotowy JavaScript i nie wymaga kompilacji do oglądania.

## Architektura

Projekt jest monorepo npm workspaces: aplikacja i biblioteki znajdują się w `packages/`, a instalacja oraz polecenia projektu korzystają ze wspólnego katalogu głównego i jednego `package-lock.json`.

| Technologia | Rola w DevMentor |
| --- | --- |
| Next.js, React i TypeScript | Routing, renderowanie stron oraz typowany kod aplikacji i pakietów. |
| PostgreSQL i MikroORM | Trwałe dane, repozytoria, wersjonowane migracje oraz współdzielona pula połączeń. |
| Awilix | Serwerowe składanie zależności z osobnym scope dla żądania lub zadania. |
| Tailwind CSS | Style stron publicznych i współdzielonych komponentów. |
| shadcn/ui | Komponenty panelu administracyjnego, utrzymywane w pakiecie `ui` i stylowane Tailwindem. |

```text
packages/
├── app/     # Next.js: strony, panel i serwerowe składanie zależności
├── core/    # Wspólna logika, typy i kontrakty
├── db/      # PostgreSQL, MikroORM, migracje i pula połączeń
└── ui/      # Współdzielone komponenty React, shadcn/ui i style Tailwind
```

| Pakiet | Odpowiedzialność i zależności |
| --- | --- |
| `@devmentor/app` | Routing App Routera, strony frontendowe, panel administracyjny i kontener Awilix. Łączy `core`, `db` i `ui`. Kod Next.js znajduje się w `packages/app/app/`. |
| `@devmentor/core` | Typy, kontrakty i logika wielokrotnego użytku; bez zależności od frameworka, bazy i pozostałych pakietów projektu. |
| `@devmentor/db` | Konfiguracja PostgreSQL/MikroORM, cykl życia ORM, kontekst EntityManager i CLI migracji. Repozytoria implementują jawne kontrakty `core` i atomowe operacje domenowe. |
| `@devmentor/ui` | Komponenty React i shadcn/ui oraz wspólne style Tailwind. Otrzymuje dane i zdarzenia przez jawny interfejs; nie importuje bazy ani DI. |

Kierunek zależności: `app → core/db/ui`, `db → core`, `ui` nie importuje innych pakietów projektu, również typów z `core`. Pakiety współdzielone nie zależą od aplikacji, a `db` i `ui` nie zależą od siebie. Importy między pakietami korzystają z publicznych eksportów.

Stos: Next.js 16.4.5, React 19.3.1, TypeScript 5.9.3, MikroORM 7.2.6, Awilix 13.0.5 i Tailwind CSS 4.3.4. Dokładne wersje są zapisane w manifestach pakietów i jednym root `package-lock.json`.

Kod obsługujący żądanie w `app` składa przypadek użycia z `core` i repozytorium z `db`, przekazując zależności jawnie. Repozytorium korzysta z EntityManager odizolowanego dla żądania lub zadania, przy wspólnej puli PostgreSQL. Komponenty `ui` otrzymują dane i callbacki przez props; kontener DI i dostęp do bazy pozostają na serwerze.

## Uruchomienie aplikacji

Wymagania: Node.js 26.13.0 oraz npm 11.20.0. `.nvmrc` wskazuje wersję używaną podczas konfiguracji; przy korzystaniu z nvm wykonaj `nvm install` i `nvm use`.

Polecenia wykonuj z głównego katalogu repozytorium:

```bash
npm ci
npm run dev --workspace=@devmentor/app -- --hostname 127.0.0.1
```

Otwórz [localhost:3000](http://localhost:3000). Uruchomienie i build stron startowych nie wymagają bazy ani `DATABASE_URL`.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`start` uruchamia wynik wcześniejszego `build`. Typecheck obejmuje cztery pakiety oraz konfigurację i narzędzia. Jednostkowe testy Vitest sprawdzają współbieżność, izolację scope/EntityManager, ponowienie inicjalizacji, sprzątanie po błędzie, granice i kontrolę audytu. Nie wymagają bazy; resolver `react-server` oraz inlining rzeczywistego pakietu `server-only` respektują jego eksporty bez mocka. Testy integracyjne i E2E są osobnymi, wymaganymi kontrolami.

## Uruchomienie pełnego lokalnego demo

Wymagania: Node 26.13.0, npm 11.20.0 oraz działający Docker z Compose.
Z root repozytorium, także na świeżym checkout bez node_modules:

```bash
npm run setup
```

Instalator sprawdza wersje narzędzi, instaluje brakujące lub nieaktualne zależności
przez npm ci, tworzy tylko brakujący .env z .env.example, zapewnia gotowość
PostgreSQL, sprawdza połączenie oraz wykonuje migracje i seed demo. Nie instaluje
narzędzi systemowych i nie uruchamia web/workera ani CI.

Ponowienie npm run setup zachowuje istniejący .env, konta, hasła, role, cele
i wolumen bazy. Zmienne procesu mają pierwszeństwo. Instalator wymaga jawnego
trybu demo i lokalnych URL; istniejącą konfigurację popraw samodzielnie według
wskazówki błędu. Zależności są ponownie weryfikowane, migracje sprawdzane przy
każdym starcie, a ukończony seed pomijany na podstawie stanu w danej bazie.
Błąd zatrzymuje zależne kroki; po jego usunięciu uruchom to samo polecenie.
Nowa baza nie dziedziczy znacznika poprzedniej.

Po sukcesie uruchom aplikację i worker w osobnych terminalach:

```bash
npm run dev --workspace=@devmentor/app -- --hostname 127.0.0.1
npm run worker
```

Pełna ścieżka ręczna pozostaje dostępna (kopiuj .env tylko, gdy jeszcze go nie ma):

```bash
npm ci
cp .env.example .env
npm run db:up
npm run db:check
npm run migrate
npm run seed:demo
npm run dev --workspace=@devmentor/app -- --hostname 127.0.0.1
# osobny terminal w root:
npm run worker
```

Konta `demo@example.test`, `mentor@example.test`, `admin@example.test` mają jawne hasło testowe `DemoOnly_2026!`. Nowa rejestracja wymaga weryfikacji przez skrzynkę demonstracyjną przypisaną do przeglądarki. Worker musi działać, aby zdarzenie płatności potwierdziło rezerwację. `npm run worker -- --once` wykonuje jeden tick. Szczegóły obrazu OCI, osobnych ról runtime/migrator, sesji MFA i lokalnego restore są w [runbooku](docs/operations/runbook.md).

## Lokalny PostgreSQL

Potrzebny jest Docker z Compose; w WSL wymaga to włączonej integracji Docker Desktop z dystrybucją.

```bash
cp .env.example .env
npm run db:up
npm run db:check
```

Compose uruchamia PostgreSQL 18.6 (ten sam patch co testy integracyjne) z trwałym nazwanym wolumenem. Port jest wystawiony wyłącznie na `127.0.0.1`. Domyślne dane w przykładzie służą wyłącznie do lokalnego developmentu.

Konfigurację przechowuj w root `.env`:

| Zmienna | Znaczenie |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL używany przez aplikację, CLI migracji i kontrolę połączenia. |
| `DB_POOL_MIN`, `DB_POOL_MAX` | Minimalna i maksymalna liczba połączeń; domyślnie 0 i 10. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Konfiguracja lokalnego serwera Compose. |
| `POSTGRES_PORT` | Port hosta dla Compose, domyślnie 5432. |

Przy zmianie danych Compose lub portu dostosuj również `DATABASE_URL`. Zmienne ustawione w środowisku procesu mają pierwszeństwo przed root `.env`. Konfiguracja Next.js oraz wejścia CLI ładują ten sam plik, a moduły bazy korzystają z `process.env`.

`npm run db:check` wykonuje rzeczywiste `SELECT 1` i zamyka pulę. `npm run db:down` zatrzymuje usługę bez usuwania danych. Zmiana `POSTGRES_*` nie zmienia automatycznie użytkownika ani bazy w już zainicjalizowanym wolumenie.

## MikroORM i migracje

Pakiet `db` ma wspólną konfigurację połączenia oraz osobne wejście CLI z rozszerzeniem `Migrator`. Rejestruj schematy encji jawnie w `packages/db/src/config.ts`; przy Next.js preferuj [API zgodne z bundlerem](https://mikro-orm.io/docs/usage-with-nextjs), np. `defineEntity`.

Domena ma jawne schematy encji oraz wersjonowane migracje `Migration202611030001–004`, obejmujące rezerwacje, płatności, inbox/outbox, dostępność i audyt. `npm run migrate` uruchamia kontrolowane migracje auth oraz domeny; `db:migrate` dotyczy wyłącznie MikroORM. Migracje auth używają tego samego schematu `auth` co runtime i nie są zarządzane przez MikroORM.

```bash
npm run db:debug
npm run db:migration:list
npm run db:migration:create
npm run db:migrate
```

Tabele domeny są zarządzane przez wersjonowane migracje SQL MikroORM. Pełne metadata `defineEntity` są rejestrowane jawnie, a `schemaGenerator.skipTables` chroni domenę i auth przed niekompletnym automatycznym diffem. Po zmianie schematu utwórz migrację przez `npm run db:migration:create -- --blank`, sprawdź SQL i dołącz ją do zmiany. Zasady własności schematu opisuje [dokumentacja bazy](docs/db-schema.md). Polecenie `npm run db:migration:down` cofa ostatnią migrację; używaj go świadomie na odpowiedniej bazie. CLI przyjmuje dodatkowe opcje po `--`, np. `npm run db:migration:create -- --blank`.

Migracje są wykonywane jawnie przez CLI, bez automatycznego uruchamiania przy starcie Next.js. Dokumentacja: [migracje MikroORM](https://mikro-orm.io/docs/migrations).

## Serwerowy kontener DI i połączenia

`packages/app/server/services.ts` jest serwerowym punktem wejścia:

- `withAppServices(callback)` udostępnia scope Awilix i usługi niewymagające bazy.
- `withDatabaseServices(callback)` udostępnia również izolowany EntityManager; używaj go w kodzie serwerowym działającym w runtime Node.js.
- Obie funkcje zwalniają scope po zakończeniu callbacka, także po błędzie.

Kontener jest składany w aplikacji, a logika biznesowa otrzymuje zależności jawnie. Współdzielony provider ORM zachowuje jedną instancję i pulę na proces, również podczas przeładowań developerskich, oraz pozwala ponowić nieudaną inicjalizację. Każde żądanie lub zadanie otrzymuje własny [kontekst MikroORM](https://mikro-orm.io/docs/identity-map). Dane żądania nie są przechowywane w singletonach Awilix.

Aplikacja nie przenosi kontenera, ORM ani sekretów do komponentów klienta. Granicę `server-only` sprawdza również produkcyjny build. Przy pobieraniu danych zależnych od żądania respektuj zasady dynamicznego renderowania lokalnej wersji Next.js.

## Komponenty UI

Tailwind jest przetwarzany przez oficjalny plugin PostCSS v4. Wspólne tokeny i skanowanie źródeł aplikacji oraz UI znajdują się w `packages/ui/src/styles/globals.css`.

Komponenty panelu dodawaj z root:

```bash
npm run ui:add -- dialog
```

Konfiguracje `components.json` w `app` i `ui` kierują współdzielone komponenty do `packages/ui`. Pakiet eksportuje komponenty przez `@devmentor/ui/components/*`. Widoki specyficzne dla DevMentor pozostają w `app`. Zobacz [shadcn/ui w monorepo](https://ui.shadcn.com/docs/monorepo).

Panel wiadomości odświeża najnowszą stronę aktywnej rozmowy co 10 sekund, gdy karta jest widoczna. Przeglądanie starszej historii wstrzymuje odświeżanie. Odczyt w tle zachowuje wpisany szkic, historię i jej stronicowanie także przy przejściowym błędzie sieci.

## Praca agentów

Zasady architektury i workflow są zapisane w [AGENTS.md](AGENTS.md). [CLAUDE.md](CLAUDE.md) wczytuje je przez `@AGENTS.md`.

Specyfikacje, dzienniki i trwałe wnioski są przechowywane w `.ai/`. Przed zmianą kodu przeczytaj właściwą dokumentację z zainstalowanego `node_modules/next/dist/docs/` (pakiet Next.js może być hoistowany do root).

## Kontrole standardów i CI

Z root po `npm ci` wykonaj:

```bash
npm run check                 # format, lint, typy, graf zależności, unit + coverage
npm run test:browser:install
npm run build
npm run test:integration      # Docker, własny PostgreSQL 18.6, migracje i transakcje
npx --no-install playwright install --with-deps chromium
npm run test:e2e              # serwer produkcyjny :3100, desktop i mobile
npm run security:check        # audit runtime i narzędzi z ograniczonymi wyjątkami
```

`npm run format` poprawia formatowanie kodu i konfiguracji. Istniejące artefakty `.ai/`, koncepcja `docs/` i główne dokumenty Markdown mają własny format i są wyłączone z masowego formatowania. Zainstalowana dystrybucja `.agents/skills/` ma własne szablony, więc jest pomijana przez Prettiera i ESLinta; źródła pakietów, narzędzia projektu i testy nadal podlegają kontrolom. `deps:check` analizuje AST importów, publiczne eksporty pakietów, ich deklaracje i cykle; wykrywa również względne obejścia i importy tylko typów. Negatywne fixture testy sprawdzają te zakazy.

Coverage obejmuje implementacje wszystkich czterech pakietów, stron, komponentów, API, instrumentacji, CLI, migracji i narzędzi projektu, także nieimportowane pliki. Vitest wymaga 100% lines, branches, functions i statements osobno dla każdego pliku. Testy jednostkowe adapterów używają kontrolowanych granic usług zewnętrznych; integracja i E2E osobno sprawdzają współpracę modułów.

Integracja Testcontainers tworzy i usuwa własny PostgreSQL, wykonuje migracje na pustej bazie i ponownie, rzeczywiste zapytania, rollback oraz testy repozytorium i auth. Dodatkowa instancja produkcyjna aplikacji sprawdza API i widok korzystający z bazy przez agent-browser. E2E uruchamia własny serwer z workerem oraz sprawdza desktop/mobile i klawiaturę. Raporty: `coverage/`, `playwright-report/`, `test-results/`; trace zachowuje się po błędzie. Brak infrastruktury i błędy powodują porażkę kontroli.

Workflow `.github/workflows/ci.yml` zawiera jakość z coverage, integrację, produkcyjny build/E2E, audyt zależności i skan sekretów Gitleaks 8.30.1. Wszystkie Actions są przypięte do pełnego SHA; uprawnienia to `contents: read`, kod PR nie ma sekretów wdrożeniowych, a dane testowe są syntetyczne. Końcowy `ci-required` działa przez `always()` i odrzuca failure/skipped/cancelled wymaganych jobów. Właściciel repozytorium musi w GitHub wymagać `ci-required` i review dla aktualnego commita. Przy sprawdzeniu 2026-11-03 gałąź `main` nie miała aktywnej ochrony ani rulesets; sam plik workflow nie zmienia ustawień GitHub.

### Zależności i czasowe wyjątki bezpieczeństwa

Nowe zależności sprawdzono w metadanych zainstalowanych pakietów: Vitest 5.1.0, coverage-v8 5.1.0, Prettier 3.9.10, typescript-eslint 8.72.1, Testcontainers PostgreSQL 12.2.1 i Zod 4.6.7 — MIT; Playwright 1.64.1 — Apache-2.0. To aktywne wydania oficjalnych projektów; narzędzia testowe/lint nie są importowane do klienta, a walidacja Zod pozostaje po stronie serwera. Gitleaks Action v2 ma własną licencję (wymagana osobna kontrola przy przeniesieniu repo do organizacji); binarka Gitleaks jest MIT.

Pierwszy audit narzędzi 2026-11-03 zgłosił 28 wynikowych pakietów (26 moderate, 2 low), przy czystym runtime. Późniejsze pomiary po rozbudowie zależności zwróciły czysty runtime; aktualny raport ustala `npm run security:check`. `security-exceptions.json` dopuszcza wyłącznie developerskie GHSA-g3hv-75wg-m249 (minimatch), GHSA-3g3m-2fjr-6pw4 (glob) i GHSA-gcqx-w48m-w2h4 (deepmerge), z właścicielem MichalZmu i terminem **2026-11-17**. Starsi konsumenci używają innych API minimatch/glob, a bezpiecznej aktualizacji całego grafu jeszcze nie wybrano. Nie wymuszono niezgodnych override ani downgrade. Wyjątki wymagają izolacji CI, braku sekretów wdrożeniowych i kontroli danych wejściowych narzędzi; nie akceptują podatności produkcyjnych.

Kontrola analizuje pełne ID advisory, klasyfikację dev w lockfile i termin; brak raportu, metadanych, sieci, nowe advisory lub wygasły wyjątek powodują błąd. `npm audit --omit=dev` nadal musi być czysty dla każdej severity. Po terminie należy zaktualizować zgodny zestaw zależności albo jawnie ponownie rozstrzygnąć wyjątek — kontrola nie przedłuża go automatycznie.

### Dalsze etapy produktu

W aplikacji wdrożono uwierzytelnianie, katalog, dostęp do zasobów, rezerwacje, adapter Stripe, outbox/worker oraz opcjonalne OpenTelemetry. Integracje bez kont dostawców, polityki retencji i ostateczne parametry produkcyjne nadal wymagają potwierdzenia. Staging, migracje kontrolowane przy wdrożeniu, backup/PITR, próba odtworzenia, SLO i dostawca hostingu wymagają rzeczywistego środowiska oraz dowodów; lokalny build lub test nie potwierdzają ich wykonania.


## CI dla pull requestów i testowa instancja aplikacji

Workflow [CI](.github/workflows/ci.yml) uruchamia dla każdego PR lint, TypeScript, kontrolę zależności, jednostkowe testy Vitest, build produkcyjny, integrację PostgreSQL/Testcontainers, agent-browser, E2E i kontrole bezpieczeństwa. Wymagaj w ochronie gałęzi joba `ci-required`; odrzuca on również pominięty lub anulowany wymagany job. Workflow nie publikuje aplikacji PR ani nie używa sekretów wdrożeniowych.

Jednostkowe testy TypeScript i React są oddzielone na projekty `server` (rzeczywisty `server-only`) i `client` (jsdom, React Testing Library). `npm run test:coverage` wymaga **100% lines, branches, functions i statements dla każdego pliku implementacji**, także nieimportowanego: wszystkie pakiety src, migracje db, app/server, app/scripts, app/instrumentation, app/components, app/app oraz narzędzia scripts. Deklaracje typów nie są kodem wykonywalnym. Raport HTML: `coverage/index.html`, maszynowy: `coverage/coverage-summary.json`.

Pełne sprawdzenie integracji wymaga Docker, produkcyjnego buildu i Chrome wraz z bibliotekami systemowymi:

```bash
npm ci
npm run test:browser:install
npm run test:coverage
npm run build
npm run test:integration
npm run test:e2e
```

`test:integration` tworzy własny PostgreSQL 18.6, wykonuje migracje domeny i auth, zasila syntetyczny katalog, uruchamia Next.js na wolnym porcie i sprawdza API oraz widok katalogu i profilu przez agent-browser. Serwer i kontener są zatrzymywane także po błędzie. Testy nigdy nie korzystają z lokalnego `DATABASE_URL`; poświadczenia są przekazywane wyłącznie do procesów testowych. Raporty i obrazy są w `test-results/` oraz artefaktach joba `integration`.

Do ręcznej pracy agenta uruchom z root (po buildzie):

```bash
npm run test:app
# w drugim terminalu:
npx --no-install agent-browser --session devmentor open http://127.0.0.1:3200/mentors
npx --no-install agent-browser --session devmentor snapshot -i
# interakcje według aktualnych refów @e1, @e2... z otrzymanego snapshotu
npx --no-install agent-browser --session devmentor close
```

Własny port: `npm run test:app -- 3201`. Serwer nasłuchuje wyłącznie na loopback. `Ctrl+C` zatrzymuje serwer i usuwa tymczasową bazę; dane tej instancji nie są trwałe. Nie potrzeba konfigurować lokalnej bazy ani zewnętrznych dostawców. Tymczasowa instancja ręczna zasila katalog i domenę; pełny scenariusz kont demo z logowaniem jest w `npm run test:e2e`.

CLI agent-browser jest przypięte w lockfile; [oficjalna instrukcja](https://agent-browser.dev/installation) opisuje instalację Chrome i komendy. W CI instalacja bibliotek systemowych wymaga uprawnień dostępnych na runnerze Ubuntu.
