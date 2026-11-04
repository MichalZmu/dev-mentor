# ADR 0001 — modularny monolit i granice pakietów

Data: 2026-11-03
Status: przyjęta dla bieżącej implementacji
Źródła: AGENTS.md, specyfikacja standardów inżynieryjnych i decyzja użytkownika o pełnym zakresie oraz zachowaniu npm.

## Kontekst

Portal potrzebuje spójnych rezerwacji, rozliczeń i uprawnień. Istnieją cztery pakiety TypeScript oraz PostgreSQL/MikroORM. Niezależne wdrażanie mikroserwisów nie jest wymaganiem.

## Decyzja

Zachowujemy jeden modularny monolit i npm workspaces z jednym package-lock.json. Pakiet core zawiera kontrakty, polityki i przypadki użycia; db implementuje porty i atomowe operacje PostgreSQL; app odpowiada za transport, integracje i composition root; ui za współdzielone komponenty React. Dozwolone zależności: app→core/db/ui, db→core. ui nie importuje core ani infrastruktury. Używamy publicznych eksportów.

Awilix strict składa zależności na serwerze. Każde żądanie/zadanie otrzymuje izolowany EntityManager i scope, współdzieląc pulę procesu. Worker jest osobnym procesem tego samego wydania. Migracje są jawne i nie uruchamiają się podczas startu web/workera. Auth ma oddzielny schemat i pulę od domeny.

## Alternatywy i konsekwencje

Osobne API i mikroserwisy zwiększyłyby liczbę kontraktów i problemów spójności. Pozostawienie warstw w jednym pakiecie utrudniałoby kontrolę zależności. Wybrany podział pozwala egzekwować granice i cykle w CI, a PostgreSQL zabezpiecza niezmienniki przy współbieżności. Wydzielenie usługi wymaga nowego ADR z konkretną potrzebą skalowania lub izolacji.
