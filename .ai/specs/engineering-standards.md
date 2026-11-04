> **Źródło i stan wdrożenia:** poniżej zachowano import pierwotnej propozycji. Kanoniczny plan, kryteria i bieżące wyniki znajdują się w [datowanej specyfikacji](2026-11-03-engineering-standards.md), a przebieg w [jednym dzienniku zadania](../runs/2026-11-03-engineering-standards.md).
> Późniejsze decyzje użytkownika mają pierwszeństwo: npm workspaces i jeden package-lock.json, 100% czterech metryk coverage dla wszystkich implementacji oraz lokalne demo bez kont zewnętrznych. Propozycje pnpm i słabszego zakresu coverage z poniższego importu nie obowiązują. Warunki rzeczywistych dostawców i produkcji pozostają otwarte; stan lokalnej implementacji jest w kanonicznym planie.

## Specyfikacja technologii i standardów DevMentor

**Status: propozycja do realizacji. Data: 3 listopada 2026.** DevMentor łączy programistów z mentorami i obejmuje profile, wyszukiwanie, dostępność, rezerwacje, wiadomości, płatności oraz panel administracyjny. Rekomendowany fundament to modularny monolit w TypeScript: Next.js i React, PostgreSQL, MikroORM, Awilix, Tailwind CSS oraz shadcn/ui. Największą wagę mają spójność rezerwacji, poprawność rozliczeń i kontrola dostępu.

Podstawą jest projekt **DevMentor** opisany na tej stronie i w załączonym `README.md`, z granicami architektury określonymi w `AGENTS.md`. Przyjmujemy mały zespół oraz MVP aplikacji webowej. „Najlepszy stack” oznacza tu dopasowanie do wymagań, poprawność rezerwacji i rozliczeń oraz niski koszt utrzymania. Cele wydajności i niezawodności są kryteriami do zatwierdzenia i pomiaru.

### Wybór architektury i alternatywy

| Decyzja | Wybór dla DevMentor | Uzasadnienie i warunek zmiany |
| - | - | - |
| Architektura | Modularny monolit, jedno repozytorium, wspólny model danych | Ułatwia transakcje i rozwój małemu zespołowi. Wydzielenie usługi wymaga udokumentowanej potrzeby niezależnego skalowania, wdrażania lub izolacji. |
| Frontend i backend | Next.js App Router i React | Zachowuje ustalenia projektu i wspólny TypeScript. Oddzielne API, np. NestJS, rozważyć przy niezależnych klientach i zespołach; teraz zwiększa zakres utrzymania. |
| Persystencja | PostgreSQL i MikroORM | Relacyjny model pasuje do rezerwacji i płatności. Pozostajemy przy jednym ORM domenowym; zmiana na Prisma lub Drizzle wymaga ADR z korzyścią przewyższającą koszt migracji. |
| Wyszukiwanie | Filtrowanie i wyszukiwanie tekstowe PostgreSQL | Osobny silnik dopiero po pomiarach jakości lub czasu odpowiedzi. |
| Zadania w tle | Trwała tabela zadań i outbox w PostgreSQL, osobny proces roboczy | Obsługuje przypomnienia, webhooki i ponowienia. Redis i kolejka zewnętrzna dopiero przy wykazanych ograniczeniach. |
| Wiadomości | Trwały zapis, stronicowanie i okresowe odświeżanie w MVP | WebSocket lub SSE po ustaleniu wymagań czasu rzeczywistego. Wideorozmowy początkowo przez link do zewnętrznego spotkania. |

Wybór wynika z dopasowania do wymagań i zastanej architektury. Sama popularność technologii ani deklarowana jakość kodu generowanego przez AI nie stanowią kryterium rozstrzygającego.

| Alternatywa | Ocena dla obecnego DevMentor |
| - | - |
| Django lub Laravel | Rozsądne przy zespole znającym Python lub PHP. Obecne ustalenia TypeScript i React przemawiają za zachowaniem jednego języka. |
| React SPA i osobne NestJS API | Przydatne przy niezależnych klientach i cyklach wydań. W MVP zwiększa liczbę wdrożeń i kontraktów do utrzymania. |
| Prisma lub Drizzle | Warto porównać przy nowym projekcie bez ustaleń. Tu MikroORM zapewnia uzgodnione Unit of Work i identity map; migracja wymaga konkretnej korzyści. |
| Mikroserwisy i Kubernetes | Wymagają obsługi komunikacji, wdrożeń i spójności rozproszonej. Wracamy do nich przy potrzebie izolacji lub niezależnych zespołów. |
| Serverless dla całego backendu | Wymaga osobnego rozwiązania trwałych zadań oraz budżetu połączeń bazy. Kontenery web i worker pasują do obecnego modelu. |

Porównanie jest oceną architektoniczną dla założonego MVP, a nie benchmarkiem wydajności tych technologii.

### Docelowy stack

| Obszar | Technologia | Zasada użycia |
| - | - | - |
| Runtime | Node.js z aktywnej linii LTS, bazowo 26.x | Dokładny patch i obraz kontenera utrwalone po sprawdzeniu zgodności całego zestawu. Linia 26 jest LTS według harmonogramu Node.js [1]. |
| Aplikacja | Stabilny Next.js, React i TypeScript | App Router; zgodne wersje według wymagań Next.js. Bez canary i RC. Biblioteki serwerowe działają w runtime Node.js [2]. |
| Workspace | pnpm workspaces | Cztery pakiety, jeden lockfile, zależności wewnętrzne przez `workspace:*`. Na początku wystarczą skrypty pnpm; Turborepo po wykazaniu potrzeby cache zadań [3]. |
| Dane | PostgreSQL, MikroORM ze sterownikiem PostgreSQL | Stabilna wersja wspierana przez hosting; identyczny major bazy w testach. Pakiety MikroORM utrzymujemy w zgodnych wersjach [4][5]. |
| DI | Awilix | `strict: true`, jawne rejestracje, scope żądania i zadania; kontener tylko w composition root [6]. |
| UI | Tailwind CSS i shadcn/ui | Wspólne tokeny, komponenty w `packages/ui`; skopiowany kod komponentów podlega review i aktualizacjom [7]. |
| Walidacja | Zod | Schematy wejścia HTTP, formularzy, konfiguracji i komunikatów integracyjnych. Walidacja klienta wspiera UX, serwer jest rozstrzygający [8]. |
| Uwierzytelnianie | Better Auth z integracją Next.js i PostgreSQL | Propozycja uzupełniająca: sesje po stronie serwera, logowanie dostawcą OAuth i weryfikacja e-mail. Wymaga testu integracyjnego przed przyjęciem [9]. |
| Płatności | Stripe Checkout i Connect dla rozliczeń marketplace | Adapter `PaymentGateway`; uruchomienie produkcyjne zależy od zatwierdzonego modelu pobierania opłat, wypłat i zwrotów [10]. |
| Testy | Vitest, Testcontainers PostgreSQL, Playwright | Jednostkowe, integracyjne i trwałe testy E2E. agent-browser może wspierać eksplorację, a regresje utrwalamy w testach [11][12][13]. |
| Jakość | ESLint, typescript-eslint, Prettier, TypeScript | Jeden zestaw reguł w repozytorium; błędy i nieuzasadnione wyłączenia blokują PR. |
| Dostarczenie | GitHub Actions, kontener OCI, zarządzany PostgreSQL | Oddzielne środowiska i sekrety, staging przed produkcją, kontrolowane migracje. |
| Obserwowalność | Logi JSON i OpenTelemetry | Identyfikator żądania, ślady operacji rezerwacji i płatności, metryki kolejki i błędów [14]. |

**Bramka zgodności wersji:** przed implementacją zapisać dokładne wersje Node.js, pnpm, Next.js, React, TypeScript, MikroORM i PostgreSQL w manifestach, konfiguracji runtime, lockfile oraz obrazach. Potwierdzić instalację z zamrożonym lockfile, build produkcyjny, uruchomienie, migracje, działanie sesji i izolację EntityManagera. Nie stosować `latest` w CI ani wdrożeniach. Ten dokument nie zastępuje sprawdzenia kompatybilności w repozytorium.

Better Auth obsługuje PostgreSQL przez warstwę Kysely. Dla tabel tożsamości wybieramy oddzielny schemat `auth`, jawnie skonfigurowany przez `database.schemaName` w wersji obsługującej tę opcję albo przez kontrolowany `search_path`. Konfiguracja runtime i migracji musi wskazywać ten sam schemat. Migracje auth mają osobnego właściciela; MikroORM zarządza wyłącznie danymi domenowymi. Rola runtime nie otrzymuje uprawnień DDL. Łączny limit połączeń uwzględnia pulę auth, ORM i procesy robocze [9].

### Granice pakietów i modułów

| Pakiet | Odpowiedzialność | Dozwolone zależności wewnętrzne |
| - | - | - |
| `packages/app` | Routing, UI funkcji, endpointy, Server Actions, adaptery zewnętrzne, uruchomienie workera i konfiguracja DI | `core`, `db`, `ui` |
| `packages/core` | Reguły domenowe, przypadki użycia, polityki dostępu, DTO i porty repozytoriów oraz integracji | Brak |
| `packages/db` | Encje MikroORM, implementacje repozytoriów, transakcje, migracje domeny, outbox | `core` |
| `packages/ui` | Współdzielone komponenty, tokeny i style | Brak |

Przyjmujemy bardziej restrykcyjny wariant granic: `ui` otrzymuje dane przez props i nie importuje `core`. Starszy załącznik dopuszczał bezpieczne typy z `core`; ten wariant ogranicza ryzyko przypadkowego dołączenia kodu domenowego do klienta.

Moduły funkcjonalne: `identity`, `mentors`, `availability`, `bookings`, `payments`, `messaging` i `administration`. Zachowujemy ten sam podział w `core` i adapterach. Moduły udostępniają publiczne kontrakty; omijanie ich przez importy plików wewnętrznych jest zabronione. ESLint sprawdza zakazane importy, a kontrola grafu zależności wykrywa cykle.

### Wzorce projektowe

| Wzorzec | Zastosowanie | Ograniczenie |
| - | - | - |
| Ports and Adapters | `BookingRepository`, `PaymentGateway`, `NotificationSender`, `Clock` w `core`; implementacje poza domeną | Interfejs tworzymy na realnej granicy, bez abstrakcji dla każdej funkcji. |
| Use Case | `ReserveSession`, `ConfirmPayment`, `CancelBooking` | Handler odpowiada za transport; przypadek użycia egzekwuje reguły biznesowe i dostęp niezależnie od punktu wejścia. |
| Repository i Unit of Work | Transakcja obejmuje spójną operację domenową | Bez ogólnego CRUD repozytorium obchodzącego reguły rezerwacji; wszystkie repozytoria w transakcji używają tego samego EntityManagera. |
| State Machine | Jawne dozwolone przejścia rezerwacji i płatności | Stany płatności są oddzielne od stanów rezerwacji. |
| Transactional Outbox i Inbox | Zapis zmiany i zdarzenia atomowo; deduplikacja zdarzeń przychodzących | Przetwarzanie co najmniej raz, idempotentne skutki; nie obiecujemy globalnego exactly once. |
| Composition Root i DI | Składanie zależności w serwerowym `app` | Bez service locatora w domenie i przechwytywania scope żądania przez singleton. |

MikroORM wymaga osobnej identity map dla każdego żądania lub zadania: stosujemy `RequestContext` albo `em.fork()`, zachowując współdzieloną instancję ORM i pulę w obrębie procesu. Awilix scope jest tworzony dla tej samej jednostki pracy i zwalniany po zakończeniu [4][6]. Transakcje bazodanowe nie obejmują oczekiwania na Stripe ani wysyłkę e-maili.

### Model danych i niezmienniki

Minimalne obiekty domenowe: użytkownik powiązany z tożsamością auth, profil mentora, umiejętność, reguła dostępności, wyjątek kalendarza, rezerwacja, płatność, zwrot, rozmowa, uczestnik rozmowy, wiadomość, zdarzenie inbox, outbox oraz wpis audytowy.

1. **Rezerwacje:** dla jednego mentora aktywne przedziały nie mogą się nakładać. `starts_at` i `ends_at` mają typ `timestamptz`, są wymagane i spełniają `ends_at > starts_at`; przedział jest półotwarty `[start, end)`. Ograniczenie `EXCLUDE USING gist` łączy identyfikator mentora i `tstzrange` dla stanów `held` i `confirmed`. Migracja instaluje wymagane `btree_gist`, a hosting musi zezwalać na to rozszerzenie. Naruszenie constraintu mapujemy na konflikt terminu, również przy równoległych żądaniach [15].

2. **Czas:** konkretne sesje zapisujemy jako chwile czasu, a cykliczną dostępność jako lokalny dzień i godzinę wraz ze strefą IANA. Reguły DST testujemy dla godzin nieistniejących i powtórzonych; użytkownik zawsze widzi strefę terminu.

3. **Hold:** bazowo 15 minut, jako parametr produktu. Worker atomowo zmienia wygasły `held` na `expired`. Przed ponowną rezerwacją wolno wygasić przeterminowany hold w transakcji. Predykat indeksu nie zależy od `now()`.

**Hold i Stripe Checkout mają odrębne zegary.** Automatyczne `expires_at` sesji Checkout musi mieścić się między 30 minutami a 24 godzinami od jej utworzenia [22]. Dla proponowanego holda 15 minut worker zleca ręczne wygaśnięcie otwartej sesji Checkout, a lokalna transakcja zwalnia termin i zapisuje outbox. Awaria lub wyścig z płatnością uruchamia obsługę późnej zapłaty i uzgadnianie. Nie ustawiamy `expires_at` na 15 minut. Przy powolnych metodach płatności ukończenie Checkout nie oznacza otrzymania pieniędzy; potwierdzenie rezerwacji wymaga zweryfikowanego statusu zapłaty.

4. **Pieniądze:** kwota jako całkowita liczba najmniejszych jednostek waluty oraz kod waluty. Typ `Money` wymusza zgodność walut; `bigint` lub biblioteka dziesiętna obsługuje obliczenia i jawne zaokrąglenia prowizji. DTO przenosi kwoty jako ciągi cyfr; konwersja do API operatora sprawdza bezpieczny zakres liczby całkowitej. Rezerwacja przechowuje snapshot ceny, prowizji i zasad anulowania.

5. **Idempotencja:** ponowienie tego samego polecenia przez tego samego użytkownika zwraca poprzedni wynik. Klucz jest związany z aktorem, operacją i hashem wejścia; zmieniony payload z tym samym kluczem daje konflikt.

6. **Wiadomości:** odczyt i zapis wyłącznie dla uczestników; stronicowanie kursorem i limity długości. Uprawnienia administratora wynikają z jawnej polityki i są audytowane.

7. **Integralność:** klucze obce, wymagane pola, ograniczenia unikalności i indeksy wynikają z zapytań oraz reguł domeny. Usunięcie konta nie usuwa kaskadowo zapisów rozliczeń.

### Rezerwacja i płatność

1. Serwer uwierzytelnia użytkownika, sprawdza uprawnienia, dostępność i cenę; transakcja zapisuje hold oraz zadanie rozpoczęcia płatności.

2. Poza transakcją powstaje Checkout z kluczem idempotencji i identyfikatorem rezerwacji. Powrót przeglądarki do aplikacji pokazuje status, ale nie potwierdza zapłaty.

3. Webhook sprawdza podpis na surowym body, a następnie trwale zapisuje zdarzenie w inbox z unikalnym identyfikatorem dostawcy. Dopiero po trwałym przyjęciu zwraca sukces.

4. Worker sprawdza kwotę, walutę, powiązanie z rezerwacją i aktualny stan płatności. Transakcja aktualizuje płatność, rezerwację i outbox. Ponowione lub dostarczone poza kolejnością zdarzenie nie może cofnąć stanu ani powtórzyć skutku.

5. Jeśli płatność zakończy się po wygaśnięciu holda, system próbuje ponownie zająć termin pod ochroną ograniczenia bazy. Gdy termin jest zajęty, rezerwacja pozostaje niepotwierdzona, a system inicjuje idempotentny zwrot i zgłasza przypadek do obsługi.

6. Powiadomienia i zwroty mają retry z backoff, limit prób, stan wymagający interwencji oraz możliwość bezpiecznego ponowienia. Zadania mają lease; po awarii workera inne wykonanie może je przejąć.

Stripe nie gwarantuje kolejności webhooków i dopuszcza ich powtórzenia [16]. Osobny proces uzgadniania sprawdza zaległe płatności i zwroty u dostawcy. Rezerwacja przechodzi przez `held → confirmed → completed`, z dopuszczonym `held → expired` oraz anulowaniem według polityki. Zwrot ma odrębny stan `requested / pending / succeeded / failed`.

### Coding standards

- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `unknown` dla danych z zewnątrz. Jawny `any`, non-null assertion i wyłączenie reguł wymagają lokalnego uzasadnienia. `strict` wzmacnia kontrolę typów, ale nie zastępuje walidacji runtime [17].

- Nazwy: kod i kontrakty po angielsku; `camelCase` dla funkcji i zmiennych, `PascalCase` dla typów i komponentów, `kebab-case` dla zwykłych plików. Pliki konwencji Next.js zachowują wymagane nazwy.

- Publiczne funkcje i porty mają jawne typy wyników. Przypadki użycia zwracają rozróżnialne wyniki domenowe, np. `SlotUnavailable`; wyjątki infrastruktury są mapowane na odpowiedź bez ujawniania stosu i SQL.

- Formatowanie wykonuje Prettier. ESLint sprawdza m.in. nieobsłużone Promise, reguły hooków, importy typów i granice pakietów. Reguły i wersje narzędzi są wspólne.

- Funkcje mają jedną odpowiedzialność. Wspólne abstrahowanie wynika z powtarzającego się znaczenia biznesowego. Komentarze wyjaśniają powód lub nieoczywisty warunek.

- Domyślnie Server Components. `use client` tylko na potrzebnej granicy. Kod danych i sekretów oznaczony `server-only`; do klienta trafiają jawne DTO.

- Endpointy i Server Actions walidują dane oraz uwierzytelniają użytkownika; polityka dostępu jest ponownie egzekwowana w przypadku użycia. Server Action traktujemy jak publiczny punkt wejścia [18].

- Dla zewnętrznego API definiujemy kontrakt OpenAPI, stabilne kody błędów, limity i stronicowanie. Wewnętrzne wywołania serwerowe używają przypadków użycia bez zbędnego HTTP do własnej aplikacji.

- Zegary, identyfikatory i integracje można zastąpić w testach. Brak ukrytych zależności od globalnego czasu lub sieci w domenie.

### Bezpieczeństwo i interfejs

Stosujemy deny by default oraz sprawdzanie roli i relacji do konkretnego zasobu: uczeń widzi własne rezerwacje, mentor własny kalendarz, uczestnik własną rozmowę. Kontrola samej roli nie wystarcza [19]. Każdy scenariusz ma test dostępu do cudzego identyfikatora.

Sesje używają cookies `HttpOnly`, `Secure` i świadomie dobranego `SameSite`; zmiany uprawnień i wylogowanie muszą unieważniać dostęp. Operacje administracyjne wymagają MFA przed produkcją. Chronimy operacje cookie-based przed CSRF, ograniczamy logowanie i kosztowne mutacje, konfigurujemy CSP oraz walidujemy redirecty. Prywatne dane użytkownika nie trafiają do współdzielonego cache.

Sekrety pochodzą z magazynu środowiska. Logi nie zawierają tokenów, treści prywatnych wiadomości ani danych kart. Dostęp do plików prywatnych wymaga autoryzacji; upload ma limit rozmiaru, sprawdzenie rzeczywistego typu i odrębny storage obiektowy, gdy pojawi się taka funkcja.

Celem UI jest WCAG 2.2 AA: obsługa klawiatury, widoczny focus, etykiety formularzy, komunikaty błędów, kontrast i dostępny wybór terminu [20]. Każdy ekran ma stany loading, empty, error i success. Testy automatyczne uzupełnia ręczny przegląd kluczowych ścieżek klawiaturą.

### Testy i CI safety net

| Warstwa | Wymagane sprawdzenia |
| - | - |
| Jednostkowa | Reguły cen, stanów, uprawnień, czasu, anulowania i idempotencji; zegar i integracje zastępowalne. |
| Integracyjna | Prawdziwy PostgreSQL w Testcontainers, migracje od pustej bazy i z poprzedniej wersji, repozytoria, transakcje i izolacja kontekstów [12]. |
| Współbieżność | Dwie rezerwacje nakładającego się terminu: jedna wygrywa, druga otrzymuje konflikt; brak podwójnego obciążenia. |
| Integracje płatności | Zły podpis, duplikat, zdarzenia poza kolejnością, timeout, późna płatność, powtórzony zwrot i restart workera. |
| E2E | Logowanie, profil, wyszukiwanie, rezerwacja, status płatności, anulowanie, wiadomość i odmowa dostępu do cudzego zasobu. |
| UI | Klawiatura, mobile, błędy formularzy; stabilne lokatory i asercje oczekujące na stan zamiast stałych opóźnień [13]. |

Zgodnie z kierunkiem lekcji przyjmujemy **100% lines, branches, functions i statements dla nowej logiki domenowej oraz przypadków użycia**. Vitest zbiera także nieimportowane pliki z tego zakresu. Każde wyłączenie wymaga uzasadnienia w PR. Kod wygenerowany, deklaracje typów i zależności zewnętrzne wyłączamy jawnie. Adaptery, migracje i UI weryfikujemy odpowiednimi testami integracyjnymi i E2E; procent coverage nie jest dowodem poprawności [11].

Każdy PR uruchamia: instalację z zamrożonym lockfile, format check, lint, kontrolę typów i zależności, testy jednostkowe z coverage, integrację z bazą, produkcyjny build oraz krytyczne E2E. Job końcowy `ci-required` kończy się błędem, jeśli wymagany job nie przeszedł albo został pominięty. Nie wolno zastępować testu pustym sukcesem. Artefakty obejmują raporty i trace po błędzie, bez sekretów.

Workflow ma minimalne uprawnienia, a zewnętrzne Actions są przypięte do pełnego SHA. Kod z niezaufanego PR nie otrzymuje sekretów wdrożeniowych [21]. Merge wymaga zielonych checków dla aktualnego commita i review. Techniczną egzekucję należy sprawdzić w planie oraz ustawieniach repozytorium, zgodnie z ostrzeżeniem GitHub Free opisanym na tej stronie.

### Zasady konfiguracji i zależności

Konfigurację środowiska walidujemy przy starcie przez Zod. `.env.example` zawiera wyłącznie bezpieczne przykłady. Lockfile jest wersjonowany; aktualizacje zależności trafiają do małych PR z testami. CI skanuje sekrety i znane podatności; wyjątek wymaga właściciela, uzasadnienia i terminu. Nowa biblioteka wymaga sprawdzenia licencji, utrzymania i wpływu na zależności klienta.

Logi JSON zawierają poziom, czas UTC, `requestId`, operację i bezpieczny kod błędu. Metryki obejmują opóźnienia, konflikty terminów, błędy płatności i opóźnienia outbox. Wrażliwe dane podlegają redakcji przed wysłaniem do systemu obserwowalności.

### Wdrożenia i utrzymanie

Proponowane środowisko to zarządzany hosting kontenerów w regionie UE, web i worker jako osobne procesy tego samego wydania oraz zarządzany PostgreSQL z backupami i odtwarzaniem do punktu w czasie. Konkretny dostawca pozostaje decyzją budżetową; specyfikacja nie zakłada jego cen ani dostępności funkcji.

Migracje wykonuje jeden kontrolowany job, przed przełączeniem ruchu. Stosujemy expand and contract: najpierw zmiany zgodne z poprzednią aplikacją, później usuwanie nieużywanych struktur. Nie edytujemy wykonanych migracji. Wycofanie aplikacji musi być zgodne z bieżącym schematem; destrukcyjna migracja wymaga osobnego planu odzyskania [5].

Proponowane cele przed publicznym MVP: dostępność 99,5% miesięcznie, p95 odczytu API poniżej 500 ms i zapisu lokalnego poniżej 1 s, bez czasu zewnętrznego operatora. Test odbiorczy: 100 równoczesnych użytkowników na reprezentatywnych danych i uzgodnionym profilu ruchu. Cele odzyskiwania: RPO 15 minut i RTO 4 godziny, potwierdzone próbą odtworzenia. Przyjęcie tych celów wymaga dobrania hostingu i budżetu.

Alerty obejmują błędy płatności, wiek najstarszego zadania, wyczerpanie puli, wzrost 5xx i rozbieżności rozliczeń. Każdy alert ma właściciela i instrukcję reakcji.

### Proces inżynierski i kryteria gotowości

**Definition of Done:** spełnione kryteria akceptacji, test regresji dla zmienionego zachowania, testy odmowy dostępu, aktualne kontrakty i dokumentacja, zielone wymagane CI dla bieżącego commita oraz review. Zmiany danych obejmują sprawdzoną migrację i sposób wycofania aplikacji; nowe zadania w tle mają idempotencję, retry i monitoring.

Zmiana przechodzi przez opis potrzeby i kryteria akceptacji, specyfikację, mały PR, weryfikację, review i wdrożenie na staging. Decyzje architektoniczne zapisujemy w ADR z kontekstem, alternatywami i konsekwencjami. `README.md` opisuje rzeczywisty sposób uruchomienia; `AGENTS.md` zawiera wykonywalne reguły i komendy. Specyfikacje trafiają do `.ai/specs/YYYY-MM-DD-slug.md`, a dziennik zadania jest kontynuowany w jednym pliku `.ai/runs`. Zmiana dokumentacji nie oznacza wdrożenia systemu.

| Etap | Warunek ukończenia |
| - | - |
| Fundament | Powtarzalna instalacja, granice czterech pakietów, produkcyjny build, migracja pustej bazy, DI i CI. |
| Tożsamość i katalog | Sesje, profile, wyszukiwanie i serwerowe polityki dostępu przetestowane na cudzych zasobach. |
| Rezerwacje | Ograniczenie nakładania terminów, hold, DST i test współbieżności przechodzą. |
| Rozliczenia | Checkout w sandboxie, inbox/outbox, późna płatność, zwroty i uzgadnianie mają testy. |
| Publiczne MVP | Krytyczne E2E, dostępność UI, monitoring, próba odtworzenia i rollback potwierdzone. |

Przed rozliczeniami produkcyjnymi trzeba ustalić: kto sprzedaje usługę, prowizję, waluty i kraje działania, moment wypłaty mentorowi, zasady anulowania, zwrotów i sporów. Przed startem trzeba również uzgodnić retencję danych, zasady dostępu administracji, przewidywany ruch i miesięczny budżet. Te decyzje nie blokują przygotowania fundamentu.

### Źródła techniczne

Źródła pierwotne sprawdzone 3 listopada 2026. Dobór architektury, narzędzi i progów jest rekomendacją dla DevMentor; dokumentacja potwierdza mechanizmy oraz wymagania technologii.

1. [Node.js Release Working Group i harmonogram LTS](https://github.com/nodejs/Release)

2. [Next.js instalacja i wymagania](https://nextjs.org/docs/app/getting-started/installation)

3. [pnpm workspaces](https://pnpm.io/workspaces)

4. [MikroORM identity map i kontekst żądania](https://mikro-orm.io/docs/identity-map)

5. [MikroORM migracje](https://mikro-orm.io/docs/migrations)

6. [Awilix scope i strict mode](https://github.com/jeffijoe/awilix)

7. [shadcn/ui dokumentacja](https://ui.shadcn.com/docs)

8. [Zod walidacja runtime](https://zod.dev/)

9. [Better Auth integracja Next.js](https://better-auth.com/docs/integrations/next) i [adapter PostgreSQL](https://better-auth.com/docs/adapters/postgresql)

10. [Stripe Connect dla platform i marketplace](https://docs.stripe.com/connect)

11. [Vitest coverage](https://vitest.dev/guide/coverage.html)

12. [Testcontainers PostgreSQL dla Node.js](https://node.testcontainers.org/modules/postgresql/)

13. [Playwright dobre praktyki](https://playwright.dev/docs/best-practices)

14. [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)

15. [PostgreSQL zakresy i exclusion constraints](https://www.postgresql.org/docs/current/rangetypes.html)

16. [Stripe webhooki i ich niezawodna obsługa](https://docs.stripe.com/webhooks)

17. [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html)

18. [Next.js bezpieczeństwo danych i Server Actions](https://nextjs.org/docs/app/guides/data-security)

19. [OWASP kontrola dostępu](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

20. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

21. [GitHub Actions bezpieczne workflow](https://docs.github.com/en/actions/reference/security/secure-use)

22. [Stripe oficjalne SDK i ograniczenia czasu wygaśnięcia Checkout](https://github.com/stripe/stripe-dotnet/blob/master/src/Stripe.net/Services/Checkout/Sessions/SessionCreateOptions.cs) oraz [zarządzanie ograniczoną dostępnością](https://docs.stripe.com/payments/checkout/managing-limited-inventory).