# Koncepcja portalu mentoringowego

Cele:
- Przygotować dokumentację produktu i samodzielne klikalne mockupy z pobieralnym ZIP.

Specyfikacja: [Koncepcja portalu](./2026-11-03-mentoring-concept.md)
Status: done

## Wpisy

### 2026-11-03 — przygotowanie i weryfikacja, bez commita
Zakres: 25 ekranów HTML/CSS/TS, 8 przepływów, role i potrzeby, mapa, stany, walidacje, API, benchmark Preply, dokumentacja HTML/Markdown i ZIP.
Decyzje / pułapki: artefakt lokalny w docs/mentoring-concept; brak zmian zależności i produkcyjnej aplikacji. file:// zablokowane przez politykę przeglądarki, UI sprawdzone przez HTTP; hash-router wymaga przechwycenia skip link.
Weryfikacja / pozostała praca: TypeScript strict, lint, typy, 8/8 testów i build PASS; 25 ekranów/100 stanów, mobile i kluczowe ścieżki PASS; ZIP porównany SHA-256 z plikami. Brak pozostałego zakresu zadania; integracje i pełny audyt dostępności poza koncepcją.
