# Uruchomienie i utrzymanie DevMentor

## Lokalny tryb demonstracyjny

Polecenia z root, Node 26.13.0 / npm 11.20.0 i Docker z Compose:

```bash
npm run setup
```

Polecenie działa bez wcześniejszego npm ci. Sprawdza zależności i instaluje je
w razie potrzeby, tworzy brakujący .env, czeka na PostgreSQL, sprawdza połączenie,
stosuje brakujące migracje i wykonuje seed. Zachowuje istniejący .env i
pierwszeństwo zmiennych procesu; nie przestawia konfiguracji na demo.
Wymaga APP_MODE=demo i lokalnych URL PostgreSQL/aplikacji.
Kontrola zależności obejmuje także załadowanie modułów potrzebnych do migracji
i seeda. Brakujący moduł powoduje ponowną instalację przed uruchomieniem
PostgreSQL; nieudana naprawa kończy setup bez dalszych zmian w bazie.

Ponowienie zachowuje dane i wolumen, nie resetuje haseł ani ról/celów.
Znacznik seeda jest w bazie i powstaje atomowo z danymi domeny.
Po błędzie popraw wskazaną konfigurację/infrastrukturę i ponów npm run setup;
nowa baza wymaga własnego seeda. Migracje są sprawdzane zawsze.
Instalator kończy się instrukcją uruchomienia web oraz workera w osobnych terminalach:

```bash
npm run dev --workspace=@devmentor/app -- --hostname 127.0.0.1
npm run worker
```

Alternatywna pełna ścieżka ręczna (kopiuj .env wyłącznie, jeśli nie istnieje):

```bash
npm ci
cp .env.example .env
npm run db:up
npm run db:check
npm run migrate
npm run seed:demo
npm run dev --workspace=@devmentor/app -- --hostname 127.0.0.1
# osobny terminal, ten sam root .env:
npm run worker
```

Otwórz http://localhost:3000. Konta syntetyczne `demo@example.test`, `mentor@example.test`, `admin@example.test` mają hasło `DemoOnly_2026!`. Seed jest jawny, wymaga `APP_MODE=demo` i nie resetuje hasła istniejącego konta. Tworzy historyczną sesję do testowania pakietów/opinii oraz przyszłe terminy mentora `demo-mentor`. Te dane nie poświadczają rzeczywistej usługi ani płatności.

Rejestracja wymaga weryfikacji e-mail. W demo ekran auth oferuje lokalną skrzynkę: losowe cookie HttpOnly wiąże nowe adresy z przeglądarką. GET `/api/v1/demo/mailbox` nie przyjmuje e-mail i pokazuje wyłącznie wiadomości tego właściciela; jest dostępny tylko w demo na loopback. Reset hasła unieważnia istniejące sesje. Mailbox i jawna bramka demo nie są dostępne w trybie production. Konto admin w demo ma jawnie uproszczony dostęp MFA wyłącznie do lokalnych danych; produkcja wymaga sesyjnego dowodu zweryfikowanego drugiego czynnika.

W demo płatność zapisuje syntetyczne zdarzenie w takim samym trwałym inbox jak webhook. Dopiero worker potwierdza rezerwację. Sam powrót przeglądarki ani HTTP202 nie oznaczają zapłaty. Worker wygaśnięcia zwalnia hold po15min; Stripe Checkout ma oddzielny zegar (nie ustawiamy expires_at15min). Brak Stripe/SMTP/OAuth/KYC jest jawnie komunikowany; nie ma prawdziwych obciążeń ani wypłat.

## Auth, role i pule

`npm run migrate` używa `AUTH_MIGRATION_DATABASE_URL` / `MIGRATION_DATABASE_URL`, tworzy osobny schemat `auth` dla BetterAuth i jawne migracje domenowe. Runtime auth i migracje używają identycznego `search_path=auth`; domena pozostaje w public. Migracje nie startują automatycznie z web ani workerem. Oddzielny operator uruchamia je dokładnie raz dla wydania przed przełączeniem ruchu.

Produkcja wymaga `APP_MODE=production`, HTTPS `APP_URL`, losowego `AUTH_SECRET` (min32znaki), działającej poczty SMTP i sekretów Stripe z magazynu środowiska. Nie przechowuj ich w plikach obrazu, logach, PR ani test artifacts. Runtime cookies to HttpOnly/Secure/SameSite=Lax, wyłączony cookie cache, unieważnianie sesji po resetowaniu hasła. MFA enrollment i verification obsługuje `/api/auth/two-factor/*`; zapis dowodu jest związany z identyfikatorem prawdziwej sesji.

Osobne role SQL: migrator jest właścicielem schematu i maDDL; `web_domain` i `worker_domain` mająUSAGE public oraz potrzebne SELECT/INSERT/UPDATE/DELETE; `web_auth` maUSAGE auth i DML BetterAuth, bezCREATE. Żaden runtime nie jest superuserem ani właścicielem schematu. Przykładowe GRANTy należy zawęzić do tabel operacji; audit pozostaje append-only przez trigger. Nie przyznawaj CREATE ON SCHEMA public roliPUBLIC. Dla nowych tabel migrator ustawia ALTER DEFAULT PRIVILEGES, potem sprawdza odmowęDDL kontemruntime.

Budżet połączeń to liczba procesów razy (`DB_POOL_MAX` + `DB_AUTH_POOL_MAX`), plus migrator i bufor administracji. Domyślne lokalne10+5 na proces nie są rekomendacją produkcyjnego rozmiaru. Reverse proxy musi usuwać podszyte nagłówki adresu klienta i ustawiać je samodzielnie. Mutacje JSON wymagają dokładnego Origin, autorytatywnych sesji i polityk zasobu; role/MFA nie są czytane z payloadu klienta.

## Jeden obraz: web i worker

```bash
docker build -t devmentor:local .
# przekazuj sekrety przez bezpieczne mechanizmy hostingu, nie przez Dockerfile
# web: domyślny CMD npm run start
# worker: ten sam obraz z command npm run worker
# migrator: ten sam obraz z command npm run migrate i rolą migracyjną
```

Obraz ma przypięty Node26.13.0, npm11.20.0 i działa jako użytkownik node1000. `tsx` jest zależnością runtime aplikacji, więc worker po prune nie polega na devDependencies. Web i worker uruchamiaj osobno, z tym samym tagiem/digestem wydania i osobnymi limitami zasobów. Port web3000; worker nie wystawia HTTP. Liveness `/api/v1/health`; dane kolejki `/api/v1/admin/metrics` wymagają admin/MFA.

## Płatności, retry i interwencja

Webhook `/api/v1/webhooks/payments` weryfikuje podpis Stripe na surowym body. Zdarzenia są przyjmowane do inbox przed odpowiedzią; duplikaty są deduplikowane. Kwota/waluta/powiązanie zamówienia są weryfikowane w domenie. Zewnętrzne Checkout/refund/transfer i e-maile są wywoływane poza transakcją; idempotencykey jest związany z operacją/zamówieniem.

Worker przejmuje zadania przez lease, po awarii można je przejąć ponownie. Znany błąd operatora jest retry z backoff i limitem, nie pustym sukcesem. Nieznany kind jest błędem. Po limicie operator sprawdza przyczynę i używa jawnego admin retry; nie edytuje ręcznie statusu płatności. Idempotencykey pozostaje ten sam. Dla SMTP nie obiecujemy exactly-once doręczenia: po awarii granicznej wiadomość może zostać wysłana ponownie; nie zawiera danych finansowych ani prywatnych treści.

Connect jest odrębnym onboardingiem operatora; brak klucza/operatora zwraca niedostępność. Payout wymaga zweryfikowanego KYC i dostępnego rozliczonego salda, środki są rezerwowane przed outbox. Nie oznaczaj wypłaty wykonanej na podstawie samego żądania użytkownika. W produkcji najpierw zatwierdź model sprzedawcy, prowizji, krajów, zwrotów i sporów.

## Monitoring i reakcje

Logi JSON zawierają UTC,requestId,operację,kod; nie serializują SQL/driver errors,URLbazy,tokenów,wiadomości ani kart. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` włącza opcjonalny exporter; bez tej zmiennej nie ma eksportu sieciowego. Dashboard/alerty: najstarszy job, deadjobs, expired leases, paymentpending/refundpending, konflikty slotów, 5xx, wykorzystaniepul. Właściciel operacyjny musi skonfigurować progi i powiadomienia na wybranym hostingu. Sam endpoint metryk nie potwierdza działającego alarmowania.

## Backup, restore i rollback

PostgreSQL18.6 jest używany także w testach. Dla produkcji wybierz zarządzane backupy z PITR i retencję odpowiednią do danych. Codzienny dump nie spełnia sam RPO15min. Oddzielny storage backupów i szyfrowanie/klucze są odpowiedzialnością hostingu.

Lokalny drill może działać wyłącznie na nowych Testcontainers: zasiej syntetyczne dane, pełny `pg_dump --no-owner --no-privileges` bazy (bez filtra `--schema`, z rozszerzeniami obu schematów), odtwórz do NOWEJ bazy, porównaj liczniki i klucze/constraints oraz sprawdź SELECT jako runtime i odmowęCREATE. Nie nadpisuj bazy użytkownika. Zachowaj tylko bezsekretowy raport liczb; dump z tokenami i hashami nie trafia do repo/artifacts.

Rollback aplikacji używa poprzedniego obrazu kompatybilnego z aktualnym schematem. Expand-contract: najpierw dodawanie, potem usuwanie w kolejnym wydaniu; wykonanych migracji nie edytujemy. Destrukcyjny krok wymaga osobnego planu odtworzenia. Przed publicznym MVP wykonać staging smoke, rollback oraz próbę przywrócenia/PITR na rzeczywistym dostawcy. Lokalne testy nie potwierdzają celu RPO15min/RTO4h ani dostępności99.5%.

## Compose obrazu lokalnego

```bash
docker compose -f compose.yaml -f compose.app.yaml --profile app build web
docker compose -f compose.yaml -f compose.app.yaml up --wait postgres
docker compose -f compose.yaml -f compose.app.yaml --profile ops run --rm migrate
docker compose -f compose.yaml -f compose.app.yaml --profile ops run --rm migrate npm run seed:demo
docker compose -f compose.yaml -f compose.app.yaml --profile app up -d web worker
```

To konfiguracja lokalna: port web jest związany z127.0.0.1, role developerskie są wspólne, migracja i seed pozostają jawnymi poleceniami. Nie stosuj tego pliku z przykładowymi danymi w produkcji. W hostingu zastąp URL osobnymi rolami runtime/migrator i sekrety dostawców, zachowując wspólny digest obrazu web/workera.

Kontrakt HTTP: [OpenAPI](../api/openapi.json). Decyzje: [modularny monolit](../adr/0001-modular-monolith.md), [lokalne demo i adaptery](../adr/0002-local-demo-and-provider-ports.md).

Próba lokalna jest utrwalona w `tests/integration/app-auth.integration.test.ts`: tworzy osobne bazy źródłową i odtworzoną, porównuje liczniki auth/użytkowników/rezerwacji/inbox/outbox i obecność exclusionconstraint, sprawdzaDML i odmowęDDL runtime oraz brak dostępu roli domeny do auth. Używa pełnego `pg_dump` z rozszerzeniami — filtr `--schema` pominął btree_gist i został odrzucony po reprodukcji błędu restore. Dump nie opuszcza nowych kontenerów testowych i nie trafia do artefaktów. Wynik tej próby nie potwierdza PITR, produkcyjnej retencji ani RPO/RTO.

W lokalnym demo listener musi być związany z127.0.0.1: `npm run dev --workspace=@devmentor/app -- --hostname 127.0.0.1` lub `npm run start --workspace=@devmentor/app -- --hostname 127.0.0.1`. Sam APP_URL nie zmienia adresu nasłuchu. Obraz OCI używa0.0.0.0 wewnątrz kontenera, lecz Compose publikuje wyłącznie127.0.0.1. Harness E2E ma krótkotrwały serwer na3100 i własne syntetyczne dane; wymaga cleanup procesów/kontenera i nie służy uruchamianiu demonstracji publicznej.

OAuth Google jest opcjonalny: ustaw oba OAUTH_GOOGLE_CLIENT_ID/OAUTH_GOOGLE_CLIENT_SECRET i callback `{APP_URL}/api/auth/callback/google`. Bez pary konfiguracja jest błędna; bez obu UI nie pokazuje przycisku. `/api/v1/config` ujawnia wyłącznie boolean dostępności, nigdy klucze. Brak kont dostawcy oznacza brak rzeczywistego testu OAuth.

CSP jest bazowy: object-src none, base-uri self, frame-ancestors none, form-action self oraz źródła aplikacji; Next inline hydration wymaga w tym wariancie script-src unsafe-inline. Nie jest to ścisły CSP z nonce. Development dodatkowo dopuszcza eval/WebSocket wymagane przez narzędzia. Produkcyjny hosting HTTPS może dodać nonce i HSTS po testach; nie włączamy upgrade-insecure-requests podczas buildu bez środowiska, aby nie psuć lokalnego demo HTTP.

## Stan instalacji demo

Migracja Migration202611040001 dodaje demo_seed_state; nie zmienia poprzednich
migracji. Seed blokuje swój wiersz i zapisuje ukończenie w transakcji danych
domeny. W razie błędu domena i znacznik są wycofywane, a wcześniej utworzone
konta auth są bezpiecznie wykorzystywane przy ponowieniu. Istniejące dane
sprzed instalatora są uzupełniane bez nadpisywania ról i celów.
Nie usuwaj znacznika w celu codziennego odświeżania terminów.

Przy wdrażaniu tej wersji uruchom npm run migrate przed seed:demo.
Rollback kodu nie wymaga usuwania tabeli stanu. Destrukcyjne wycofanie migracji
nie jest krokiem naprawczym instalatora; zachowaj bazę i zastosuj poprawkę do przodu.
