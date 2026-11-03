# Ustalenia i wnioski

To indeks pamięci długoterminowej projektu. Przeczytaj go przed rozpoczęciem pracy, a następnie otwórz opisy dotyczące bieżącego zadania.

Krótkie wnioski zapisuj poniżej. Dłuższe opisy umieszczaj w `lessons/slug.md` i dodawaj tutaj link z krótkim podsumowaniem. Każdy wniosek powinien zawierać datę, kontekst, przyczynę, sprawdzone rozwiązanie i sposób zapobiegania lub weryfikacji. Hipotezy oznaczaj wyraźnie. Aktualizuj istniejące ustalenia zamiast tworzyć duplikaty.

## Indeks

- **2026-11-03 — środowisko a bundler Next.js:** statyczne `new URL('../../../.env', import.meta.url)` w module `db` zostało potraktowane przez Turbopack jako import zasobu i przerwało build. Sprawdzone rozwiązanie: ładować root `.env` w `next.config.ts` i wejściach CLI, a w modułach bazy czytać `process.env`. Weryfikacja: build bez pliku `.env` i bez `DATABASE_URL` oraz rzeczywisty `db:check` z konfiguracją środowiska.
- **2026-11-03 — scope DI podczas prerenderingu:** `randomUUID()` wywołane przy tworzeniu scope blokowało prerendering z Cache Components, nawet gdy strona czytała tylko stałe informacje o aplikacji. Generowanie metadanych żądania jest teraz leniwe (resolver scoped), dopiero przy użyciu. Weryfikacja: produkcyjny build statycznej strony oraz test stabilności i izolacji identyfikatora w równoległych scope.
- **2026-11-03 — MikroORM 7:** zainstalowane API inicjalizuje metadane bez otwierania połączenia; `connect: false` nie jest już opcją konfiguracji. Sukces inicjalizacji lub testów bez bazy nie potwierdza połączenia. Weryfikuj integrację przez rzeczywiste zapytanie, np. `npm run db:check` (`SELECT 1`), i korzystaj z deklaracji wersji zainstalowanej w repozytorium.


- **2026-11-03 — zgodność narzędzi lint:** mimo ogólnego peer `eslint >=9` w eslint-config-next 16.4.4, dołączone eslint-plugin-import 2.32, jsx-a11y 6.10 i react 7.37 deklarują wsparcie tylko do ESLint 9. ESLint 10 przechodził lint, ale `npm ls eslint` zgłaszało invalid peers. Pozostawiono zgodny ESLint 9.39.5 (rejestr oznacza tę wersję jako niewspieraną); przy aktualizacji sprawdzać cały graf peer dependencies, nie tylko sukces lint, i nie wymuszać instalacji przez `--force`.
