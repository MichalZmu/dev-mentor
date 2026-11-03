# DevMentor

DevMentor to aplikacja Next.js, React i TypeScript. Projekt jest monorepo npm workspaces ze wspólną logiką, warstwą danych i biblioteką komponentów.

## Architektura

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
| `@devmentor/db` | Konfiguracja PostgreSQL/MikroORM, cykl życia ORM, kontekst EntityManager i CLI migracji. Implementacje repozytoriów będą korzystać z kontraktów `core`. |
| `@devmentor/ui` | Komponenty React i shadcn/ui oraz wspólne style Tailwind. Otrzymuje dane i zdarzenia przez jawny interfejs; nie importuje bazy ani DI. |

Kierunek zależności: `app → core/db/ui`, `db → core`, opcjonalnie `ui → core` dla typów i narzędzi przydatnych w UI. Pakiety współdzielone nie zależą od aplikacji, a `db` i `ui` nie zależą od siebie. Importy między pakietami korzystają z publicznych eksportów.

Stos: Next.js 16.4, React 19.3, TypeScript 5, MikroORM 7.2, Awilix 13 i Tailwind CSS 4. Dokładne wersje są zapisane w manifestach pakietów i jednym root `package-lock.json`.

Strona `/` korzysta z Tailwind i serwerowego kontenera DI bez otwierania połączenia z bazą. `/admin` prezentuje współdzielony komponent shadcn/ui. Jest to podgląd interfejsu bez danych i operacji administracyjnych; logowanie i uprawnienia będą osobną funkcją.

## Uruchomienie aplikacji

Wymagania: Node.js >=22.17 oraz npm >=10. `.nvmrc` wskazuje wersję używaną podczas konfiguracji; przy korzystaniu z nvm wykonaj `nvm install` i `nvm use`.

Polecenia wykonuj z głównego katalogu repozytorium:

```bash
npm ci
npm run dev
```

Otwórz [localhost:3000](http://localhost:3000). Uruchomienie i build stron startowych nie wymagają bazy ani `DATABASE_URL`.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`start` uruchamia wynik wcześniejszego `build`. Typecheck obejmuje cztery pakiety; testy sprawdzają współbieżność, izolację scope/EntityManager, ponowienie inicjalizacji i zwalnianie zasobów po błędzie. Testy nie potrzebują PostgreSQL; warunek Node `react-server` pozwala sprawdzać moduły oznaczone `server-only`.

## Lokalny PostgreSQL

Potrzebny jest Docker z Compose; w WSL wymaga to włączonej integracji Docker Desktop z dystrybucją.

```bash
cp .env.example .env
npm run db:up
npm run db:check
```

Compose uruchamia PostgreSQL 18 z trwałym nazwanym wolumenem. Port jest wystawiony wyłącznie na `127.0.0.1`. Domyślne dane w przykładzie służą wyłącznie do lokalnego developmentu.

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

Na tym etapie nie ma encji domenowych ani migracji schematu. Katalog `packages/db/migrations/` i narzędzia są gotowe. `db:migrate` na nowej lokalnej bazie przechodzi bez zmian domenowych; może utworzyć tabelę ewidencji migracji.

```bash
npm run db:debug
npm run db:migration:list
npm run db:migration:create
npm run db:migrate
```

Po dodaniu lub zmianie encji wygeneruj migrację, sprawdź jej SQL i dołącz plik do zmian. Polecenie `npm run db:migration:down` cofa ostatnią migrację; używaj go świadomie na odpowiedniej bazie. CLI przyjmuje dodatkowe opcje po `--`, np. `npm run db:migration:create -- --blank`.

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

## Praca agentów

Zasady architektury i workflow są zapisane w [AGENTS.md](AGENTS.md). [CLAUDE.md](CLAUDE.md) wczytuje je przez `@AGENTS.md`.

Specyfikacje, dzienniki i trwałe wnioski są przechowywane w `.ai/`. Przed zmianą kodu przeczytaj właściwą dokumentację z zainstalowanego `node_modules/next/dist/docs/` (pakiet Next.js może być hoistowany do root).
