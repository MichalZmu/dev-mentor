<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Architektura DevMentor

Projekt jest monorepo npm workspaces. Wszystkie pakiety znajdują się w `packages/`; instalację i polecenia projektu uruchamiaj z katalogu głównego. Utrzymuj jeden `package-lock.json`.

- Stos: Next.js (najnowsza stabilna wersja zgodna z React), React i TypeScript, PostgreSQL z MikroORM, Awilix oraz Tailwind CSS. W panelu administracyjnym (strony backendowe) używaj komponentów shadcn/ui.
- Monorepo zawiera co najmniej cztery pakiety:

| Pakiet | Odpowiedzialność |
| --- | --- |
| `packages/app` | Główna aplikacja Next.js: strony publiczne, panel administracyjny, obsługa żądań i składanie zależności. |
| `packages/core` | Wspólna logika, typy i kontrakty niezależne od Next.js, React oraz warstwy danych. |
| `packages/db` | PostgreSQL i MikroORM: encje, repozytoria, migracje, konfiguracja i pula połączeń. |
| `packages/ui` | Współdzielone komponenty React, style Tailwind i komponenty shadcn/ui. |

- Zachowuj kierunek zależności: `app → core/db/ui`, `db → core`, `ui` nie importuje żadnego innego pakietu projektu (także typów z `core`). `core` nie zależy od pozostałych pakietów; unikaj cykli i importów wewnętrznych plików innego pakietu.
- Dostęp do bazy i kontener Awilix utrzymuj po stronie serwera. Rejestruj zależności w serwerowej części `app`, a do usług przekazuj je jawnie; nie pobieraj kontenera globalnie wewnątrz logiki biznesowej.
- W `db` utrzymuj współdzieloną pulę połączeń oraz izolowany kontekst EntityManager dla każdego żądania lub zadania. Nie współdziel stanu żądania między singletonami Awilix.
- Zmiany schematu bazy opisuj wersjonowanymi migracjami MikroORM w `db`. Komponenty UI nie importują `db`, kontenera DI ani sekretów; przekazuj im dane przez jawne kontrakty.
- Wspólne komponenty utrzymuj w `ui`, a widoki specyficzne dla aplikacji w `app`. Tailwind służy do stylowania, a shadcn/ui dostarcza komponenty panelu administracyjnego. Granicę komponentów klienta wyznaczaj zgodnie z lokalną dokumentacją Next.js.
- Po zmianie struktury pakietów, ich odpowiedzialności lub stosu uaktualnij opis architektury w `README.md` i odpowiednie reguły w `AGENTS.md`. Sprawdź zgodność opisu z manifestami, publicznymi eksportami i rzeczywistymi importami; wersje zapisuj w manifestach i jednym root lockfile.

### Konfiguracja i kontrole

- Wymagany jest Node.js 26.13.0 i npm 11.20.0; wersje są przypięte w `.nvmrc` i root `package.json`. Używaj wyłącznie npm i jednego `package-lock.json`. Z root uruchamiaj `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run deps:check`, `npm run test:coverage`, `npm run test:integration`, `npm run build`, `npm run test:e2e` i `npm run security:check`.
- Konfigurację lokalną przechowuj w root `.env`, korzystając z `.env.example`. Ładowanie pliku środowiska należy do konfiguracji Next.js i wejść CLI, a moduły `db` używane przez aplikację czytają `process.env`. Nie dodawaj plików `.env` do bundla przez statyczne `new URL(..., import.meta.url)`.
- Schematy encji rejestruj jawnie w `packages/db/src/config.ts`; używaj API MikroORM zgodnego z bundlerem (np. `defineEntity`). Migracje uruchamiaj jawnie przez CLI, nie automatycznie podczas startu aplikacji.
- Kontenery i scope w kodzie Next.js importuj przez `packages/app/server/services.ts`. Serwerowy projekt Vitest używa warunku `react-server` w resolverach Vite/SSR oraz inliningu rzeczywistego pakietu `server-only`, aby respektować jego publiczne eksporty bez mockowania granicy. Osobny projekt komponentów React działa w jsdom bez warunku `react-server`.
- Zainstalowana dystrybucja `.agents/skills/` zawiera także niewypełnione szablony kodu i nie należy do źródeł aplikacji. Prettier i ESLint pomijają wyłącznie ten katalog; kod pakietów, narzędzia projektu i testy pozostają objęte kontrolami.
- Komponenty shadcn/ui dodawaj z root: `npm run ui:add -- <nazwa>`. Konfiguracje `components.json` muszą kierować wspólne komponenty do `packages/ui`.

### Egzekwowanie standardów inżynieryjnych

- TypeScript: `strict`, `noUncheckedIndexedAccess` i `exactOptionalPropertyTypes`. Dane z zewnątrz mają typ `unknown` i walidację runtime; konfigurację PostgreSQL waliduje Zod przed utworzeniem puli.
- Kod i kontrakty po angielsku; zwykłe pliki `kebab-case`. Publiczne funkcje i porty mają jawne wyniki. ESLint blokuje nieobsłużone Promise, nieprawidłowe importy typów, `any` i non-null assertion. Wyłączenie reguły wymaga lokalnego uzasadnienia.
- `npm run deps:check` kontroluje deklaracje zależności, importy/reeksporty (również typów, `require` i literalne dynamiczne importy), eksporty publiczne i cykle. Import względny nie może przekraczać pakietu; alias nie może używać `..`. W `ui` dane przepływają wyłącznie przez props.
- Każda nowa funkcja musi mieć 100% pokrycia testami jednostkowymi: lines, branches, functions i statements. Dotyczy to wszystkich pakietów (`app`, `core`, `db`, `ui`) oraz narzędzi projektu, a także zmian istniejących funkcji; testy integracyjne i E2E nie zastępują testów jednostkowych. `npm run test:coverage` obejmuje wszystkie pliki implementacji (również nieimportowane) i egzekwuje 100% każdej metryki dla każdego pliku. Nowe przypadki użycia należą do `core`. Wyłączone są wyłącznie deklaracje `.d.ts`; nie dodawaj wyjątków, ignorowania coverage ani obniżenia progów dla ominięcia tej zasady.
- `npm run test:integration` wymaga wcześniejszego `npm run build`, instalacji przeglądarki (`npm run test:browser:install`) i działającego Dockera i tworzy własny PostgreSQL 18.6 przez Testcontainers. Brak infrastruktury jest błędem, nie powodem pominięcia testu. Nie uruchamiaj testów destrukcyjnych na bazie użytkownika.
- `npm run test:e2e` wymaga wcześniejszego produkcyjnego buildu i Chromium (`npx --no-install playwright install --with-deps chromium`). Testy uruchamiają własny serwer na porcie 3100, sprawdzają desktop/mobile i klawiaturę; zachowują trace po błędzie.
- Logi JSON: UTC, requestId, operacja i bezpieczny kod. Nie przekazuj do loggera sterownika, SQL, tokenów ani prywatnych danych. `db:check` używa allowlisty pól zamiast serializacji wyjątku.
- CI ma minimalne uprawnienia, pełne SHA Actions i `ci-required`, który wymaga sukcesu wszystkich zależności. Niezaufane PR nie otrzymują sekretów wdrożeniowych. Review i `ci-required` muszą zostać wymagane w ustawieniach GitHub; sam workflow nie tworzy ochrony gałęzi.
- `npm run security:check` blokuje każdą podatność runtime oraz nowe advisory narzędzi. Czasowe wyjątki tylko dev opisuje `security-exceptions.json`: ścisłe GHSA, właściciel, uzasadnienie i termin; po terminie kontrola musi zawieść. Nie stosuj ogólnego podnoszenia progu severity ani `--force`.

## Obowiązkowy workflow AI

Te instrukcje obowiązują wszystkich agentów pracujących w tym repozytorium. Zasady utrzymuj w `AGENTS.md`; `CLAUDE.md` wczytuje je przez `@AGENTS.md`, bez powielania treści.

### Struktura projektu

- `.ai/specs/YYYY-MM-DD-slug.md` — specyfikacje SDD (Specification-Driven Development) planowanych i trwających zmian.
- `.ai/specs/implemented/` — specyfikacje w pełni zaimplementowanych i zweryfikowanych zmian.
- `.ai/specs/archive/` — specyfikacje wycofane, zastąpione lub porzucone.
- `.ai/runs/YYYY-MM-DD-slug.md` — przyrostowe dzienniki zadań; dokładnie jeden plik na zadanie.
- `.ai/lessons.md` — indeks trwałych ustaleń, wniosków i usprawnień.
- `.ai/lessons/` — szczegółowe opisy wniosków, do których prowadzą linki z indeksu.

`YYYY-MM-DD` oznacza datę kalendarzową, a `slug` krótki, opisowy identyfikator zapisany małymi literami ASCII i rozdzielony myślnikami. Nie dodawaj do tych plików sekretów ani danych uwierzytelniających. Wszystkie artefakty tego workflow przechowuj w repozytorium i dołączaj do zmian, których dotyczą.

### Rozpoczęcie i wznowienie zadania

1. Przed pracą przeczytaj `AGENTS.md`, `CLAUDE.md`, `.ai/lessons.md` i powiązane opisy w `.ai/lessons/`.
2. Znajdź specyfikację i istniejący dziennik zadania. Przy wznowieniu, kolejnej sesji lub przejęciu pracy od innej osoby przeczytaj cały dotychczasowy dziennik i kontynuuj ten sam plik.
3. Przed implementacją zmiany prowadzonej w SDD utwórz lub uzupełnij specyfikację. Zapisz cel, zakres, kryteria akceptacji i sposób weryfikacji. Realizuj zmianę według tej specyfikacji; przy zmianie zakresu zaktualizuj ją.
4. Drobne zadanie bez osobnej specyfikacji może mieć w dzienniku `Specyfikacja: brak`. Nie twórz fikcyjnego odnośnika.

### Planowanie i weryfikacja zmian

- Złożone zadanie zacznij od planu: określ kroki, zależności, ryzyka i sposób sprawdzenia wyniku. W SDD zapisz plan w istniejącej specyfikacji, bez tworzenia równoległego dokumentu.
- Jeśli weryfikacja ujawni błędne założenia lub zmieni się zakres, zatrzymaj implementację, popraw plan i dopiero kontynuuj.
- Przy naprawie błędu ustal przyczynę na podstawie odtworzenia problemu, logów lub testów; dodaj test regresji, gdy pozwoli on trwale wykrywać ten błąd.
- Przed uznaniem zadania za ukończone przejrzyj diff i sprawdź kryteria akceptacji. Uruchom kontrole adekwatne do zmiany (np. testy, lint, sprawdzanie typów, build), a zmiany UI sprawdź także w działającej aplikacji. Podaj wyniki oraz kontrole, których nie udało się wykonać.

### Specyfikacje SDD

- Każda specyfikacja musi mieć nazwę `YYYY-MM-DD-slug.md`; data oznacza dzień utworzenia. Zachowaj nazwę przy późniejszych aktualizacjach i przenoszeniu.
- Po spełnieniu kryteriów akceptacji i zakończeniu weryfikacji przenieś specyfikację do `implemented/`. Wycofaną, zastąpioną lub porzuconą specyfikację przenieś do `archive/`, zapisując powód i ewentualny link do następcy.
- Przy przenoszeniu popraw aktywne odnośniki, w tym link w nagłówku dziennika. Nie przepisuj historycznych wpisów dziennika.

### Dziennik zadania i każdy commit

- Utwórz `.ai/runs/YYYY-MM-DD-slug.md` podczas przygotowania pierwszego commita zadania. Data w nazwie to dzień rozpoczęcia zadania, nawet jeśli pierwszy commit następuje później.
- Używaj dokładnie jednego dziennika na zadanie. Nie zmieniaj jego nazwy i nie zakładaj nowego pliku przy kolejnej sesji, zmianie wykonawcy ani zmianie dnia.
- Zachowaj na początku pliku stały blok nagłówka: tytuł, cele zadania, link do specyfikacji (jeśli istnieje) oraz osobną linię `Status: in-progress` albo `Status: done`. Aktualizuj cele, odnośnik i status w tym bloku, zamiast dopisywać konkurencyjny nagłówek.
- Ustaw `Status: done` dopiero po ukończeniu całego zadania i jego weryfikacji. Koniec sesji ani pojedynczy commit nie oznaczają ukończenia zadania. Jeśli zadanie zostaje wznowione z dalszym zakresem, przywróć `Status: in-progress`.
- Przy KAŻDYM commicie zadania dopisz na końcu tego samego dziennika wpis o długości 2–5 linii: data, zakres tego commita, decyzje lub napotkane pułapki oraz pozostała praca (albo informacja, że jej nie ma). Możesz zawrzeć także wynik weryfikacji.
- Przygotuj wpis PRZED commitem i dołącz dziennik do TEGO SAMEGO commita co opisane zmiany. Nie odkładaj wpisów do końca sesji, nie twórz osobnego późniejszego commita tylko na zaległy zapis.
- Wcześniejsze wpisy są niezmienne: nie edytuj, nie usuwaj ani nie porządkuj ich wstecz. Korektę wcześniejszej informacji dopisz jako nowy wpis. Edytowalny pozostaje wyłącznie nagłówek.
- Przed commitem sprawdź przygotowany diff: musi zawierać aktualny nagłówek oraz nowy wpis opisujący rzeczywisty zakres zmian. Jeśli jeden commit obejmuje kilka zadań, uzupełnij każdy właściwy dziennik.
- Nie wykonuj commita bez wymaganego wpisu w dzienniku. Samo prowadzenie dziennika nie stanowi polecenia wykonania commita.
- Wzór pliku i czteroliniowego wpisu znajduje się w `.ai/runs/README.md`.

### Ustalenia i pamięć długoterminowa

- Po poprawce użytkownika, naprawie błędu lub odkryciu trwałej reguły sprawdź, czy wniosek pomoże przy następnych zadaniach. Jeśli tak, zapisz go przed zakończeniem pracy i dołącz do commita dotyczącego tej zmiany. Gdy wniosek zmienia ogólne zasady pracy, uaktualnij także odpowiednią regułę w `AGENTS.md` zamiast dodawać jej duplikat.
- Krótkie ustalenie zapisz bezpośrednio w `.ai/lessons.md`. Dłuższy opis umieść w `.ai/lessons/slug.md`, a w indeksie dodaj zwięzłe podsumowanie z linkiem.
- Zapisuj kontekst, przyczynę problemu, sprawdzone rozwiązanie oraz sposób zapobiegania lub weryfikacji. Oddzielaj potwierdzone fakty od hipotez.
- Najpierw sprawdź istniejące wpisy; aktualizuj powiązany wniosek zamiast mnożyć duplikaty. Poprawiaj nieaktualne ustalenia i wskazuj, co je zastąpiło.
- Dziennik opisuje przebieg konkretnego zadania; lessons przechowują wiedzę przydatną w kolejnych zadaniach. Nie kopiuj do lessons całych dzienników.
