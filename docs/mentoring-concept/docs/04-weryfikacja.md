# Weryfikacja i scenariusze odbioru

Data: 3 listopada 2026. Przeglądarka w aplikacji Codex, podgląd HTTP na 127.0.0.1:4173. Stan demonstracyjny był resetowany podczas testów. Testy dotyczyły fikcyjnych danych.

## Wykonane kontrole
| Kontrola | Wynik | Zakres |
|---|---|---|
| TypeScript prototypu | PASS | strict, DOM/ES2020, types=[], noEmitOnError |
| Spójność paczki | PASS | 25 unikalnych ID/tras, wszystkie pola, API, pliki i lokalne assety; node verify.mjs |
| Przegląd ekranów | PASS | 25/25 widoków renderuje treść bez wyjątku |
| Stany ekranów | PASS | 100/100: loading, empty, error, success dla każdego ekranu; to prezentacje stanów, nie prawdziwe żądania |
| Desktop | PASS | viewport 1440 × 1000; kontrola wizualna strony głównej i dokumentacji |
| Mobile | PASS | viewport 390 × 844; 25/25 bez przepełnienia dokumentu w poziomie; tabele/siatka mają własny scroll |
| Menu mobilne | PASS | otwieranie, linki panelu, aria-expanded |
| Klawiatura | PASS | Enter na skip link przenosi focus do main bez zmiany trasy; Escape zamyka dialog |
| Konsola | PASS | brak błędów JS podczas przeglądu 25 ekranów i stanów |
| Repo: npm run lint | PASS | kontrola całego repo, w tym źródeł prototypu |
| Repo: npm run typecheck | PASS | app/core/db/ui; osobny tsconfig dla prototypu |
| Repo: npm test | PASS | 8/8 zastanych testów, bez połączenia z prawdziwą bazą |
| Repo: npm run build | PASS | Next.js 16.4.4, strony / oraz /admin; makieta jest osobnym artefaktem docs |

Nie wykonywano npm ci: nie zmieniono zależności i użyto istniejącej instalacji zgodnej z .nvmrc. Build aplikacji nie jest buildem prototypu — prototyp ma osobną kompilację TypeScript.

## Scenariusze wykonane w UI
| ID | Scenariusz | Wynik obserwowany |
|---|---|---|
| QA01 / F01 | Katalog → filtr Frontend → profil Anny → logowanie demo → cel → termin → checkout | Jeden dopasowany mentor, zachowany kontekst, poprawne podsumowanie 180 PLN |
| QA02 / F01 | Odrzucona płatność → ponowienie z sukcesem | Błąd bez sesji; po sukcesie jedna rezerwacja w Moich sesjach |
| QA03 / F02 | Przełóż spotkanie na inny slot | Zmieniona godzina, ta sama sesja, brak nowej płatności |
| QA04 / F03 | Pokój → dołącz → notatka → zakończ → ocena 5 i komentarz → plan | Notatka zapisana, sesja completed, opinia przyjęta, przejście do planu |
| QA05 / F03 | Odhacz kolejny kamień milowy | Postęp zwiększa się o 25 punktów procentowych i jest zapisany |
| QA06 / F04 | Napisz wiadomość → zgłoś problem | Tekst widoczny w rozmowie, zgłoszenie z numerem w kolejce |
| QA07 / F04 | Administrator rozwiązuje zgłoszenie z uzasadnieniem | Status resolved i treść decyzji zapisane |
| QA08 / F05 | Kup pakiet → wstrzymaj odnowienie | 4 kredyty, transakcja 720 PLN, status wstrzymany, odnowienie wyłączone |
| QA09 / F05 | Zarezerwuj za kredyt → anuluj z powodem | Rezerwacja za 0 PLN, anulowana sesja, kredyt zwrócony |
| QA10 / F06 | Aplikacja mentora → Administrator → zatwierdź → edytuj profil | Aplikacja pending → approved, piąty profil w katalogu, zapisany nagłówek |
| QA11 / F07 | Mentor zmienia wolny slot i zapisuje | Zaktualizowana siatka; zajęte okno zablokowane; kalendarz rezerwacji używa zapisanych slotów |
| QA12 / F07 | Zleć wypłatę → potwierdź | Saldo 1530 → 0 PLN, wypłata pending, kolejne zlecenie zablokowane |
| QA13 / F08 | Ustaw strefę Asia/Tokyo → zapisz → odśwież → kalendarz | Preferencja zachowana; lokalne daty i godziny przy slotach i podsumowaniu |
| QA14 | Wczytaj gotowe dane demo | Jedna sesja zakończona, jedna przyszła, wiadomość i płatność |
| QA15 | Mapa ekranów i każdy z czterech stanów | 25 linków, 100 prezentacji stanów, ponów/wróć działa |

## Do powtórzenia przy odbiorze
1. Rozpakuj ZIP i otwórz START.html. Przejdź ścieżkę QA01–QA04 bez serwera.
2. Wybierz w checkout „Termin właśnie zajęty”; wróć do kalendarza i wskaż inne okno.
3. Przetestuj odrzucenie aplikacji zamiast zatwierdzenia i brak uprawnień moderatora po zmianie roli.
4. Sprawdź pobieranie ICS i tekstowego dokumentu DEMO w swojej przeglądarce.
5. Przyjrzyj się kontrastowi, powiększeniu 200%, czytnikowi ekranu oraz pełnej obsłudze klawiaturą.

## Granice weryfikacji
Automatyzowana przeglądarka zezwala na HTTP/HTTPS i zablokowała file://. Nie obchodzono tej polityki. Otwieranie plików lokalnych sprawdzono strukturalnie: klasyczne skrypty defer, wszystkie assety w paczce, brak fetch/importów modułowych/zasobów z sieci; bezpośrednie uruchomienie przez file:// pozostaje do potwierdzenia na urządzeniu odbiorcy. Zapis localStorage może zależeć od polityki przeglądarki; kod ma tryb pamięci awaryjnej.

Nie przeprowadzono audytu WCAG, testów na wszystkich przeglądarkach ani testów integracji z PSP, WebRTC, emailem i PostgreSQL — tych integracji nie ma w makiecie. Nie twierdzimy, że statyczny przełącznik roli zapewnia autoryzację. Nie zweryfikowano wykonania refundów, automatycznych odnowień, wpływu DST ani konkurencyjnych rezerwacji; docelowe zachowanie serwera opisuje API. Opinie i liczby profili są fikcyjne.

## Podglądy
- preview/01-home-desktop.jpg — strona główna, desktop.
- preview/02-home-mobile.jpg — strona główna, mobile.

Archiwum ZIP jest dodatkowo porównywane z plikami źródłowymi po spakowaniu. Wynik kontroli zapisany jest w docs/qa-evidence.json.
