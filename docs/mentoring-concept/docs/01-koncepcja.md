# DevMentor — wstępna koncepcja produktu

Wersja 1.0 · 3 listopada 2026 · status: propozycja do dyskusji

## 1. Obietnica i założenia
„Twój kolejny krok w IT. Z kimś, kto już go zrobił.” Marketplace mentoringu technologicznego dla dorosłych, początkowo rynek PL, PLN i języki PL/EN. Jednostką jest sesja online 1:1 trwająca 50 minut. Wartością jest plan i postęp między spotkaniami, nie sam zakup czasu. Nazwa robocza DevMentor; cała identyfikacja i treści makiety są oryginalne. Profile, oceny, statystyki i firmy w makiecie są fikcyjne.

MVP: katalog i profile, cele, pierwsza płatna sesja, terminarz, checkout PSP, panel, komunikacja, pokój spotkania, opinia, plan rozwoju, opcjonalny pakiet, zgłoszenie i weryfikacja mentorów, podstawowe rozliczenia oraz obsługa zgłoszeń. Poza MVP: B2B, konta nieletnich, grupy, AI matching, nagrywanie rozmów, rozbudowany LMS, marketplace plików. Nie proponujemy dziedziczenia zasad cenowych czy refundacji Preply.

## 2. Użytkownicy i potrzeby
| Aktor | Potrzeby / zadania | Uprawnienia i ograniczenia | Miara powodzenia |
|---|---|---|---|
| Gość | Zrozumieć ofertę, porównać mentorów i cenę, poznać dostępność | Katalog, profile, FAQ; bez prywatnych rozmów i rezerwacji | Przejście do profilu / rozpoczęcie rezerwacji |
| Początkujący mentee | Wybrać kierunek, bezpiecznie sprawdzić dopasowanie | Własne cele, płatności, sesje i wiadomości | Pierwsza odbyta sesja i ustalony plan |
| Doświadczony mentee | Rozwiązać problem, awansować, przygotować rozmowę | Jak wyżej; filtr specjalizacji i konkretny brief | Ukończony kamień milowy |
| Kandydat na mentora | Przedstawić doświadczenie, wiedzieć co dzieje się z aplikacją | Własna aplikacja; brak publikacji przed decyzją | Zatwierdzenie lub uzasadniona odmowa |
| Mentor | Pozyskiwać dopasowane osoby, zarządzać terminami, prowadzić rozwój, rozliczać pracę | Własne dane; plany przypisanych mentees; bez cudzych płatności | Frekwencja, powtórne sesje, środki rozliczone |
| Support | Rozwiązać problem sesji/płatności i komunikować wynik | Kolejka zgłoszeń i niezbędny kontekst; brak moderacji mentorów i wypłat | Czas pierwszej odpowiedzi i rozwiązania |
| Administrator / moderator | Kontrolować jakość i nadużycia, publikować mentorów | Decyzje z uzasadnieniem, audyt; podział ról w produkcji | Czas moderacji, odsetek reklamacji |
| Operator finansowy (rola operacyjna, późniejszy etap) | Rozliczenia, wyjątki zwrotów i wypłat | Uprawnienia finansowe osobno od supportu | Zgodność sald i audytu |

Systemy zewnętrzne: PSP (hostowany checkout, webhook, refund, payout/KYC), dostawca wideorozmów, email transakcyjny. Kalendarz użytkownika dostaje plik ICS; synchronizacja dwukierunkowa poza MVP.

## 3. Benchmark Preply — fakty i adaptacje
Sprawdzono oficjalne źródła 2026-11-03. Publiczne help center może się zmieniać; obserwacje opisują udokumentowane przepływy, nie niezależny audyt konwersji lub jakości.

| Wzorzec zaobserwowany | Dlaczego przydatny | Własna propozycja DevMentor |
|---|---|---|
| Katalog, prezentacja prowadzącego i opinie pomagają w wyborze [B1] | Redukuje niepewność przed zakupem | Specjalizacje IT, konkretne cele, jawne doświadczenie i weryfikacja |
| Pierwsza sesja przed wyborem dalszego planu [B1, B2] | Można ocenić dopasowanie | Płatna sesja 50 min, bez automatycznego pakietu po spotkaniu |
| Strefa czasowa, termin, płatność, potwierdzenie [B2] | Jasna sekwencja transakcji | Hold slotu, cena brutto i strefa w każdym podsumowaniu |
| Zarządzanie spotkaniami z własnego panelu [B3] | Samoobsługa zmian | Własna propozycja granicy 24 h i widoczny skutek finansowy |
| Dobór i zmiana planu współpracy [B4] | Ułatwia regularność | Opcjonalny pakiet 4 sesji; odnowienie domyślnie wyłączone |

B1: https://preply.com/en/how-it-works
B2: https://help.preply.com/en/articles/4179487-how-to-book-a-trial-lesson
B3: https://help.preply.com/en/articles/13925068-how-to-reschedule-a-lesson
B4: https://help.preply.com/en/articles/6092685-how-to-manage-your-subscription

Nie kopiujemy układów piksel w piksel, treści, kodu, zdjęć ani znaków Preply. Własna paleta: leśna zieleń, ciepłe tło, limonka i lawenda; typografia redakcyjna z systemowymi fontami.

## 4. Zasady biznesowe — propozycje, wymagają uzgodnienia
- Cena brutto i waluta PLN widoczne przed akcją. Pierwsza i kolejne pojedyncze sesje 50 min według aktualnej oferty mentora. Cena zapisana w zamówieniu nie zmienia się po edycji profilu.
- Rezerwacja min. 24 h przed początkiem. Slot jest blokowany na 10 min. W produkcji atomowe sprawdzenie konfliktów w bazie, nie tylko disabled w UI.
- Przełożenie/anulowanie co najmniej 24 h wcześniej bez opłaty; przy anulowaniu pojedynczej sesji zwrot do pierwotnej metody, a z pakietu zwrot kredytu. Później samoobsługa zablokowana i ścieżka do supportu. Nie obiecujemy automatycznego zwrotu w wyjątkach; support rozpatruje sprawę.
- Płatność: pending → paid lub failed. Dopiero podpisany webhook tworzy potwierdzoną rezerwację; success URL nie jest dowodem płatności. Timeout nie oznacza porażki; klient sprawdza status. Idempotencja chroni przed ponownym obciążeniem.
- Status sesji: scheduled → completed albo cancelled; join i reschedule nie tworzą kolejnego zamówienia. Mentor nie może sam oznaczyć sesji jako rozliczonej bez zasad settlement. Spór wstrzymuje rozliczenie.
- Pakiet po odbytej pierwszej sesji: 4 sesje u tego samego mentora, 4 × cena sesji; brak rabatu w koncepcji. W makiecie 4 × 180 = 720 PLN. Ważność 90 dni (propozycja); najpierw wykorzystujemy najstarszy kredyt. Brak wygaszania kredytu w makiecie.
- Automatyczne odnowienie osobno i domyślnie wyłączone; propozycja odnowienia po 30 dniach. Pauza wyłącza kolejne obciążenia; wznowienie ustala nową datę 30 dni później. Rezygnacja pozostawia opłacone kredyty do końca ważności. Zmiana lub rezygnacja nigdy nie anuluje istniejących sesji.
- Mentor otrzymuje propozycję 85% kwoty sesji (15% prowizji). Payout tylko z rozliczonego salda i po KYC u PSP. W makiecie przykładowe historyczne zarobki są danymi seed, nie wynikiem obliczeń prawdziwych płatności.
- Daty: UTC w kontraktach, strefa IANA w profilu, formatowanie po stronie odbiorcy. Przy zmianie DST identyfikator slotu i offset rozstrzygają niejednoznaczności.
- Opinie jedynie po zakończonej sesji, jedna na sesję; zgłoszenie nadużycia trafia do supportu. Usunięcie negatywnej opinii wymaga udokumentowanej podstawy i audytu.

## 5. Kluczowe use case'y i kompletne przepływy
Każdy przepływ ma reprezentację w makiecie; identyfikatory Sxx odpowiadają katalogowi ekranów.

### F01 — od potrzeby do opłaconej pierwszej sesji
Aktor: gość / mentee. Warunek: aktywny mentor z terminami.
1. S01 → S02: wybiera kierunek, filtruje cenę/specjalizację/język i sortuje.
2. S03: czyta bio i opinie, sprawdza cenę; może napisać wiadomość (F04).
3. CTA rezerwacji → S04, jeśli niezalogowany. Rejestracja zachowuje mentora; błędny email lub brak zgody zatrzymuje formularz. „Nie pamiętasz hasła” → S05 → neutralne potwierdzenie → S04.
4. S06: wybiera cel, opisuje potrzebę; zapis → S07.
5. S07: wybiera dzień, godzinę i sprawdza strefę. Brak terminów → inny dzień lub S14. Konflikt slotu → komunikat i ponowny wybór.
6. S08: weryfikuje mentora, koszt i zasady; potwierdza płatność. Błąd płatności pozostawia zamówienie do ponowienia, bez sesji. Timeout w produkcji wymaga sprawdzenia statusu.
7. S09: potwierdzenie; pobranie ICS, kontakt lub S11.
Koniec: jedna potwierdzona sesja i jedno zamówienie, widoczne w panelu i rozliczeniach.

### F02 — zmiana i anulowanie spotkania
Aktor: mentee (mentor analogicznie, z powiadomieniem drugiej strony). Warunek: przyszła sesja.
1. S10 → S11; wybór „Przełóż” → S07 w trybie zmiany.
2. Wybór nowego slotu i potwierdzenie; konflikt nie usuwa starego terminu.
3. Sukces → S11, nowy termin na karcie i w kalendarzu; bez nowej płatności.
4. Alternatywa: „Anuluj” otwiera dialog ze skutkiem finansowym i powodem. Powrót zamyka dialog bez zmiany; potwierdzenie oznacza cancelled, rejestruje refund pending lub zwraca kredyt, pokazuje status.
5. Mniej niż 24 h → S18; próba zmiany nie obchodzi reguły.
Koniec: dokładnie jedna zmiana lub anulowanie, czytelny status i informacja dla drugiej strony. Powiadomienia w makiecie są tylko komunikatem lokalnym.

### F03 — odbycie sesji, opinia i dalsza praca
Aktor: mentee / mentor. S11 → S12 (w demo dołączenie dostępne od razu).
1. Lobby pokazuje kontekst; dołączenie otwiera scenę demo. Przełączniki kamery/mikrofonu zmieniają status bez proszenia o dostęp do urządzeń.
2. Uczestnik zapisuje notatkę; błąd połączenia można zobaczyć przełącznikiem stanów i ponowić.
3. Zakończenie → completed, S13; ocena i komentarz przechodzą walidację.
4. Zapis → S15; mentee odhacza zadanie, postęp rośnie. Kolejna sesja → S07.
Koniec: zakończona sesja, jedna opinia i zapisany postęp. W produkcji koniec call i rozliczenie są odrębnymi zdarzeniami.

### F04 — kontakt i pomoc
S03 → S04 jeśli potrzeba → S14. Mentee pisze, wysyła; pusty tekst zablokowany, długi przycięty przez limit. Wiadomość pozostaje po odświeżeniu w obrębie przeglądarki. Nie ma prawdziwej wysyłki ani odpowiedzi innej osoby. „Zgłoś problem” → S18: kategoria, opis, opcjonalna sesja, zgłoszenie → numer sprawy. S24 → S25: operator wybiera zgłoszenie, wpisuje uzasadnienie i rozwiązuje. Koniec: sprawa rozwiązana w lokalnej kolejce i wynik widoczny dla uczestnika.

### F05 — dobrowolna regularna współpraca i rozliczenia
Po completed: S13/S15 → S16 → pakiet 4 sesji. Osobna zgoda na odnowienie; zakup demo → aktywny pakiet i transakcja. Rezerwacja następnej sesji → S07 → S08, gdzie wybierany jest dostępny kredyt zamiast kolejnej płatności. Jedna rezerwacja zużywa jeden kredyt; przełożenie nie zużywa następnego. S16 → pauza / wznowienie / rezygnacja przez potwierdzenie; status i data zmieniają się. Dokument transakcji można pobrać jako tekst oznaczony DEMO, nie dokument fiskalny. Koniec: jawny stan planu, saldo i historia. Odrzucenie zakupu nie zmienia salda.

### F06 — pozyskanie i moderacja mentora
Gość → S19. Kandydat podaje wymagane dane, stawkę i akceptuje zasady. Sukces → pending, S20 informuje o weryfikacji. W demo zmiana roli na Administrator → S24 → S25. Moderator sprawdza checklistę, wpisuje uzasadnienie, zatwierdza lub odrzuca. Odrzucenie kończy sprawę z powodem. Po akceptacji rola Mentor → S20 → S22 zapis oferty → S21 udostępnienie slotów. Profil aplikanta pojawia się w S02/S03 dopiero po akceptacji. Koniec: publiczny mentor z ceną i dostępnością albo uzasadniona odmowa. Realna kontrola tożsamości i dowodów doświadczenia poza makietą.

### F07 — praca i zarobki mentora
S20 pokazuje sesje; S21 zmiana siatki nie pozwala usunąć zajętego slotu. S22 edycja oferty nie przelicza dawnych zamówień. S23 pokazuje brutto, prowizję, netto i dostępne saldo; „Zleć wypłatę” → dialog z kwotą → status pending, dostępne saldo maleje. Ponowienie przy zerowym saldzie zablokowane. W produkcji wypłata z potwierdzonym KYC i idempotency key. Koniec: zlecenie wypłaty z audytem, bez gwarancji natychmiastowego przelewu.

### F08 — utrzymanie konta i odzyskanie dostępu
S04 → S05: email, neutralne potwierdzenie; etap tokenu poza makietą. S17: zmiana imienia, email, strefy i preferencji → zapis → render dat w wybranej strefie. Wylogowanie → S01; konto i dane demo pozostają do resetu. Konto produkcyjne musi mieć weryfikację adresu, bezpieczne cookies i kontrolę ról po stronie serwera. Koniec: zapisane preferencje albo jasny błąd bez utraty danych.

## 6. Mapa i nawigacja
Publiczna: S01 → S02 → S03; S04 ↔ S05; S19; S18. Główne CTA to „Znajdź mentora”.
Zakup: S03 → S04 → S06 → S07 → S08 → S09 → S11. Powrót zachowuje kontekst.
Panel mentee: S10 (start), S11, S14, S15, S16, S17, S18. S11 → S12 → S13 → S15.
Panel mentora: S20 (start), S21, S22, S11, S14, S23, S17, S18.
Panel operatora: S24 → S25 → S24. W produkcji UI administracyjne na shadcn/ui w packages/ui; statyczna makieta pokazuje wzorzec tabel/dialogów bez implementacji zależności React.
Nawigacja desktop: górny pasek publiczny, boczne menu w panelach; na mobile zwijane menu. Breadcrumb i tytuł na każdej podstronie. Hash routing działa również z file:// i przy wstecz/dalej. Link „Mapa ekranów” otwiera katalog wszystkich 25 widoków. Rola w pasku demo jest narzędziem prezentacji, nie systemem autoryzacji.

## 7. Docelowa architektura i kontrakty
Prototyp jest samodzielnym artefaktem HTML/CSS/TS, bez backendu. Produkcyjne wdrożenie należy zaplanować osobno zgodnie z repo: app składa core/db/ui i Awilix, core zawiera reguły, db jawne schematy MikroORM/migracje i request EntityManager, ui współdzielone komponenty. Dane prywatne i kontener wyłącznie na serwerze. Trasy stron i route handlers zgodnie z lokalną dokumentacją Next.js, przeczytaną przy przygotowaniu tego artefaktu.
API opisano w 03-api.md. Szkic modelu: User, MentorProfile, MentorApplication, AvailabilitySlot, BookingHold, Order, Payment, Session, Conversation, Message, LearningPlan, Milestone, Review, Subscription, CreditLedger, SupportTicket, ModerationDecision, Payout. Profile i dostępność publiczne; reszta kontrolowana na serwerze według właściciela i relacji. Pieniądze jako integer grosze + ISO currency; ledger i audyt dla operacji finansowych.

## 8. Jakość UX i dostępność
Cel WCAG 2.2 AA w implementacji produkcyjnej. Semantyczne nagłówki, label, focus-visible, skip link, status aria-live, gwiazdki jako wybór z nazwą, przyciski co najmniej 44 px, dialog z pułapką focus i Escape, brak znaczenia wyrażonego jedynie kolorem. Preferencja reduced-motion; bez zależności od hover. Mobile 390 px i desktop 1440 px są punktami kontroli. Wartości finansowe i decyzje widoczne przed potwierdzeniem. Błąd obok pola + komunikat; nie kasować danych po błędzie.

## 9. Miary i pytania do dalszych badań
Lejek: katalog → profil → wybór terminu → rozpoczęcie checkout → paid → completed → druga completed w 30 dni. Guardrails: konflikty slotów, błędy płatności, późne anulowania, reklamacje, czas odpowiedzi i wypłat. Sukces mentorskiego produktu to ukończony cel, nie sama liczba zakupów. Nie ma analityki ani trackerów w paczce.
Do walidacji badaniami: zrozumienie mentoringu vs konsultacji, kryteria zaufania, długość i cena sesji, polityka 24 h, ważność pakietu, elastyczność odnowień, przechodzenie pomiędzy mentorami. Prawne i podatkowe warunki produkcji wymagają osobnego opracowania; opisane tu reguły są decyzjami koncepcyjnymi, nie interpretacją prawa.
