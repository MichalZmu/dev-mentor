# GitHub CI i pełne pokrycie testami

Cele:
- CI dla PR, testy jednostkowe całego kodu i tymczasowa aplikacja PostgreSQL/Testcontainers z agent-browser.

Specyfikacja: [GitHub CI i pełne testy](../specs/implemented/2026-11-03-github-ci-coverage.md)
Status: done

## Kontekst

Proces change-delivery 0.2.3, source_commit a46384578da42a90414e55b0d7165e27390d3a67. Zastane zmiany produktu zachowane; nie są dowodem wykonania tego zadania. Narzędzie delegowania nie udostępnia technicznej izolacji zapisu; role mają jawnie ograniczony zakres instrukcjami.
Implementatorzy: unit_core_db (core/db tests), unit_server (app/server tests), unit_ui (UI tests). Prowadzący: konfiguracja CI/Vitest, instancja testowa i dokumentacja. Weryfikator i reviewer będą osobnymi instancjami.

## Wpisy

### 2026-11-03 — przygotowanie, bez commita
Zakres: odczyt AGENTS/CLAUDE/lessons, istniejących specyfikacji i dziennika standardów, workflow i lokalnych docs Next.js.
Decyzje / pułapki: Windows sandbox blokuje WSL; odczyt/komendy przez jawnie eskalowany wsl. Node26.13.0/npm11.20.0 i Docker29.9.2 dostępne.
Do zrobienia: pełne testy, CI, cykl życia instancji, niezależna weryfikacja i review. Bazowo 25 testów PASS, coverage core FAIL (1.25% lines).

### 2026-11-03 — implementacja i kontrole przyrostów, bez commita
Zakres: CI z instalacją agent-browser, Vitest server/client i per-file100 wszystkich implementacji aplikacji/narzędzi/CLI/migracji, reguła AGENTS, tymczasowy PostgreSQL+Next, testy API/browser i dokumentacja.
Decyzje / pułapki: 98 testów core/db/migracje i106 UI osiągnęły100×4; serwer71 testów100×4 przed kolejnymi zewnętrznymi zmianami. Narzędzia root43 testy100×4; helper instancji6 testów PASS. Wykryto i naprawiono użyte body Request, walidację from i rejestrację wywołującą efekt przed blokadą; kontrola nieimportowanego pliku potwierdziła błąd progu.
Do zrobienia: niezależna pełna weryfikacja i review na stabilnym stanie. Równoległy zewnętrzny zapis kodu kilkakrotnie unieważnił wyniki; adaptacje testów nie usuwają nowych kontroli autoryzacji.

### 2026-11-03 — instancja i ograniczenia środowiska, bez commita
Zakres: własny test integracyjny API i agent-browser PASS na prawdziwym PostgreSQL18.6 i buildzie Next16.4.4; build PASS, lint/typy/graf dotychczas PASS poza naprawionymi fixture/types.
Decyzje / pułapki: pobranie Chrome nie działało (DNS); lokalny Chrome z Playwright uruchomiono z bibliotekami skopiowanymi z istniejącego oficjalnego obrazu do /tmp, bez zmian aplikacji. Auto-review odrzucił proxy CDP na0.0.0.0; zrezygnowano z proxy, bez wymogu dodatkowej zgody. Przywrócenie dumpa wymaga usunięcia początkowego public wyłącznie w nowym kontenerze restore.
Do zrobienia: pełne integracje i E2E po finalnym buildzie. Niezależny verifier/reviewer to osobne instancje verify_ci_tests i review_ci_tests, źródła identyfikowane manifestem SHA w evidence.

### 2026-11-03 — koordynacja i niezależne kontrole, bez commita
Zakres: niezależne331 unit testów PASS,100×4 dla75plików (2240lines/2347statements/532functions/1853branches); npmci, typy, graf i ponowiony audyt PASS. Verifier osobno potwierdził negatywną kontrolę nieimportowanego kodu bez mutacji repo.
Decyzje / pułapki: użytkownik potwierdził wstrzymanie równoległych zmian; bezpośrednią zgodę na komunikację zweryfikowano w wiadomościach człowieka drugiego chatu. Uzgodniono ownership: ten chat CI/unit/config, drugi chat produktowe źródła i integracje/E2E. Dalsze D1/D2/V1 produktu wymagają finalnego freeze i ponowienia zależnych kontroli; npmci zakończone, bez kolejnych instalacji.
Do zrobienia: adaptować unit do ostatecznych poprawnych kontraktów workera i zakończyć build/integracje/E2E/review na stabilnym fingerprint. Zastane błędy lint unused imports i przeniesiony typ PaymentGateway przekazano właścicielowi; import testu poprawiono.

### 2026-11-03 — korekta restore i uzgodniony freeze, bez commita
Zakres: właściciel integracji potwierdził6/6 auth/restore PASS i wycofał moje założenie o konieczności drop public; zachowano jego poprawny test odtworzenia PostgreSQL18. Wcześniejsze stwierdzenie o wymaganym drop public nie było potwierdzoną przyczyną błędu i jest nieaktualne.
Decyzje / pułapki: domain/UI zamrożone; unit implementatorzy aktualizują wyłącznie własne testy do exact paymentOrder/cursor i konfigurowalnego GoogleOAuth. Backend domyka workerCSP/env; runtimechecks i .next/3100 wstrzymane do wspólnego finalfreeze. Żaden próg coverage ani test produktu nie został osłabiony.
Do zrobienia: handoff backend, finalne unit100, niezależne szerokie kontrole i delta-review.

### 2026-11-03 — weryfikacja R1 i otwarcie R2, bez commita
Zakres: niezależne370/370 testów jednostkowych PASS;76 plików,100% lines2273/statements2382/functions535/branches1900. Manifest892a3153568f81bd919b771c020da50a877f168b8b3ca839a5d8ea648d25949c bez zmian podczas pomiaru; finalne review CI/unit bez blokujących uwag. Zewnętrzny verifier R1 potwierdził lint/typy/graf/npm ls/build bez env.
Decyzje / pułapki: format R1 wykrył root snapshoty emitowane przez MikroORM podczas migracji. Właściciel domeny otworzył R2: snapshot:false z testem readonly cwd; dodatkowe realne reprodukcje R-PAY1 (PSP→credit po checkout.start) i R-AVL1 (powrót usuniętej dostępności po expiry) wymagają poprawek i ewentualnej migracji004. To zmiany produktu, nie osłabienie CI.
Do zrobienia: utrzymać HOLD naszych zapisów do FINAL R2, następnie zaktualizować unit i wykonać zależne kontrole. Wyniki370/100 pozostają dowodem R1, nie przyszłego R2.

### 2026-11-03 — dalsze potwierdzone regresje R2, bez commita
Zakres: zespół produktu potwierdził R-CAT1 (kursor104 znaków odrzucany przez limit100), R-CAT2 (różna wielkość liter specjalizacji) i R-OWN1 (checkout bearer mentee w odpowiedziach mentora). Właściciele źródeł naprawiają API/UI i dodają rzeczywiste regresje HTTP/PostgreSQL.
Decyzje / pułapki: CI/unit/config tego zadania pozostają w HOLD do FINAL R2. Planowane unit delta100: opaque cursor2048 przy niezmienionym ID100, porównanie specjalizacji, filtr własnych billing orders i redakcja checkoutId/checkoutUrl na granicy odpowiedzi. Q1 readonly cwd programmatic+CLI już PASS; nowe payment_mode/provenance powstają w migracji004 bez edycji001–003.
Do zrobienia: odebrać stabilne kontrakty R2 i wznowić wyłącznie unit tests; następnie niezależnie sprawdzić aktualny kod i runtime. Brak nowych instalacji lub zmian poza dziennikiem.

### 2026-11-03 — końcowa weryfikacja i zamknięcie, bez commita
Zakres: wznowiono ten sam dziennik po finalnych zmianach produktu; niezależnie potwierdzono 396/396 unit i 100% czterech metryk w 78 plikach, 54/54 integracje z PostgreSQL/agent-browser oraz 6/6 E2E; format/lint/typy/graf/npm ls/build/audyt PASS. Dowody: evidence/2026-11-03-github-ci-final-verification.md oraz evidence/2026-11-03-github-ci-final-review.md.
Decyzje / pułapki: 213 źródeł nie zmieniło się podczas kontroli; test nieimportowanej funkcji i 18 scenariuszy ci-required potwierdziły blokady. Implementator nie znalazł potrzebnych zmian; reviewer bez blokujących uwag. Użyto rzeczywistego istniejącego Chrome, wcześniejszego npm ci z identycznym lock oraz świeżego npm ls; hosted CI i ochrona gałęzi nie były zmieniane.
Do zrobienia: brak w zakresie konfiguracji i lokalnej weryfikacji; specyfikację przeniesiono do implemented, nagłówek i aktywny link zaktualizowano. Commit/push oraz ustawienie wymaganego ci-required i review w GitHub pozostają poza wykonanymi operacjami.
