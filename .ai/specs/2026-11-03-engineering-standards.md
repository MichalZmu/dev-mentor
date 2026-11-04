# Standardy inżynieryjne DevMentor

Data utworzenia: 2026-11-03
Status: in-progress (wdrożenie lokalne zweryfikowane; warunki produkcyjne otwarte)

## Plan wdrożenia standardów — 2026-11-03

Cel: wdrożyć cały opisany produkt oraz egzekwować standardy. Użytkownik 2026-11-03 jawnie potwierdził pełny zakres z rezerwacjami i płatnościami oraz zachowanie npm/package-lock.json. Funkcje realizujemy etapami w ramach tej samej specyfikacji i dziennika.

Zakres pierwszego przyrostu: powtarzalna instalacja, ścisły TypeScript, formatowanie i lint, granice i cykle zależności, Vitest i coverage domeny, integracja PostgreSQL/Testcontainers, krytyczne E2E istniejących stron, bezpieczne CI, walidacja konfiguracji i dokumentacja reguł.

Plan i zależności:
1. Zachować zastane zmiany, potwierdzić bazowe kontrole i aktualne wersje. Bazowe lint/typecheck/8 testów: PASS.
2. Ujednolicić reguły i narzędzia; usunąć naruszenia w istniejącym kodzie. Instalacja tylko z root i jeden lockfile.
3. Dodać miarodajne kontrole granic (również importy względne/cykle), konfiguracji, rzeczywistej bazy i istniejących stron.
4. Zbudować CI z końcowym ci-required, raportami po błędzie i minimalnymi uprawnieniami; uaktualnić README i AGENTS.
5. Zamrozić źródła, wykonać niezależną weryfikację i review; poprawić uzasadnione uwagi, ponowić dotknięte kontrole.

Kryteria przyrostu i weryfikacja:
- AC-S1: jedna instalacja i spójne wersje; instalacja z zamrożonym lockfile, lista zależności, produkcyjny build i start.
- AC-S2: strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes, Prettier, typowane reguły Promise i importów; format/lint/typecheck przechodzą, negatywne scenariusze wykrywają naruszenia granic i cykle.
- AC-S3: zgodnie z późniejszą decyzją użytkownika Vitest zbiera wszystkie implementacje aplikacji, UI, bazy, domeny, migracji i narzędzi (także nieimportowane) i egzekwuje 100% lines/branches/functions/statements per plik. Zakres i testy są koordynowane z osobnym zadaniem GitHub CI; bez pustych testów sukcesu.
- AC-S4: PostgreSQL w Testcontainers, rzeczywiste SELECT/transakcje/izolacja i CLI migracji pustej bazy; test nie jest pomijany przy braku Dockera. Nie dodawać fikcyjnej migracji domenowej.
- AC-S5: Playwright sprawdza istniejące strony i nawigację na produkcyjnym serwerze, także mobilnie i klawiaturą; trace po błędzie.
- AC-S6: CI zawiera wymagane kontrole i ci-required odrzucający skipped/failure/cancelled; Actions przypięte do pełnych SHA, brak sekretów wdrożeniowych.
- AC-S7: konfiguracja runtime jest walidowana bez ujawniania sekretów; README/AGENTS opisują rzeczywiste komendy i pozostałe etapy.

Ryzyka i rozstrzygnięcia:
- Użytkownik rozstrzygnął konflikt: npm workspaces i jeden package-lock.json zamiast rekomendowanego pnpm.
- Przyjmujemy restrykcyjne granice ui bez core zgodnie z docelowym standardem; aktualizujemy AGENTS.
- Wdrażamy adaptery Better Auth/Stripe; użytkownik potwierdził brak konfiguracji dostawców i wybrał lokalny tryb demonstracyjny. Testujemy lokalne adaptery i syntetyczne podpisane webhooki, jawnie odróżniając je od dowodu sandboxa Stripe.
- Brak ustawień zdalnego repozytorium i środowiska produkcyjnego nie pozwala potwierdzić branch protection, staging, backupów ani SLO. Workflow lokalny nie stanowi takiego potwierdzenia.
- Dokument zachowuje zastaną nazwę wskazaną w poleceniu użytkownika; nie przenosić całej specyfikacji do implemented przed wdrożeniem pozostałych etapów.

## Rozszerzony plan produktu — decyzja użytkownika 2026-11-03

7. Uzgodnić jawne kontrakty modułów; wdrożyć reguły domenowe, encje/migracje PostgreSQL i repozytoria, wspólną integralność terminów, idempotencję, inbox/outbox oraz audyt.
8. Wdrożyć serwerowe uwierzytelnianie/sesje, walidację transportu i polityki zasobów, API, Stripe Checkout/Connect/refunds oraz worker z lease/retry/uzgadnianiem. Proces web nie wykonuje migracji.
9. Wdrożyć publiczny katalog, profil, rezerwację i checkout, panele użytkownika/mentora, wiadomości i administrację na shadcn/ui; wszystkie dane trwale w PostgreSQL, brak przełącznika roli jako autoryzacji.
10. Sprawdzić krytyczne przepływy od końca do końca, odmowy dostępu, współbieżność, migracje, podpisy/deduplikację/late-payment, retry/crash, DST i pieniądze; niezależna weryfikacja oraz review.

AC-P1: Rejestracja/logowanie/wylogowanie, weryfikacja e-mail i unieważnianie sesji działają; role i własność są sprawdzane na serwerze, admin ma bramkę MFA przed produkcją.
AC-P2: Publiczny katalog, profile, filtry, dostępność ze strefą, aplikowanie/akceptacja mentora i edycja własnej oferty działają na trwałych danych; brak publikacji przed moderacją.
AC-P3: Hold 15 minut, półotwarte przedziały, niezmienniki SQL i konkurencyjne rezerwacje; cena/prowizja/zasady są snapshotem, idempotencja odrzuca zmieniony payload.
AC-P4: Checkout, podpisany trwały inbox, worker i outbox, duplikaty/out-of-order/late-payment/refund/retry/reconcile działają; powrót klienta nie zmienia zapłaty, Checkout nie dostaje expires_at=15min.
AC-P5: Własne sesje, przełożenie/anulowanie z polityką, kalendarz ICS, prywatne notatki, ukończenie/opinia, cele/plan, pakiety/kredyty i rozliczenia są egzekwowane przez serwer.
AC-P6: Rozmowy są dostępne tylko uczestnikom, wiadomości są stronicowane i renderowane jako tekst; administracja/moderacja/support mają jawne polityki i append-only audit.
AC-P7: UI zapewnia kompletne ścieżki użytkownika, mentora i administracji, loading/empty/error/success, klawiaturę i mobile; krytyczny E2E używa prawdziwej aplikacji i bazy.
AC-P8: Logi JSON bez sekretów, telemetry/health/metryki workerów, web i worker uruchamiane niezależnie z jednego wydania, kontrolowane migracje i instrukcje backup/rollback. SLO/hosting/realne integracje bez dostępu pozostają jawnymi ograniczeniami, nie są przedstawiane jako zweryfikowane.

Domyślne parametry lokalnego wdrożenia z koncepcji: sesja50min, PLN, prowizja15%, cutoff24h, pakiet4sesji/90dni/autoRenew=false. Hold15min ma pierwszeństwo nad starszą koncepcją10min. Parametry są jawne i nie oznaczają zatwierdzenia modelu rozliczeń produkcyjnych; nie wykonujemy realnych obciążeń ani wypłat w tym zadaniu.

## Docelowe standardy i kolejne etapy

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
| Workspace | npm workspaces | Decyzja użytkownika: cztery pakiety, jeden `package-lock.json`, instalacja `npm ci` i polecenia z root. pnpm [3] pozostaje rozważaną alternatywą; nie wprowadzamy drugiego lockfile. |
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

**Bramka zgodności wersji:** przed implementacją zapisać dokładne wersje Node.js, npm, Next.js, React, TypeScript, MikroORM i PostgreSQL w manifestach, konfiguracji runtime, lockfile oraz obrazach. Potwierdzić instalację z zamrożonym lockfile, build produkcyjny, uruchomienie, migracje, działanie sesji i izolację EntityManagera. Nie stosować `latest` w CI ani wdrożeniach. Ten dokument nie zastępuje sprawdzenia kompatybilności w repozytorium.

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

Zgodnie z jawnym rozszerzeniem użytkownika przyjmujemy **100% lines, branches, functions i statements per plik wszystkich nowych i istniejących implementacji**, obejmując domenę, przypadki użycia, UI, adaptery, CLI i migracje. Vitest zbiera także nieimportowane pliki z tego zakresu. Każde wyłączenie wymaga uzasadnienia w PR. Kod wygenerowany, deklaracje typów i zależności zewnętrzne wyłączamy jawnie. Adaptery, migracje i UI weryfikujemy odpowiednimi testami integracyjnymi i E2E; procent coverage nie jest dowodem poprawności [11].

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
## Plan korekt R1 po odczycie i reprodukcji

- D1: checkout blokuje booking przed odczytem/oceną stanu; regresja realnego wyścigu expiry/checkout sterowana stanem blokady PostgreSQL.
- D2: saveMentor egzekwuje wersję atomowo; dwa równoległe żądania tej samej wersji dają jeden sukces i jeden409.
- V1: worker pobiera zamówienie Checkout przez nazwany lookup poID, a uzgadnianie ma stronicowanie i sprawiedliwą iterację; >100starych pending nie może ukryć nowych zamówień. Brak obiektu zadania nie jest cichym sukcesem. Regresja101zamówień.
- V2: desktop/mobile E2E korzystają z rozłącznych dostępnych slotów, bez ukrywania409 przez retry.
- V3: README opisuje rzeczywisty produkt, tryb demo i pozostałe warunki integracji/produkcji.
- Po korektach ponowić dotknięte kontrole oraz pełną niezależną weryfikację i review; stan r0 nie jest dowodem r1. Użytkownik upoważnił bezpośrednią koordynację z chatem GitHub CI; chronimy jego testy i uzgadniamy wyłączne okno instalacji/freeze.

## Plan korekt R2 po niezależnej weryfikacji i review

- Q1: Migrator tworzył `.snapshot-{testDatabase}.json` w katalogu pracy mimo SQL-owned schema. Wyłączyć snapshot jawnie w programmatic migration i CLI; potwierdzić migrację na realnym PostgreSQL z read-only CWD i brak powstawania artefaktów. Zachować dotychczasowe artefakty diagnostyczne w `/tmp` z sumami. Nie maskować błędu formatowania regułą ignore.
- R-PAY1 (P1): po atomowym rozpoczęciu checkoutu wybór metody płatności nie może zmienić się z PSP na kredyt przy innym kluczu. Ochrona obejmuje kolejkę/in-flight gateway przed attachCheckout. Regresja realnego PostgreSQL potwierdza brak zużycia kredytu i podwójnego skutku przy późnym provider paid.
- R-AVL1 (P2): usunięta reguła nie może przywrócić wygenerowanego slotu po wygaśnięciu holda. Zachować historyczne/aktywne rezerwacje, ale wycofać nieobowiązujące terminy także dla bezpośredniego starego slotId. Sprawdzić removeRule→expire→publicavailability i directoldID oraz niezmienioną potwierdzoną sesję.
- Nowe zmiany schematu realizować kolejną migracją, bez edycji wykonanych001–003. Po poprawkach przygotować R2SOURCEhandoff, dopasować100%unit w drugimzadaniu, wspólnyfreeze/fingerprint, ponowić dotknięte kontrole i review. R1wyniki to historia, nie dowódR2.

Dalsze potwierdzone poprawki w tej samej rundzie R2:
- R-CAT1 (P2): API musi przyjmować własny zwrócony kursor katalogu (>100 znaków przy UUID). Oddzielić limit opaque cursor od limitu identyfikatorów. Regresja HTTP na22profilach UUID: druga strona, brak duplikatów i odrzucenie błędnego/nadmiernego tokenu.
- R-CAT2 (P2): wartości filtrów specjalizacji muszą być zgodne z danymi; jawne canonical option values w UI i porównanie niezależne od wielkości liter po stronie repozytorium. Regresja Frontend/frontend dla seed oraz opublikowanego profilu.
- R-OWN1 (P2): `/me/billing` pokazuje wyłącznie zamówienia aktora jako mentee. Centralna projekcja sesji uczestnika usuwa checkoutUrl/checkoutId dla mentora niebędącego właścicielem płatności, także w dashboardach i odpowiedziach mutacji. RealAuth HTTP potwierdza owner access, mentor404orders i brak tokenów w aliasach sesji.

- R-PAGE1 (P2): każdy widok listy stronicowanej konsumuje nextCursor. Dodać dostępne sterowanie stronami dla sesji, rozmów, kolejek administracyjnych, własnych zgłoszeń i opinii. Token pozostaje opaque; zachować filtry, reset strony po zmianie zasobu i stany błędów/ładowania. Nie zastępować stronicowania pobraniem całej historii. Realna próba22zasobów musi udostępnić także ostatnie2 i powrót.
- S-COUNT1 (P3): licznik otwartych spraw opiera się na faktycznym stanie pending, nie nieużywanym open. Korekta w tym samym kontrolerze i regresja danych.

## Końcowa weryfikacja R2 — wznowienie 2026-11-03

Implementacja i testy regresji powyższych korekt są oceniane na wspólnym, zamrożonym stanie źródeł. Po domknięciu unit100% prowadzący zapisze manifest SHA256, a odrębny weryfikator wykona format/lint/typecheck/deps/coverage/build/integrację/E2E/audyt. Odrębny reviewer sprawdzi poprawki API/UI i aktualność wcześniejszego dowodu domeny. Obraz OCI wymaga osobnej próby web/migrator/worker na nowej bazie testowej. Instalację npmci potwierdza istniejący niezależny dowód dla niezmienionego lockfile; przy zmianie lockfile wymaga ponowienia.

Spełnienie lokalnego zakresu demo nie potwierdza realnego Stripe/OAuth/SMTP, stagingu, PITR/SLO ani ochrony gałęzi i uruchomionego zdalnego CI. Status całej specyfikacji pozostaje in-progress, dopóki wszystkie wymagane zewnętrzne dowody nie są dostępne; wynik lokalny i te ograniczenia należy podać osobno.

## Korekta R3 — pokój uczestnika po końcowym review

R-ROOM1 (P2): pokój sesji pobiera dane przez owner-only `/orders/{id}`. Mentor będący uczestnikiem dostaje prawidłowy link join, lecz pokój nie może wczytać sesji. Zachować prywatność orders, dodać participant GET `/sessions/{id}` z istniejącą polityką service.booking i centralną sessionForActor oraz użyć go w SessionRoom. Uaktualnić kontrakt HTTP. Regresje: owner i mentor odczytują sesję, mentor nie otrzymuje Checkout; outsider ma404, order mentora nadal404; UI pokoju i rzeczywisty join/room na produkcyjnym E2E. Ponowić unit100%, kontrole jakości, build, integrację, E2E i delta review na nowym fingerprint. Hipoteza awarii ostatniej lease została wycofana po pełnym odczycie istniejącego terminal sweep, bez zmiany kodu.

## Korekta skanu sekretów po końcowej próbie

Skan Gitleaks8.30.1 wszystkich bieżących plików wykrył37 fałszywych alarmów wyłącznie na sumach SHA256 w trzech manifestach `.ai/runs/evidence/*json`. Przyczyna: nazwa pliku api/auth w kluczu JSON i64znakowa suma jako wartość. Każde zgłoszenie zweryfikowano jako pełny wpis ścieżka→hash, nie credential. Dodać konfigurację rozszerzającą wszystkie domyślne reguły, z wyjątkiem ograniczonym jednocześnie do reguły generic-api-key, konkretnych manifestów i pełnej linii wpisu plik→SHA256. Negatywna kontrola musi nadal wykrywać syntetyczny api_key w tym samym manifeście i poza nim; pozostałe reguły nie mogą być wyłączone. To korekta samego skanu, bez wpływu na build/runtime/unit; ponowić format i Gitleaks oraz review i aktualizować manifest.

## Korekta R4 — rzeczywisty produkcyjny E2E

E2E po finalnym buildzie wykrył dwa odrębne problemy. R-MAIL1: Next przy bind0.0.0.0 normalizuje wewnętrzny Request.url do tego adresu, więc demoMailbox odrzuca404 także poprawny lokalny klient. Wymagana jest poprawna walidacja lokalnego hosta transportu z zachowaniem bramki demo, powiązania mailbox cookie i odmowy obcych hostów/production; nie osłabiać kontroli dostępu. Odtworzyć na produkcyjnym Next i obrazie OCI, dodać unit100% oraz integrację/realne E2E rejestracji/mailbox/weryfikacji.

R-E2E1: cztery równoległe rejestracje z jednego IP naruszają prawidłowy limit BetterAuth signup3/10s. Izolować tożsamości klienta fixture zgodnie z modelem zaufanego proxy (syntetyczne IP wyłącznie w testach) lub tworzyć osobne instancje testowe. Nie zwiększać/wyłączać limitów runtime, nie maskować429 retry ani pominięciem asercji. Utrzymać równoległe desktop/mobile, rozłączne sloty, rejestrację/UI/mailbox i IDOR. Po korektach ponowić unit/quality/build/integrację/E2E/OCI i niezależny review na nowym manifest. Pozostałe53integracje,395unit100%,build,audyt i poprzednie review pozostają historycznym dowodem R3.

## Korekta R5 — responsywny panel i semantyczny selektor

R4: niezależne396unit100%×4,54integracje i kompletna próba OCI rejestracja/mailbox/verify/nativeHTTPforeignHost404/web/migrator/worker PASS. E2E desktop booking PASS; mobilne kliknięcia messages/send i paginacja/back są blokowane przy rozjechanych współrzędnych. Odczyt trace potwierdza configuredviewport412×839 i prawidłowy viewport na auth/katalogu, lecz panel rozszerza layoutviewport do913–917px. To nie jest dowód samego opóźnienia kliknięcia.

Plan R5: w kontrolowanej przeglądarce zmierzyć scrollWidth wobec zadanego viewport i szerokości workspace/sidebar/nav; potwierdzić wpływ automatycznego minimum toru1fr. Po zwolnieniu okna weryfikacji ograniczyć poprawkę do odpowiedniego toru minmax(0,1fr)/min-width0 z zachowaniem przewijalnej nawigacji. Nie stosować overflow:hidden do maskowania danych, forceclick ani dłuższych timeoutów. Regresja porównuje scrollWidth do page.viewportSize().width (window.innerWidth mogło już się rozszerzyć), obejmuje panel/messages/support oraz normalne kliknięcia desktop/mobile.

Desktop filter ma poprawny AX combobox name Specjalizacja, ale implicitlabel zawiera także opcje i getByLabelexact nie odzwierciedla dostępnej nazwy. Zmienić wyłącznie fixture na semantic getByRole(combobox,name), zachowując wybór canonical value i asercję wyniku. Po korektach ponowić dotknięte kontrole, produkcyjny build, E2E i review, zapisać nowy manifest. Zachować uprzednie dowody domain/auth i udokumentować zakres ich aktualności.

## Domknięcie asercji E2E i instrukcji uruchomienia

R5E2E6/6PASS i OCI4434515e…PASS, jednak celowany rerun z trace odtworzył dwa safeSERVICE_UNAVAILABLE przy dwóch przerwanych POSTmessages (brak odebranej5xx). Przyczyna testu: getByText(message) dopasowywało także wypełniony textarea, więc test przechodził do następnej strony przed odpowiedzią i sprawdzeniem trwałego zapisu. Poprawić tylko E2E: oczekiwać faktycznego POST201, tekstu w artykule historii oraz jego obecności po reload. Zachować normalne kliknięcie i wszystkie dalsze asercje; nie ignorować błędów ani nie zmieniać kodu API dla zamaskowania błędnego testu. Ponowić oba projekty z trace i sprawdzić statusy oraz logi.

AC-S7: poprawić pierwszy blok README tak, by instalacja agent-browser i produkcyjny build poprzedzały test:integration (drugi blok już ma poprawną kolejność). To zmiana dokumentacji i testów, bez zmiany implementacji/runtime. Po jednorazowym zamrożeniu nowych plików zaktualizować manifest i uzasadnienie ważności poprzednich unit/integration/build/OCI; powtórzyć format/lint/typy, pełne E2E oraz finalny skan i review.

## Wynik lokalnego wdrożenia — 2026-11-03

Końcowy stan: `301e2d228e694de0439998103559202a7b359100be66ac8743536ec1cca24786`,213plików; gałąźmain, HEAD3fed950619e17b6fa831cfd10a6abe6877935fe7, pełnydiff i manifest w `.ai/runs/evidence/2026-11-03-engineering-final.*`. Nie tworzono commita ani wdrożenia publicznego. Zachowano zastane zmiany innych zadań.

| Zakres | Wynik i dowód |
| --- | --- |
| AC-S1–S3 | npmci dla niezmienionego lockfile, zgodne peers, format/lint/typy/graf PASS.396unit,100% lines/branches/functions/statements per niepusty plik;78plików raportu. Lines2357,statements2473,functions555,branches1985. Nie zmieniano progów ani zakresu coverage. |
| AC-S4 |54integracje PostgreSQL18.6/Testcontainers PASS: migracje/upgrade/rerun, read-onlyCWD, SQLconstraints/transakcje, auth/MFA/role, worker/inbox/outbox i lokalny dump/restore. |
| AC-S5/AC-P7 |6E2E desktop/mobile PASS, klawiatura, rzeczywista baza i worker. Naprawiono intrinsic overflow mobilnego panelu; szerokość sprawdzana względem skonfigurowanego viewportu. |
| AC-S6 | Workflow i ci-required sprawdzone lokalnie/review. Rzeczywisty zielony GitHubCI, wymagane review i ochrona gałęzi pozostają niepotwierdzone; sam plikYAML ich nie ustanawia. |
| AC-S7/AC-P8 | Build bez.env/sekretów PASS, dokumentacja i OpenAPI aktualne, logi/telemetry/metryki dostępne. Obraz `devmentor:engineering-final`4434515e581de589c1617253822824c294b4ebde8c9ffc33e54144c32e5a5f94: migrate/rerun/seed/web/register/mailbox/verify/login/worker jakoUID1000 PASS na nowej bazie. |
| AC-P1–P3/P5/P6 | Lokalny auth, katalog/oferty/dostępność, terminy/pieniądze/polityki, cele/pakiety/kredyty, moderacja i komunikacja zweryfikowane unit/integracją/E2E. R2findingi oraz pokój uczestnika rozwiązane; orders pozostaje owner-only, mentor nie otrzymuje bearerCheckout, notatki są prywatne. |
| AC-P4 | Lokalna bramka demo, rzeczywisty trwały inbox/outbox/worker oraz syntetyczne podpisane zdarzenia Stripe PASS. Nie wykonano rzeczywistych obciążeń ani sandboxa dostawcy. |
| Bezpieczeństwo | Audit runtime czysty; tylko istniejące, ścisłe wyjątki dev do2026-11-17. Gitleaks8.30.1 pełnego snapshotu plików PASS; wąska konfiguracja manifestów SHA ma niezależne pozytywne i negatywne próby. |

Ostatni E2E z trace wymaga POSTmessages201, wiadomości w artykule historii i jej obecności po reload. Oba viewporty potwierdziły201 oraz kolejne GET200; nie wystąpiły SERVICE_UNAVAILABLE ani odebrane5xx. Poprzednia asercja dopasowywała draft textarea i przerywała wysyłkę przez nawigację; została poprawiona bez zmiany implementacji API.

Aktualność wyników: R5zmienił wyłącznieCSS i dwa E2E; końcowe domknięcie wyłącznieREADME i jeden E2E. Niezależnie potwierdzono hashe wszystkich213plików przed/po kontrolach oraz brak zmian źródeł, testów jednostkowych/integracyjnych i konfiguracji wpływających na przeniesione wyniki396unit/54integracji/build/audytu. Obraz OCI zawiera identyczny końcowy kod produktu; ostatnia deltaREADME/E2E nie wchodzi do runtime.

Raporty: [niezależna weryfikacja](../runs/evidence/2026-11-03-engineering-final-verification.md), [niezależne review](../runs/evidence/2026-11-03-engineering-final-review.md), [OCI](../runs/evidence/2026-11-03-engineering-oci.json), [skan sekretów](../runs/evidence/2026-11-03-engineering-security.json).

Otwarte warunki pełnej specyfikacji: rzeczywiste Stripe/Connect/KYC/SMTP/OAuth i wideousługa, zatwierdzone zasady produkcyjne/retencja, hosting/staging, rzeczywisty rollback i PITR/backup/RPO/RTO/SLO/alerty oraz ochrona GitHub i uruchomione wymagane zdalneCI. Brak kont/dostępu i decyzja o lokalnym demo są zachowane; nie przedstawiamy lokalnych dowodów jako wykonania tych warunków. Dlatego specyfikacja i dziennik pozostają in-progress i dokument nie trafia do implemented.

## Wznowienie według importowanej specyfikacji — 2026-11-03

Nowe polecenie użytkownika wskazuje [engineering-standards.md](engineering-standards.md), import pierwotnej propozycji. To źródło należy porównać z niniejszym uzgodnionym planem i istniejącą implementacją, bez cofania późniejszych decyzji użytkownika: npm i pojedynczy package-lock, 100%perfile wszystkich czterech metryk oraz lokalne demo bez kont dostawców. Pierwotny import pozostaje zachowany.

Plan kontynuacji:
1. Odrębny implementator analizuje konkretne luki kodu względem obu dokumentów; projektant kontroli mapuje wymagania na istniejące testy i ograniczenia.
2. Uzupełnić wyłącznie potwierdzone braki w zatwierdzonym zakresie; każdą zmianę zachowania sprawdzić regresją i wymaganym coverage, bez pozornej implementacji już działających funkcji.
3. Zamrozić źródła i zapisać aktualny manifest obejmujący zastane zmiany. Niezależny weryfikator potwierdzi instalację dla nowego lockfile Next16.4.5, jakość, build, integrację, E2E i bezpieczeństwo; reviewer oceni cały zakres i ewentualne poprawki.
4. Uaktualnić mapę wymagań i wyniki w jednym dotychczasowym dzienniku. Rozdzielić lokalnie zweryfikowany kod od rzeczywistych warunków zewnętrznych/produkcyjnych. Nie wykonywać commita, push ani wdrożenia publicznego bez polecenia.

Kryteria pozostają AC-S1–S7 i AC-P1–P8. Import nie upoważnia do obniżenia progów testów ani domniemania wykonanych prób dostawców/hostingu. Jeśli analiza ujawni inne istotne różnice wymagań, należy je jawnie rozstrzygnąć przed zależną zmianą.

## Potwierdzona luka kontynuacji R7 — okresowe odświeżanie wiadomości

Źródło: oba dokumenty wymagają trwałych wiadomości, stronicowania i okresowego odświeżania w MVP. MessagesPanel obecnie odświeża dane wyłącznie po działaniu użytkownika; wiadomość od innego uczestnika nie pojawia się samoczynnie. Analiza odrębnego implementatora potwierdza brak timera/pollingu w panelu i hookach zasobów.

Plan ograniczonej poprawki (AC-P6/P7):
- Odświeżać najnowszą stronę aktywnej rozmowy co10s bez pełnego przeładowania strony i bez utraty draftu.
- Wstrzymać polling w ukrytej karcie i podczas przeglądania starszej historii; powrót do aktualnej rozmowy/najnowszej strony pozwala wznowić odświeżanie.
- Posprzątać timer i chronić wynik przed zastosowaniem po zmianie rozmowy/użytkownika lub unmount; nie nakładać kolejnych odświeżeń w tle. Błąd sieci nie usuwa poprawnie pobranej historii i pozwala ponowić odczyt.
- Regresje jednostkowe z kontrolowanym czasem obejmują aktualizację, pauzę/wznowienie, cleanup, opóźniony wynik, błąd, draft i paginację; 100%czterech metryk bez wyjątków.
- Produkcyjny E2E potwierdza wiadomość wysłaną przez drugiego uczestnika pojawiającą się w otwartej rozmowie bez ręcznego reload/odświeżania, na desktop/mobile. Zachować wcześniejsze asercje POST201/historia/reload.

Zakres wykonawcy: panel wiadomości, niezbędne hooki transportu, ich testy i produktowy E2E; manifesty, auth/domena/baza, workflow i dotychczasowe kontrakty bez zmian. Po wdrożeniu zamrozić źródła, ponowić dotknięte kontrole i niezależne review.

## Wynik kontynuacji R7 — 2026-11-03

Import engineering-standards.md porównano z planem: pozostałe wymagania są wspólne; różnice pnpm/npm i core-only/all-implementation coverage mają już jawne decyzje użytkownika. Import otrzymał odnośnik do kanonicznego planu bez usuwania pierwotnej propozycji. Zaktualizowano nieaktualny lesson o wspólnej ochronie hold/session.

Potwierdzoną lukę MSG-POLL1 zamknięto: najnowsza strona aktywnej rozmowy odświeża się w tle co10s od końca odczytu; ukryta karta i starsza historia wstrzymują cykl. Jeden odczyt naraz, abort/ochrona przed spóźnionym wynikiem, cleanup oraz zachowanie draftu/historii/kursora po błędzie mają siedem dedykowanych regresji. Dotychczasowy początkowy odczyt innych zasobów nie jest przełączany na polling. E2E potwierdza realną odpowiedź drugiego uczestnika bez ręcznego reload/odświeżania i zachowany szkic.

Końcowy stan źródeł R7:143e25b360b0a2260df4fbd4dcd6fb5c7f04c60cfd0bf0bfbbeeca1d10ccc244,214plików; HEAD3fed950619e17b6fa831cfd10a6abe6877935fe7/main. Delta od zastanego stanu to4pliki kodu/testów iREADME; manifest i pełny diff zapisano jako engineering-resume-final w evidence. Źródła były zamrożone przez wszystkie kontrole; późniejsze wpisy wynikowe workflow nie zmieniają wymagań ani kodu.

| Weryfikacja niezależna | Wynik |
| --- | --- |
| Instalacja i lock | npmci937pakietów oraz npmlsALLPASS; SHA lockfile09c538374e6205d6552804924597cc3ecbe5f1cbccfafb0e05baef18df85bafe niezmienione przed/po. |
| Jakość i build | Format/lint/typy/granice403unit/42pliki/100%czterech metryk oraz produkcyjny Next16.4.5PASS. |
| Integracja i E2E |54integracje PostgreSQL18.6PASS;6produktowychE2E desktop/mobilePASS, w tym nowa wiadomość bezreload. |
| Wizualna regresja |2dodatkowe celowane testy i screenshotyPASS; historia/reply/draft/focus czytelne, bezoverflow; traceGET200/POST201 i0odebranych5xx. |
| CI i bezpieczeństwo | Dokładny gateci-required18/18próbPASS,12/12ActionpełneSHA; audit runtimeclean i tylko dotychczasowe ważne wyjątki dev; Gitleaks8.30.1PASS. |
| OCI | Nowy obraz devmentor:engineering-resume, digestsha256:257bd1a324a56365b5c0685c6a7fdddb9a2951531bc5551418ab255f1ad6b01e: build/migrate/rerun/seed/UID1000/web/register/mailbox/verify/login/Host404/workerPASS. |

Dowody: [weryfikacja R7](../runs/evidence/2026-11-03-engineering-resume-verification.md), [review R7](../runs/evidence/2026-11-03-engineering-resume-review.md), [manifest](../runs/evidence/2026-11-03-engineering-resume-final.json), [OCI](../runs/evidence/2026-11-03-engineering-resume-oci.json), [skan sekretów](../runs/evidence/2026-11-03-engineering-resume-security.json).

Wdrożenie lokalnego zakresu i egzekwowanie standardów są potwierdzone. Pełna specyfikacja pozostaje in-progress: rzeczywiste Stripe/Connect/KYC/SMTP/OAuth, publiczny hosting/staging, zdalne wymaganeCI/ochronaGitHub, alerty dostawcy oraz produkcyjne PITR/RPO/RTO/SLO/rollback nadal wymagają rzeczywistego środowiska i dowodów. Testy klawiatury i viewportów nie stanowią pełnego audytu zgodnościWCAG. Nie wykonano commita, push ani publicznego wdrożenia.
