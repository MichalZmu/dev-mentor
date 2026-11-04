# Analiza luk wznowionego wdrożenia standardów

Data: 2026-11-03
Rola: delivery_implementer, pierwszy krok wyłącznie odczytowy
Proces: whirly-agentic-sdlc 0.2.3, source_commit a46384578da42a90414e55b0d7165e27390d3a67

## Wejścia i granice

Przeczytano AGENTS.md, CLAUDE.md, lessons i pełny dziennik 2026-11-03-engineering-standards.md, wskazaną engineering-standards.md oraz zatwierdzoną wersję datowaną. Odczytano konfiguracje TS/ESLint/Vitest/CI, publiczne eksporty core, composition root, konfigurację/auth, worker/płatności, repozytorium oraz UI wiadomości i wspólne hooki danych, ADR i runbook.

Wcześniejsze decyzje użytkownika zachowują npm/package-lock, pełne 100% coverage i lokalny tryb demonstracyjny bez kont dostawców. Obecny odczyt nie upoważnia do cofnięcia tych decyzji z powodu starszych propozycji pnpm/coverage tylko core w ponownie dostarczonym dokumencie. Nie zmieniono źródeł, testów, specyfikacji ani dziennika. Nie wykonano instalacji/build ani masowych testów; wyniki rodzica i wcześniejszych ról nie są przedstawiane jako moje kontrole.

## Potwierdzona luka lokalna MSG-POLL1

Wymaganie: okresowe odświeżanie wiadomości w MVP, engineering-standards.md:16 oraz 2026-11-03-engineering-standards.md:64.

Kod: packages/app/components/messages-panel.tsx:31-37 pobiera historię przez useResource; komponent odświeża ją po własnym wysłaniu (55) albo ręcznym przyciskiem (106). packages/app/components/api-client.ts:77-110 uruchamia fetch tylko po zmianie path/scope/version, a reload zwiększa version. W obu komponentach i ich hookach nie ma timera ani innego mechanizmu okresowego. Nowa wiadomość drugiego uczestnika nie aktualizuje otwartej rozmowy bez działania użytkownika.

Przyczyna jest potwierdzona przez odczyt pełnych implementacji; nie uruchomiono jeszcze reprodukcji przeglądarkowej. Minimalny proponowany przyrost: okresowo odczytywać aktywną najnowszą stronę rozmowy, np. co10s, zatrzymywać polling na ukrytej karcie i starszej historii, usuwać timer po zmianie rozmowy/użytkownika i unmount. Zachować draft, aktualną paginację, obsługę błędów i brak nakładających się żądań. Interwał jest proponowanym wyborem implementacji, nie nowym wymaganiem produktu.

Weryfikacja przyrostu: unit z fake timers dowodzi nadejścia wiadomości bez kliknięcia, bezczynności przed interwałem, pauzy na starszej historii/ukrytej karcie, cleanup/switch/owner/unmount i zachowania błędów; 100% czterech metryk. E2E na realnej aplikacji: drugi uczestnik wysyła wiadomość, pierwszy widzi ją automatycznie bez ręcznego reload. Root ustala okna build/coverage/E2E.

## Stan pozostałych obszarów

- TS strict i dodatkowe opcje, typowane reguły Promise/importów, publiczne boundary types i restrykcje importów są obecne.
- Vitest obejmuje implementacje app/core/db/ui, migracje, CLI i narzędzia, ma oddzielne projekty server/client oraz per-file100% czterech metryk, bez nowych wyjątków.
- CI ma przypięte SHA, minimalne uprawnienia, npmci, wymagane kontrole i aggregate fail-on-skipped/failure/cancelled; aktywne ustawienia branch protection są osobnym dowodem zdalnym.
- Auth wykorzystuje odrębną pulę/schema, server sessions/cookies, MFA i walidację środowiska; API waliduje transport i origin, a domena/repozytoria polityki zasobów.
- Shared ORM/provider, request EntityManager i serwerowe scope DI są obecne. Migracje domeny są jawne i wersjonowane.
- Worker ma trwałe jobs/lease/backoff/retry/deadletter, jawny lookup Checkout i stronicowanie payment reconciliation. pendingRefunds zwraca wszystkie zwroty bez LIMIT; nie potwierdzono hipotezy pomijania zwrotów po100 rekordach.
- Obserwowalność ma JSON/log redaction, HTTP spans i admin metrics; runbook jawnie oddziela lokalne potwierdzenie od rzeczywistego alarmowania/hostingu/odzyskiwania.

Zauważono agregację funkcjonalności w platform-service/platform-repository zamiast folderów nazwanych identity/mentors/availability/bookings/payments/messaging/administration. To częściowa rozbieżność organizacji kodu z docelowym opisem modułów, bez potwierdzonej usterki zachowania. Nie rekomenduję pozornego dzielenia lub samych re-exportów w celu odhaczenia nazw bez uzgodnionego przyrostu i korzyści.

Otwarte warunki zewnętrzne już opisane w zatwierdzonej specyfikacji: realny sandbox Stripe/Connect/KYC, OAuth, SMTP/wideo, hosting/staging, PITR/backup/RPO/RTO/SLO/alerty oraz ochrona gałęzi i wykonany zdalny CI. Brak konfiguracji tych usług nie może być przedstawiany jako PASS.

## Przekazanie

Wdrożyć wąski przyrost MSG-POLL1 po uzupełnieniu planu przez prowadzącego, następnie niezależna weryfikacja i review. Bez zmian źródeł do przydziału root. Raport jest analizą implementatora, nie niezależnym review ani rekomendacją integracji.
