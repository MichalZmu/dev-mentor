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

- Zachowuj kierunek zależności: `app → core/db/ui`, `db → core`, `ui → core` tylko dla wspólnych typów i narzędzi przydatnych w UI. `core` nie zależy od pozostałych pakietów; unikaj cykli i importów wewnętrznych plików innego pakietu.
- Dostęp do bazy i kontener Awilix utrzymuj po stronie serwera. Rejestruj zależności w serwerowej części `app`, a do usług przekazuj je jawnie; nie pobieraj kontenera globalnie wewnątrz logiki biznesowej.
- W `db` utrzymuj współdzieloną pulę połączeń oraz izolowany kontekst EntityManager dla każdego żądania lub zadania. Nie współdziel stanu żądania między singletonami Awilix.
- Zmiany schematu bazy opisuj wersjonowanymi migracjami MikroORM w `db`. Komponenty UI nie importują `db`, kontenera DI ani sekretów; przekazuj im dane przez jawne kontrakty.
- Wspólne komponenty utrzymuj w `ui`, a widoki specyficzne dla aplikacji w `app`. Tailwind służy do stylowania, a shadcn/ui dostarcza komponenty panelu administracyjnego. Granicę komponentów klienta wyznaczaj zgodnie z lokalną dokumentacją Next.js.

### Konfiguracja i kontrole

- Wymagany jest Node.js >=22.17 (MikroORM 7); wersja środowiska developerskiego jest w `.nvmrc`. Używaj `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` i `npm run build` z root.
- Konfigurację lokalną przechowuj w root `.env`, korzystając z `.env.example`. Ładowanie pliku środowiska należy do konfiguracji Next.js i wejść CLI, a moduły `db` używane przez aplikację czytają `process.env`. Nie dodawaj plików `.env` do bundla przez statyczne `new URL(..., import.meta.url)`.
- Schematy encji rejestruj jawnie w `packages/db/src/config.ts`; używaj API MikroORM zgodnego z bundlerem (np. `defineEntity`). Migracje uruchamiaj jawnie przez CLI, nie automatycznie podczas startu aplikacji.
- Kontenery i scope w kodzie Next.js importuj przez `packages/app/server/services.ts`. Testy integracji serwerowych modułów uruchamiane przez `npm test` używają warunku `react-server`, aby respektować `server-only`.
- Komponenty shadcn/ui dodawaj z root: `npm run ui:add -- <nazwa>`. Konfiguracje `components.json` muszą kierować wspólne komponenty do `packages/ui`.

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
