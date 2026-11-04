# Koncepcja portalu mentoringowego i prototyp

Data utworzenia: 2026-11-03
Status: done

## Cel i zakres
Przygotować pobieralny ZIP z koncepcją DevMentor, benchmarkiem funkcjonalnym Preply i samodzielnym klikalnym prototypem HTML/CSS/TypeScript. To artefakt projektowy w docs/mentoring-concept, nie implementacja produkcyjnej aplikacji Next.js. Nie zmieniamy zastanych plików ani zależności monorepo.

## Plan
1. Zweryfikować oficjalne materiały Preply i opisać własne decyzje produktowe.
2. Określić aktorów, use case'y, przepływy, mapę i kontrakty API.
3. Stworzyć niezależny prototyp z danymi przykładowymi, pełnymi ścieżkami i przełącznikiem stanów.
4. Skompilować TypeScript, sprawdzić działanie w przeglądarce, responsywność i najważniejsze ścieżki.
5. Sprawdzić spójność ekranów z dokumentacją, spakować i zweryfikować ZIP.

## Kryteria akceptacji
- Lista aktorów obejmuje gościa, mentee, mentora i obsługę/administrację; potrzeby i uprawnienia są jawne.
- Każda kluczowa ścieżka ma początek, decyzje, błędy i mierzalny koniec.
- Każdy z 25 ekranów ma cel, funkcje, UI, loading/empty/error/success, walidacje i API.
- Prototyp otwiera się z index.html bez instalacji i bez internetu, zawiera skompilowany JS i źródłowy TS.
- Działają: wyszukiwanie, rezerwacja, symulacja płatności, przełożenie/anulowanie, pokój i opinia, plan, wiadomości, rozliczenia, zgłoszenie mentora, dostępność, moderacja.
- Jawne rozróżnienie symulacji od docelowego kontraktu. Żadne prawdziwe płatności, logowanie ani wysyłka.
- Dostępne README, scenariusze QA, źródła benchmarku i ZIP bez sekretów/dependencies.

## Weryfikacja i ryzyka
Ścisły typecheck TS, kontrola zgodności katalogu ekranów, test przeglądarkowy kluczowych ścieżek, mobile i nawigacja klawiaturą, integralność archiwum. Kontrole całego monorepo dotyczące artefaktów w miarę adekwatności. Ryzyka: strefy czasowe, konflikt slotu, idempotencja płatności, granice ról; dokumentacja opisuje zachowanie docelowe. Makieta korzysta ze stałej daty demo i danych lokalnych.

## Wynik weryfikacji
Spełniono kryteria: koncepcja, role, 8 przepływów, 25 ekranów ze stanami i API, kod HTML/CSS/TS oraz ZIP. TypeScript strict, lint, root typecheck, 8/8 testów i build przeszły. Przeglądarka: 25 ekranów, 100 stanów, mobile 390 px bez przepełnienia; przetestowane główne interakcje. ZIP porównano bajtowo z plikami źródłowymi przez SHA-256. Ograniczenia: file:// zablokowane w automatyzowanej przeglądarce, kontrola UI przez HTTP; integracje produkcyjne poza zakresem. Szczegóły w docs/04-weryfikacja.md.

## Uzupełnienie zakresu — README (2026-11-03)
Na prośbę użytkownika uzupełnić główny README o cel produktu, użytkowników, planowane funkcje i linki do koncepcji, prototypu oraz ZIP. Zachować instrukcje techniczne i rozróżnić aktualną aplikację od makiety i propozycji API/reguł. Weryfikacja: przegląd diff, lokalnych odnośników i zgodności poleceń z repozytorium; bez zmian kodu i zależności.

Wynik uzupełnienia README: dodano kontekst produktu, role, MVP, status oraz odnośniki i polecenia prototypu. Sprawdzono 10 lokalnych linków, zgodność skryptów npm, bloki kodu, brak zmian istniejących instrukcji technicznych, kontrolę paczki i diff. Zmiana wyłącznie dokumentacyjna; testów i builda aplikacji nie powtarzano.
