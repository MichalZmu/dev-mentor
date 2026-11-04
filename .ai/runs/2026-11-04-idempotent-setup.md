# Idempotent local demo installer

Cele:
- Implementować zgłoszenie #1 zgodnie z diagnozą om-root-cause.
- Zweryfikować bootstrap i ponowienia na izolowanej bazie, naprawić zatwierdzone blokady bramki i opublikować PR po pełnej walidacji.

Specyfikacja: [Idempotent setup](../specs/implemented/2026-11-04-idempotent-setup.md)
Status: in-progress

## Wpisy

### 2026-11-04 — implementacja w toku
Zakres: dependency-free bootstrap, transakcyjny seed z trwałym znacznikiem i nową migracją.
Decyzje / pułapki: istniejący seed nadpisywał role/cele; SQL musi używać kontekstu transakcji.
Do zrobienia: testy regresji, dokumentacja, integracja i pełna bramka; brak commita.

### 2026-11-04 — regresje i rzeczywista instalacja
Zakres: testy jednostkowe i pełny coverage przeszły; świeża instalacja na izolowanym Compose oraz ponowienia, restart, upgrade i rollback seeda przeszły.
Decyzje / pułapki: zachowano hasła/role/cele; fingerprint zależności nie zastępuje weryfikacji grafu i wejść CLI. Globalny format/lint zgłasza zastane błędy zainstalowanych skilli.
Do zrobienia: zakończyć pełną integrację/E2E/audyt i zapisać końcowe dowody; brak commita.

### 2026-11-04 — końcowa weryfikacja i blokada bramki
Zakres: 434 unit/coverage, 55 integracji, 6 E2E, build, typy, graf zależności i audyt PASS; dowody w evidence/2026-11-04-idempotent-setup-verification.md.
Decyzje / pułapki: poprawiono asercję 4→5 migracji i ponowiono całą integrację. Globalny format/lint FAIL w niezmienionych skillach; instalatory bibliotek przeglądarki przerwano na sudo, rzeczywiste testy użyły wcześniej przygotowanych bibliotek.
Do zrobienia: usunąć zastane blokady bramki w osobnym zakresie i ponowić pełną bramkę; implementacja gotowa do przeglądu, Status: blocked według om-fix. Nie wykonano commit/push/PR.

### 2026-11-04 — wznowienie po zgodzie na naprawę bramki
Zakres: użytkownik zlecił naprawienie format/lint zainstalowanych skilli i instalacji bibliotek przeglądarki; zaktualizowano plan.
Decyzje / pułapki: placeholder szablonu nie jest kodem aplikacji; wyłączenie obejmie wyłącznie .agents/skills. WSL root działa, sudo użytkownika wymaga interaktywnego uwierzytelnienia.
Do zrobienia: minimalne konfiguracje, systemowe biblioteki bez zmiany sudoers, pełna uporządkowana bramka i powrót do om-open-pr.

### 2026-11-04 — commit instalatora i naprawionej bramki
Zakres: instalator, idempotentny transakcyjny seed, nowa migracja, regresje i dokumentacja; minimalne wyłączenie dystrybucji skilli z Prettier/ESLint. Wszystkie11komend bramki PASS:434unit/coverage,55integracji,6E2E.
Decyzje / pułapki: systemowe biblioteki zainstalowano przez WSL root bez zmiany sudoers; rzeczywiste przeglądarki działają bez /tmp workaround. Specyfikację przeniesiono do implemented, zaktualizowano aktywny link i dowody.
Do zrobienia: push i publikacja PR zgodnie z om-open-pr; później review i QA przed integracją.

### 2026-11-04 — potwierdzenie publikacji i przekazanie do review
Zakres: commit9033e46 wypchnięto; PR#2 https://github.com/MichalZmu/dev-mentor/pull/2 otwarto do main i potwierdzono pełny zestaw etykiet oraz podsumowanie z dowodami.
Decyzje / pułapki: lokalna bramka11/11PASS; CI jest osobnym sygnałem. PR wymaga niezależnego review i qa-approved; naprawa środowiska nie zmienia sudoers.
Do zrobienia: brak w zakresie implementacji i publikacji; review/QA i integracja pozostają odrębnymi etapami. Ten commit zapisuje bieżące potwierdzenie publikacji, poprzedni miał własny wpis.

### 2026-11-04 — wznowienie po review PR#2
Zakres: użytkownik zlecił poprawienie obu ustaleń: naprawę brakujących modułów runtime mimo npm ls=0 oraz integracyjny dowód down/up migracji.
Decyzje / pułapki: dotychczasowy fingerprint i trzy pliki CLI nie dowodzą ładowalności zależności; zachowujemy konfigurację/bazę i nie uruchamiamy seeda ani migracji w probe.
Do zrobienia: regresja fail-before-fix, minimalny probe runtime w osobnym procesie, realny downgrade/upgrade na izolowanej bazie, pełna bramka i aktualizacja tego samego PR.

### 2026-11-04 — commit poprawek obu ustaleń review
Zakres: ograniczony probe modułów CLI przed pominięciem instalacji i po npm ci; regresje jednostkowe oraz realne naprawy dotenv/pg; integracyjny down/up migracji z zachowaniem danych, dokumentacja i lessons.
Decyzje / pułapki: trzy regresje zawiodły przed poprawką; historię migracji odczytujemy z SQL zgodnie z zainstalowanym API. Po przejściowym DNS ponowiono instalator i kolejne kroki w kolejności; pełna bramka11/11PASS:438unit/coverage,56integracji,6E2E.
Do zrobienia: wypchnąć poprawki do istniejącego PR#2 i zaktualizować opis/dowody; wymagane pozostają review i QA przed merge.
