# ADR 0002 — lokalne demo i porty dostawców

Data: 2026-11-03
Status: przyjęta dla lokalnego wdrożenia
Źródło decyzji: użytkownik potwierdził brak konfiguracji Stripe/OAuth/e-mail i zażądał konfiguracji oraz lokalnego trybu demonstracyjnego.

## Kontekst

Musimy umożliwić użycie całego produktu bez kont zewnętrznych, zachowując serwerowe uwierzytelnianie, trwałość danych i niezmienniki finansowe. Lokalny test nie potwierdza integracji z rzeczywistym dostawcą ani gotowości produkcyjnej.

## Decyzja

Tryb demo jest jawną konfiguracją serwera. Korzysta z PostgreSQL, prawdziwych sesji i ról odczytywanych z bazy. Demonstracyjna płatność jest operacją uwierzytelnionego właściciela zamówienia; zapisuje zdarzenie w inbox, które przetwarza worker. UI nie potwierdza zapłaty na podstawie parametru URL. Pakiet otrzymuje kredyty dopiero po zdarzeniu paid. Lokalne wiadomości weryfikacyjne trafiają do izolowanej skrzynki demo, bez rzeczywistej wysyłki.

Stripe Checkout/Connect/refund oraz dostawcy e-mail/OAuth mają jawne konfiguracje i adaptery. Poza trybem demo brak sekretów jest błędem konfiguracji; nie powoduje cichego przełączenia na symulację. Sekrety i tokeny nie trafiają do logów. Funkcje operatorskie pozostają chronione rolą i bramką MFA dla rzeczywistego środowiska.

## Konsekwencje

Testy mogą potwierdzić orkiestrację, podpisy syntetycznych webhooków, idempotencję, retry i późną płatność. Faktyczne Stripe sandbox, OAuth, doręczenie e-mail, KYC/wypłaty i produkcyjne odzyskiwanie danych wymagają osobnej konfiguracji i dowodów. Tryb demo nie wykonuje realnych obciążeń ani wypłat. Publiczna publikacja wymaga świadomego wyłączenia demonstracyjnych operacji i uzgodnienia polityk rozliczeń.
