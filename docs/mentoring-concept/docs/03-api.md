# Projekt kontraktów API

To wstępny kontrakt implementacyjny. Prototyp nie wykonuje tych żądań. Prefiks: /api/v1. Publiczne read-only: katalog, profil, opinie, wolne terminy. Pozostałe wymagają sesji cookie HttpOnly/Secure/SameSite i autoryzacji na serwerze. Mutacje z CSRF, rate limitami i walidacją. Identyfikatory nie są uprawnieniami. Czas UTC RFC3339 + timezone IANA; pieniądze integer grosze. W przykładach demo wartości w UI są w PLN.

## Konwencje
Sukces listy: {data: [], nextCursor: string|null}. Limit 1–50, domyślnie 20; stabilny cursor. Obiekt: {data:{...}}. Utworzenie 201; asynchroniczna finansowa 202; kasowanie 204. Błąd: {error:{code,message,fieldErrors?,requestId}}. Statusy: 400 zły format, 401 brak sesji, 403 brak roli, 404 brak obiektu lub dostępu właścicielskiego, 409 konflikt/wersja/slot, 422 walidacja/reguła biznesowa, 429 limit + Retry-After, 502/503 operator/niedostępność. Komunikaty publiczne nie zawierają stack trace ani sekretów.

Idempotency-Key wymagany dla checkout, anulowania/zwrotu, pakietów i wypłat. Klucz związany z użytkownikiem, operacją i hashem body; ten sam request zwraca poprzedni rezultat, inny payload z tym samym kluczem 409. Przechowywać min. 24 h, finansowy ledger dłużej zgodnie z polityką. Webhook PSP: weryfikacja podpisu, eventId unikalny, retry-safe, bez polegania na stanie klienta.

## Katalog i konto
| Metoda / ścieżka | Wejście | Wynik / błędy | Dostęp |
|---|---|---|---|
| GET /mentors | q max100, specialty, language, maxPriceMinor, sort=recommended/price/experience, featured, cursor | publiczne profile, priceMinor/currency/rating/nextAvailable; 422 filtr | publiczny |
| GET /mentors/{id} | mentorId | profil publikowany; 404 nieopublikowany | publiczny |
| GET /mentors/{id}/availability | from/to max31dni, timezone | slotId/startAt/endAt/available; 422 zakres | publiczny |
| GET /mentors/{id}/reviews | cursor | opinie zweryfikowanych sesji; brak prywatnych notatek | publiczny |
| PUT /favorites/{mentorId} | brak | zapis idempotentny, 204 | mentee |
| DELETE /favorites/{mentorId} | brak | 204, także przy już usuniętym | mentee |
| POST /auth/register | name,email,password,termsVersion | 201 user, emailVerificationRequired; 422,429 | gość |
| POST /auth/login | email,password | 200 session; ogólne 401 bez enumeracji | gość |
| POST /auth/password-reset | email | 202 ten sam komunikat dla istniejącego i nieistniejącego email | gość |
| POST /auth/logout | CSRF | 204, unieważnienie sesji | zalogowany |
| GET /me | — | id,name,email,timezone,roles,preferences | właściciel |
| PATCH /me | name,email?,timezone,notifications,version | 200; email pendingVerification; 409 wersja | właściciel |
| GET /me/goals | — | goal,level,description | właściciel |
| PUT /me/goals | goal enum,level enum,description 20–500 | 200 zaktualizowane, 422 | mentee |

Pełna ścieżka resetu w produkcji potrzebuje POST /auth/password-reset/confirm {token,newPassword}; poza zakresem klikalnej makiety. Token jednorazowy 30 min, min.12 znaków, unieważnienie aktywnych sesji po zmianie, bez automatycznego logowania.

## Rezerwacja i płatność
| Metoda / ścieżka | Wejście | Wynik / błędy | Dostęp |
|---|---|---|---|
| POST /booking-holds | mentorId,slotId,durationMinutes=50 | 201 holdId,expiresAt,quote; 409 SLOT_TAKEN | mentee |
| POST /checkout-sessions | holdId,paymentMode=psp/credit,acceptedPolicyVersion | 201 orderId,checkoutUrl albo status=paid dla kredytu; 409 HOLD_EXPIRED, 422 NO_CREDITS | mentee + idempotency |
| GET /orders/{id} | — | pending/paid/failed/refund_pending/refunded,sessionId?,amountMinor | właściciel |
| POST /webhooks/payments | podpisany event operatora | 200/204 po trwałym zapisie eventu; duplikat bez powtórnych skutków | tylko PSP |
| GET /sessions/{id}/calendar | — | text/calendar, UTC DTSTART/DTEND, stabilny UID | uczestnicy |
| GET /orders/{id}/receipt | — | signed URL dokumentu/plik; po opłaceniu | właściciel |

Przykład hold: {mentorId:"anna",slotId:"slot_123",durationMinutes:50}. Quote: {amountMinor:18000,currency:"PLN",durationMinutes:50,cancellationCutoffAt:"2026-11-09T08:00:00Z"}. Hold ma 10 min i jest tworzony transakcyjnie z kontrolą nakładania przedziałów. Wynik klienta PSP nie zmienia statusu zamówienia. Webhook paid tworzy sesję dokładnie raz; jeśli slot nie może już być spełniony, kolejka kompensacyjna/zwrot i informacja dla klienta. Zwolnienie hold po timeout następuje niezależnie od otwartej karty przeglądarki.

## Sesje, wiadomości i plan
| Metoda / ścieżka | Wejście | Wynik / błędy | Dostęp |
|---|---|---|---|
| GET /me/dashboard | — | nextSession,goalProgress,creditBalance | mentee |
| GET /me/sessions | status,cursor | własne sesje z canJoin/canReschedule/canCancel | uczestnik |
| POST /sessions/{id}/reschedule | slotId,version | 200 nowy termin; 409 konflikt,422 poza 24h | uczestnik |
| POST /sessions/{id}/cancel | reason 10–500,version | 202 cancelled + refundStatus lub kredyt; 422 cutoff | uczestnik + idempotency |
| POST /sessions/{id}/join | — | roomUrl,token,expiresAt; 422 TOO_EARLY | uczestnik sesji |
| PUT /sessions/{id}/notes | note max2000,version | 200 prywatna notatka właściciela | uczestnik |
| POST /sessions/{id}/complete | attendanceEventId | 200 completed; status rozliczenia osobno | uprawniony serwer/provider; makieta symuluje uczestnikiem |
| POST /sessions/{id}/reviews | rating1–5,comment10–1000 | 201; 409 ALREADY_REVIEWED,422 NOT_COMPLETED | mentee tej sesji |
| GET /conversations | cursor | własne wątki, unreadCount | uczestnik |
| POST /conversations | mentorId | 201/200 istniejący wątek, unikalność pary | mentee |
| GET /conversations/{id}/messages | cursor | tekst i status; sort chronologiczny | uczestnik wątku |
| POST /conversations/{id}/messages | text1–2000,clientMessageId | 201; deduplikacja clientMessageId | uczestnik wątku |
| GET /me/learning-plan | — | id,goal,milestones,version | mentee / przypisany mentor |
| PATCH /learning-plans/{id}/milestones/{milestoneId} | completed,version | 200 nowa wersja;409 stale | mentee / przypisany mentor |

Przełożenie atomowo rezerwuje nowy slot i zwalnia stary, zachowując zamówienie. Dla przełożenia/anulowania serwer wylicza cutoff. UI używa zwróconych can*; nie ufa zegarowi urządzenia. Notatki prywatne nie są publikowane jako opinie. Wiadomości renderowane jako tekst, bez HTML; załączniki poza MVP.

## Pakiety i mentoring
| Metoda / ścieżka | Wejście | Wynik / błędy | Dostęp |
|---|---|---|---|
| GET /me/billing | — | transakcje, plan,status,renewalDate,credits | mentee |
| POST /subscriptions | mentorId,packageSize=4,autoRenew=false,consentVersion? | 201 checkout order, aktywacja po paid;422 FIRST_SESSION_REQUIRED | mentee + idempotency |
| PATCH /subscriptions/{id} | action=pause/resume/cancel,autoRenew?,version | 200 status i data;409 stale | właściciel |
| POST /mentor-applications | name,bio50–1000,specialty,years1–40,priceMinor5000–50000,termsVersion | 201 pending;409 ACTIVE_APPLICATION | kandydat |
| GET /me/mentor-application | — | aplikacja,status,decisionReason? | właściciel |
| GET /mentor/dashboard | — | statystyki własne,status publikacji | mentor/kandydat (ograniczony) |
| GET /mentor/profile | — | własny profil,status,version | mentor |
| PATCH /mentor/profile | headline10–100,bio50–1000,specialty,priceMinor,version | 200 profil; re-review wg polityki | mentor |
| GET /mentor/availability | from,to | własne sloty,booked,timezone | mentor |
| PUT /mentor/availability | slots[{startAt,endAt}],version | 200;409 BOOKED_SLOT,422 OVERLAP | mentor |
| GET /mentor/earnings | period,cursor | grossMinor,feeMinor,netMinor,availableMinor,payouts | mentor |
| POST /mentor/payouts | amountMinor,currency | 202 payoutId,status=pending;422 KYC_REQUIRED/INSUFFICIENT_BALANCE | mentor + idempotency |

Pakiet i kredyty u konkretnego mentora, zakup nie blokuje terminów. Każde wykorzystanie/zwrot kredytu ma zapis ledgeru powiązany z sesją. AutoRenew wymaga odrębnej zgody i historii jej wersji. Wyłączenie odnowienia nie usuwa już opłaconych sesji. KYC, płatności cykliczne, settlement i refund obsługuje PSP; aplikacja przechowuje referencje, nie dane kart ani dokumenty KYC.

## Obsługa i moderacja
| Metoda / ścieżka | Wejście | Wynik / błędy | Dostęp |
|---|---|---|---|
| POST /support-tickets | category,email?,description20–2000,sessionId? | 201 ticketId,status=open | zalogowany; gość po ograniczeniu nadużyć |
| GET /me/support-tickets | cursor | zgłoszenia własne i odpowiedzi | właściciel |
| GET /admin/overview | — | zagregowane liczniki | support/admin |
| GET /admin/mentor-applications | status,cursor | kolejka | moderator/admin |
| GET /admin/support-tickets | status,priority,cursor | kolejka | support/admin |
| GET /admin/cases/{id} | — | sprawa,wersja,dozwolone akcje,audit | odpowiednia rola |
| POST /admin/cases/{id}/decision | action=approve/reject/resolve,reason10–1000,version | 200 zamknięta sprawa;409 STALE_CASE,403 role | odpowiednia rola |

Weryfikacja mentora i rozwiązywanie zgłoszeń to dwa typy spraw. Support nie może approve/reject aplikacji. Finansowe refundy są odrębną operacją operatora z odpowiednimi uprawnieniami; samo resolve nie zwraca pieniędzy. Audit log append-only: actorId,caseId,previousStatus,newStatus,reason,timestamp,requestId. Widok listy minimalizuje dane osobowe.

## Niefunkcjonalne decyzje do wdrożenia
Unikalny indeks na review(sessionId,menteeId), webhook(provider,eventId), ledger(reference,type), aplikacja aktywna/user; ograniczenie nakładania slotów w transakcji PostgreSQL. Oddzielny EntityManager per żądanie; idempotencja i transakcje w db/core, orchestracja w app. Dane paginowane; brak globalnego kontenera w logice biznesowej. Zdarzenia outbox SessionBooked/Rescheduled/Cancelled, PaymentConfirmed, ApplicationDecided, TicketResolved dla powiadomień i retry. Brak automatycznych migracji podczas startu. Produkcyjne testy obejmą konkurencyjne rezerwacje, zdublowany webhook, DST, refund, autoryzację i zmiany wersji.
