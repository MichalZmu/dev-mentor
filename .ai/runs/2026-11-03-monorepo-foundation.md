# DevMentor — konfiguracja monorepo

Cele:
- Wdrożyć cztery pakiety npm workspaces oraz uzgodniony stos.
- Zweryfikować konfigurację, izolację DI/ORM i uruchomienie aplikacji.

Specyfikacja: [Konfiguracja monorepo](../specs/2026-11-03-monorepo-foundation.md)
Status: in-progress

## Zadanie i bieżący krok

- Proces: whirly-agentic-sdlc 0.2.3; source_commit a46384578da42a90414e55b0d7165e27390d3a67.
- Wejścia: specyfikacja v1, uzgodniona architektura w AGENTS.md, polecenie użytkownika z 2026-11-03.
- Kontrakty: brak zmiany istniejącego API biznesowego; nowe wewnętrzne interfejsy pakietów infrastruktury.
- Etap: przygotowanie; runda 0.
- Prowadzący: /root; role wykonawcy, weryfikatora i reviewera zostaną przydzielone osobnym instancjom.
- Zakres zapisu wykonawcy: kod, konfiguracja i dokumentacja projektu, bez .git i bez tego dziennika/specyfikacji.
- Scenariusze i wymagane kontrole: tabela AC1–AC5 w specyfikacji.
- Następny krok: implementacja i kontrole, potem niezależna weryfikacja oraz review.
- Role nie mają odrębnej technicznej izolacji zapisu; zakresy wymuszane instrukcjami.

## Stan początkowy

Gałąź: main; HEAD: 80bd04588b0ef06dfa2be31df6d9fa99d7f7cc4b.
SHA-256 lokalnego diffu względem HEAD: 662b8a66a0b64bbae008849b8faa35c758272e619e815b376fa4d735e2816ff8.
Zastane zmiany: AGENTS.md i README.md zmodyfikowane, CLAUDE.md i struktura .ai nieśledzone. Zachować te zmiany.
Istotne pliki nieśledzone i sumy:
- .ai/lessons.md: 4470ad5339efac3c574b3341be82494d782ae8fc74c9e90d44b5b5dfa38ab660
- .ai/lessons/.gitkeep: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- .ai/runs/README.md: 64518d8995677bf81f5b0629b61eed48b5c25788ba224458638966f1fdc45a4c
- .ai/specs/README.md: 65e7a75dfa247449803d30c90ab6d587f66f998d799cabfaabb65d07a6c67004
- .ai/specs/archive/.gitkeep: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- .ai/specs/implemented/.gitkeep: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CLAUDE.md: 7929ac10c025a1cdd6cca8c029057e16eaed33f6737e5bc153841b613bf7228d

## Historia i dowody

### 2026-11-03 — przygotowanie
Zakres: specyfikacja v1, plan i scenariusze kontroli. Rejestr npm: Next.js 16.4.4, React 19.3.1, MikroORM 7.2.6, Awilix 13.0.5, shadcn 4.23.0.
Decyzje / pułapki: npm workspaces z jednym lockfile; Linux Node v26.13.0 wymaga dodania ścieżki nvm. Docker w WSL nie jest zintegrowany.
Do zrobienia: implementacja, niezależna weryfikacja i review; bez commita.

### 2026-11-03 — stan początkowy i baza testowa
Zakres: npm run lint oraz npm exec tsc -- --noEmit przeszły dla startera przed zmianami.
Decyzje / pułapki: uruchomiono Docker Desktop 29.7.2 i nowy kontener devmentor-verification-20261103 z PostgreSQL 18.6, port 127.0.0.1:55432, baza devmentor_verification, dane tmpfs; port osiągalny z WSL. Bez operacji na istniejących bazach.
Do zrobienia: implementacja przez /root/implement_monorepo; niezależne kontrole AC1–AC5 i usunięcie tymczasowego kontenera.

### 2026-11-03 — implementacja runda 0 i zamrożenie źródeł
Zakres: implementator /root/implement_monorepo zakończył źródła; własne lint/typecheck/8 testów/build i integracja PostgreSQL przeszły. Trwa końcowe npm ci i smoke po ustaleniu lockfile.
Decyzje / pułapki: testdesigner /root/design_checks wskazał kompozycję scope/EM i wyścig get/close; oba scenariusze dodane do testów. Pierwszy kontener testowy zakończył działanie bez zachowanych logów; nowy kontener o tej samej nazwie działa stabilnie, bez OOM. Compose config prawidłowy z .env.example; Docker Desktop wymaga integracji WSL dla lokalnego polecenia docker.
Do zrobienia: niezależna weryfikacja, review i kontrola UI. Stan źródeł r0: 15cb2a0689fbd6a002ac748aaf6f8d8569b17ae5e415b4337bb9042a088cf4d5; manifest: evidence/2026-11-03-monorepo-foundation-r0.json (obejmuje wcześniejsze zmiany AGENTS/README, bez zmiennych sekretów i dziennika).
