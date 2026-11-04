# DevMentor — koncepcja i klikalny prototyp

## Otwórz
1. Rozpakuj cały ZIP (nie uruchamiaj pliku bezpośrednio wewnątrz archiwum).
2. Otwórz **START.html** w aktualnej przeglądarce.
3. Kliknij **Otwórz prototyp**. Możesz też otworzyć prototype/index.html bezpośrednio.

Nie trzeba instalować zależności, uruchamiać Node ani mieć internetu. Pliki JS są już skompilowane. Jeśli przeglądarka ogranicza zapis przy file://, prototyp korzysta z pamięci do zamknięcia strony. Dla trwałego zapisu i testów polecamy opcjonalny podgląd HTTP: z katalogu tej paczki uruchom Node >=22 poleceniem **node serve.mjs**, potem otwórz http://127.0.0.1:4173. Serwer słucha tylko lokalnie. Zatrzymaj Ctrl+C.

## Jak klikać
- Pierwszy kontakt: Znajdź mentora → Anna → Umów pierwszą sesję → logowanie demo (pola wypełnione) → cel → termin → płatność demo → potwierdzenie.
- W checkout wybierz wynik „Płatność odrzucona” lub „Termin właśnie zajęty”, aby zobaczyć ścieżki błędów.
- W Moich sesjach możesz przełożyć/anulować albo dołączyć do pokoju. Zakończenie otwiera opinię i plan.
- Pasek u góry: rola Uczestnik / Mentor / Administrator; cztery stany ekranu i interaktywny; Mapa ekranów z 25 linkami.
- „Dane przykładowe” wczytuje gotowy panel z jedną przyszłą i jedną zakończoną sesją. Wymaga potwierdzenia zastąpienia danych lokalnych.
- „Reset” przywraca czystą makietę po potwierdzeniu.
- Mentor: Zostań mentorem → aplikacja → Administrator → kolejka → zatwierdzenie → Mentor → profil/dostępność/zarobki.
- Aplikacja pojawi się w katalogu po zatwierdzeniu. Wiadomości, zgłoszenia i decyzje są zapisywane tylko lokalnie.

## Zawartość
- START.html — samodzielna dokumentacja do czytania: koncepcja, przepływy, ekranologia, API, QA.
- docs/01-koncepcja.md — potrzeby, role, zakres, benchmark ze źródłami, 8 przepływów i mapa.
- docs/02-ekrany.md — 25 ekranów: cel, funkcje, UI, cztery stany, walidacje i API.
- docs/03-api.md — projekt kontraktów, wejścia/wyjścia, błędy, uprawnienia i transakcje.
- docs/04-weryfikacja.md — scenariusze i wyniki kontroli wraz z ograniczeniami.
- docs/screens.json — katalog ekranów do dalszej obróbki.
- prototype/index.html, styles.css, screen-data.js, app.js — gotowy prototyp offline.
- prototype/src/app.ts, prototype/tsconfig.json — czytelne źródła i konfiguracja kompilatora.
- workflow/ — specyfikacja i dziennik zadania; brak commitów wykonanych w ramach tego zadania.
- verify.mjs — niezależna kontrola spójności paczki: node verify.mjs.

## Rozwijanie
TypeScript nie jest potrzebny do oglądania. Aby przebudować w repo DevMentor, z root uruchom: node node_modules/typescript/bin/tsc -p docs/mentoring-concept/prototype/tsconfig.json. W niezależnym katalogu z dostępnym kompilatorem TypeScript: tsc -p prototype/tsconfig.json. Nie dodawaj drugiego package-lock ani osobnego pakietu npm dla tego artefaktu.

## Granice makiety
To projekt UX, nie system produkcyjny. Logowanie nie weryfikuje konta, role nie są mechanizmem bezpieczeństwa. Nie ma backendu, wysyłki, połączeń wideo, obciążeń finansowych, integracji z PSP, prawdziwej weryfikacji mentora ani fiskalnych dokumentów. Pobierane potwierdzenie tekstowe jest wyraźnie DEMO, a kalendarz ICS tworzy tylko lokalny plik. Data biznesowa demo: 3 listopada 2026, terminy 10–14 listopada 2026; do pokoju można wejść od razu. Stan pochodzi z localStorage tej przeglądarki lub pamięci awaryjnej.

Katalog ma 4 fikcyjne profile + opcjonalnego zatwierdzonego kandydata. Pakiet demonstracyjny dotyczy Anny; saldo zarobków mentora jest niezależnym seedem historycznym. Dostępność zmieniasz dla Anny lub zatwierdzonego kandydata. Płatności pakietowe, automatyczne odnowienie, naliczanie czasu i przychodzące wiadomości nie działają w tle. Wzorce loading/empty/error/success są sterowane paskiem demo — nie pozorują realnych żądań. Docelowe zachowania serwerowe opisano w API.

Benchmark: oficjalne materiały Preply, sprawdzone 3 listopada 2026, odnośniki w koncepcji. Cała oprawa, treści i kod zostały przygotowane odrębnie. Nie ma zewnętrznych assetów, fontów, trackerów ani zależności uruchomieniowych.
