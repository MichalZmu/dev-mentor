# GitHub CI i pełne testy jednostkowe

Data utworzenia: 2026-11-03
Status: done

## Cel i zakres

Zapewnić dla każdego PR build, lint, testy TypeScript z pełnym pokryciem istniejącego kodu aplikacji oraz integrację PostgreSQL/Testcontainers. Udostępnić odizolowaną tymczasową instancję aplikacji do testowania przez agent-browser. Zachować zastane niezacommitowane zmiany produktu i istniejące kontrole bezpieczeństwa.

## Plan i zależności

1. Zinwentaryzować istniejące workflow, kod i testy. Bazowe 25 testów przechodzi, ale coverage core wynosi tylko 1.25% lines; nowy kod produktu nie jest przetestowany.
2. Rozszerzyć Vitest na serwer i komponenty React (osobne warunki react-server/jsdom), objąć implementacje wszystkich czterech pakietów oraz narzędzia w root. Nie wykluczać nieimportowanych implementacji ani obniżać progów.
3. Uzupełnić miarodajne testy jednostkowe core/db, serwera i UI w odrębnych zakresach zapisu. Zewnętrzne usługi zastąpić kontrolowanymi adapterami w unit tests; prawdziwy PostgreSQL testować integracyjnie.
4. Dodać zarządzany cykl życia tymczasowej bazy i serwera produkcyjnego: migracje, syntetyczne dane, gotowość, agent-browser, sprzątanie również po błędzie.
5. Uzupełnić CI, AGENTS i README. Zweryfikować kontrole i niezależne review, zapisać wyniki i ograniczenia.

## Kryteria akceptacji i scenariusze

- AC1: Każdy pull_request uruchamia lint i build oraz testy jednostkowe i integracyjne; ci-required odrzuca failure/skipped/cancelled. Kontrola workflow i wszystkich komend lokalnie.
- AC2: Vitest dla TypeScript i React egzekwuje 100% lines/branches/functions/statements per plik implementacji, także nieimportowany. Testy sukcesów, błędów i wartości brzegowych; raport coverage oraz kontrola negatywna nowego nieprzetestowanego pliku.
- AC3: AGENTS jednoznacznie wymaga 100% testów jednostkowych każdej nowej funkcji, bez ograniczenia do core.
- AC4: Testcontainers uruchamia własny PostgreSQL 18.6, migracje i tymczasową aplikację; agent-browser weryfikuje działający widok korzystający z bazy. Zatrzymanie i błąd kończą serwer/bazę; nie używać bazy użytkownika.
- AC5: README opisuje powtarzalne uruchomienie, wymagania Docker/Chromium i ręczną sesję agent-browser. Raporty CI dostępne po błędzie; Actions pełne SHA, minimalne uprawnienia, bez sekretów wdrożeniowych.

## Ryzyka i granice

Zastany produkt jest obszerny i nieukończony; nie deklarować sukcesu kontroli, których nie wykonano. Lokalne docs Next.js zalecają E2E async Server Components; unit testy sprawdzają ich własną kompozycję, E2E integrację runtime. Nie zmieniać kontraktów produktu dla wygody coverage. Konfiguracja i deklaracje typów nie są implementacjami; uzasadnić każdy wyjątek.

## Wynik końcowy — 2026-11-03

AC1–AC5 spełnione dla konfiguracji repozytorium i lokalnej weryfikacji. Zachowano zastane zmiany produktu; po ich końcowym zamrożeniu inspekcja nie wymagała dalszych zmian implementacji ani osłabienia testów.

- Workflow obejmuje każdy PR: lint, typy, graf zależności, build, Vitest, PostgreSQL/Testcontainers, agent-browser, desktop/mobile E2E i bezpieczeństwo. `ci-required` odrzuca failure/skipped/cancelled; niezależnie sprawdzono 18 scenariuszy bramki.
- 396/396 testów jednostkowych PASS. Wszystkie 78 plików objętych coverage mają 100% czterech metryk: 2357 lines, 2473 statements, 555 functions i 1985 branches. Zakres: implementacje pakietów aplikacji i narzędzia root scripts; osobna makieta docs i infrastruktura tests/support nie należą do kodu aplikacji objętego tym raportem. Nieimportowana funkcja w izolowanej próbie prawidłowo powoduje błąd progu.
- 54/54 testy integracyjne PASS na własnym PostgreSQL 18.6, w tym dwa testy produkcyjnej aplikacji z rzeczywistym agent-browser. 6/6 E2E PASS desktop/mobile. Zasoby testowe posprzątane, istniejący serwer developerski zachowany.
- Świeże format, lint, typecheck, deps:check, npm ls, build bez konfiguracji bazy/dostawców i security:check PASS. AGENTS jednoznacznie wymaga 100% unit każdej nowej lub zmienionej funkcji. README zawiera wymagania, komendy oraz ręczną sesję test:app/agent-browser.
- Niezależne review nie wykazało nierozwiązanych uwag blokujących. Wszystkie kontrole wykonano na tym samym stanie 213 plików, identycznym z zachowanym manifestem engineering-final; końcowe zmiany dotyczą wyłącznie artefaktów workflow AI.

Dowody: [niezależna weryfikacja](../../runs/evidence/2026-11-03-github-ci-final-verification.md), [niezależne review](../../runs/evidence/2026-11-03-github-ci-final-review.md). Proces change-delivery 0.2.3, source_commit a46384578da42a90414e55b0d7165e27390d3a67.

Nie wykonano commita/pusha ani hosted CI i nie zmieniono ochrony gałęzi GitHub. Właściciel powinien wymagać `ci-required` i review w ustawieniach repozytorium. Lokalna przeglądarka korzystała z istniejącego Chrome i bibliotek systemowych, ponieważ wcześniejsze instalatory wymagały interaktywnego sudo; testów nie pominięto. Lock odpowiada wcześniejszemu sprawdzonemu npm ci, a świeże npm ls przechodzi. Szczegółowe ograniczenia i rozdzielenie audytu npm od Gitleaks Action zapisano w raporcie weryfikacji.
