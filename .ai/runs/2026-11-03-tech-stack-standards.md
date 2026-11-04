# DevMentor — research stosu i standardów

Cele:
- Opracować specyfikację techniczną na podstawie README i aktualnych źródeł.
- Określić standardy inżynieryjne, coding standards, wzorce i plan ich wdrożenia.

Specyfikacja: [Stos i standardy](../specs/2026-11-03-engineering-standards.md)
Status: done

## Kontekst

- Zakres: research i dokumentacja; bez implementacji, instalacji, commita i wdrożenia.
- Projekt: /home/zmudam/dev-mentor, origin https://github.com/MichalZmu/dev-mentor.git, main, HEAD 3fed950619e17b6fa831cfd10a6abe6877935fe7; zastane zmiany zachować.
- Kontrola źródeł: project-readiness z whirly-agentic-sdlc 0.2.3, source_commit a46384578da42a90414e55b0d7165e27390d3a67; bez uruchamiania workflow implementacji.
- Źródła lokalne: AGENTS.md, CLAUDE.md, lessons, README, koncepcja/API, manifesty, konfiguracja i lokalne przewodniki Next.js 16.4.4.

## Wpisy

### 2026-11-03 — rozpoczęcie researchu, bez commita
Zakres: odczyt źródeł produktu i monorepo, plan specyfikacji, kontrola oficjalnych dokumentacji.
Decyzje / pułapki: dostęp do WSL wymaga eskalacji sandboxa; zastane modyfikacje i nieśledzone artefakty innych zadań pozostają zachowane.
Do zrobienia: uzupełnić rekomendacje, standardy, ryzyka i kryteria; sprawdzić dokumentację.

## Kontrola źródeł i wynik opracowania

| Element | Stan | Dowód i wersja | Wpływ na bieżący etap | Następny krok / właściciel |
| --- | --- | --- | --- | --- |
| Repozytorium | Dostępne, zastane zmiany zachowane | main, HEAD 3fed950619e17b6fa831cfd10a6abe6877935fe7, origin MichalZmu/dev-mentor | Wystarczające do researchu; HEAD nie opisuje wszystkich lokalnych zmian | Brak blokera dokumentacji |
| Potrzeby produktu | Dostępne, reguły jako propozycje | README i koncepcja/API z 2026-11-03 | Można opracować architekturę; nie można uznać polityk za zatwierdzone | Produkt: D01/D02/D05/D10 specyfikacji |
| Fundament i dokumentacja Next | Dostępne | Manifesty/lockfile i lokalne docs Next 16.4.4; Cache Components | Rekomendacja zachowuje kierunki zależności i istniejący stos | Wdrożenie według E0–E7 |
| Źródła zewnętrzne | Odczytane | 35 oficjalnych URL cytowanych w specyfikacji; 2026-11-03 | Podstawa do rekomendacji, bez benchmarku/SDK sandbox | Techniczny owner: spike i TCO |
| Standardy procesu | Dostępne | AGENTS/CLAUDE/lessons; project-readiness 0.2.3, a46384578da42a90414e55b0d7165e27390d3a67 | Kontrola źródeł nie dodaje bramki dla ukończenia dokumentacji | Bez workflow implementacji |
| Konta i runtime integracji | Nie weryfikowano | Brak instalacji/wywołań SDK, benchmarku i prób zakupowych | Nie blokuje researchu; ogranicza potwierdzenie kompatybilności/produkcji | Właściciele E0 i otwartych decyzji D01–D11 |

AC-D1–D6: PASS po własnym przeglądzie dokumentacji. Pokryto potrzeby MVP (sekcja 2 i E0–E7), zgodność stosu/granic (3–6), alternatywy i źródła (3–4 oraz odnośniki), coding standards/wzorce (5/9/10), niezmienniki (6–8/11) oraz testy/operacje/ryzyka (12–18). Nie przedstawiać tego jako niezależnego review ani weryfikacji implementacji.

Sprawdzono 18 lokalnych odnośników w czterech dotkniętych plikach, 18 sekcji, 16 scenariuszy T, 11 decyzji D, AC-D/AC-I i zgodność 14 wersji zależności z lockfile (również instalacje zagnieżdżone w workspace). UTF-8, bloki kodu oraz końce plików prawidłowe. git diff --check PASS; nowe pliki sprawdzono również przez diff --no-index --check. Git zgłasza jedynie zastaną politykę konwersji LF/CRLF, bez błędów whitespace.

README rozszerzono o jedną sekcję/link; odtworzenie treści po usunięciu dodatku potwierdziło zachowanie całej wcześniejszej wersji. Lessons rozszerzono wyłącznie o ustalenie hold/session i indeksów czasowych; wcześniejsze bajty zachowane. Kod, konfiguracja, zależności i artefakty poprzednich zadań nie były edytowane.

Nie uruchamiano npm ci/lint/typecheck/test/build, przeglądarki ani bazy: zakres jest dokumentacyjny, a kontrole nie udowodniłyby projektowanych funkcji. AC-I1–I6 pozostają przyszłym zakresem; specyfikacja pozostaje proposed w .ai/specs/. Bez commita i wdrożenia.

### 2026-11-03 — specyfikacja ukończona, bez commita
Zakres: specyfikacja 18 sekcji/35 źródeł, rekomendacje stosu/integracji, coding standards, wzorce, 16 testów, etapy i decyzje; link README i trwały wniosek lessons.
Decyzje / pułapki: modularny monolit i worker; dostawcy warunkowi do spike; research zakończony, wdrożenie standardów nie rozpoczęte.
Weryfikacja / pozostała praca: AC-D1–D6, odnośniki, 14 wersji lockfile i diff PASS; spec SHA256 dc4ed6462fa6a735e80d0fcf3b0fe7e301191bebfbd1191158bbdf49a0bf6794. Brak pozostałej pracy w zakresie dokumentacji.
