# Katalog ekranów

Każdy ekran ma odpowiednik w prototypie. Toolbar „Stan ekranu” pozwala wyświetlić loading, empty, error i success. Przełącznik służy prezentacji; scenariusze biznesowe mają także własne walidacje. API to projekt kontraktu, nie połączenia wykonywane przez makietę. Wszystkie ścieżki API mają prefiks `/api/v1`.

## S01 · Strona główna

- Trasa makiety: `#home`; rola: Gość.
- Cel: Zrozumieć wartość mentoringu i rozpocząć wybór.
- Funkcje: Przejście do katalogu, wyjaśnienie modelu, zgłoszenie mentora.
- Komponenty UI: Header, hero, ścieżki rozwoju, karta polecanego mentora, sekcja jak działa.
- Loading: Szkielet polecanego profilu.
- Empty: Brak polecanych: pokaż katalog i opis procesu.
- Error: Nie udało się pobrać rekomendacji; ponów.
- Success: Rekomendacje gotowe; przejście do katalogu.
- Walidacje: Brak formularzy; linki muszą mieć dostępne etykiety.
- API: `GET /mentors?featured=true`

## S02 · Znajdź mentora

- Trasa makiety: `#discover`; rola: Gość / mentee.
- Cel: Zawęzić listę do mentorów pasujących do celu i budżetu.
- Funkcje: Wyszukiwanie, filtry specjalizacji/ceny/języka, sortowanie, ulubione, profil.
- Komponenty UI: Pole wyszukiwania, filtry, licznik, siatka kart, reset filtrów.
- Loading: Szkielety kart; zachowanie filtrów.
- Empty: Zero wyników: usuń filtry lub zmień frazę.
- Error: Błąd katalogu; ponów bez kasowania filtrów.
- Success: Lista i licznik zgodne z filtrami.
- Walidacje: Fraza do 100 znaków; cena 0–500 PLN; allowlista sortowania.
- API: `GET /mentors`; `PUT /favorites/{mentorId}`; `DELETE /favorites/{mentorId}`

## S03 · Profil mentora

- Trasa makiety: `#profile`; rola: Gość / mentee.
- Cel: Ocenić dopasowanie i wybrać kontakt lub rezerwację.
- Funkcje: Bio, specjalizacje, opinie, dostępność, cena, zapis ulubionego, wiadomość.
- Komponenty UI: Profil, monogram demonstracyjny, badge weryfikacji, recenzje, sticky karta rezerwacji.
- Loading: Szkielet bio i kalendarza.
- Empty: Brak opinii: nowy mentor; brak terminów: napisz wiadomość.
- Error: 404 mentor niedostępny; powrót do katalogu.
- Success: Profil i dostępne terminy widoczne.
- Walidacje: mentorId musi istnieć i być opublikowany; prywatny profil zwraca 404.
- API: `GET /mentors/{id}`; `GET /mentors/{id}/availability`; `GET /mentors/{id}/reviews`

## S04 · Logowanie i rejestracja

- Trasa makiety: `#auth`; rola: Gość.
- Cel: Uzyskać konto bez utraty wybranego mentora i terminu.
- Funkcje: Tryb logowania/rejestracji, powrót do rezerwacji, reset hasła.
- Komponenty UI: Formularz email/hasło, przełącznik trybu, zgoda regulaminowa przy rejestracji, demo.
- Loading: Przycisk zablokowany podczas żądania.
- Empty: Nowy użytkownik: rejestracja.
- Error: Ogólny błąd danych logowania; 429 z czasem ponowienia.
- Success: Sesja utworzona; powrót do zapamiętanej ścieżki.
- Walidacje: Email poprawny; rejestracja: hasło min. 12 znaków; akceptacja regulaminu; produkcja: weryfikacja email.
- API: `POST /auth/register`; `POST /auth/login`; `GET /me`

## S05 · Odzyskanie dostępu

- Trasa makiety: `#reset`; rola: Gość.
- Cel: Bezpiecznie rozpocząć reset hasła.
- Funkcje: Podanie email, potwierdzenie wysłania, powrót do logowania.
- Komponenty UI: Input email, neutralny komunikat, CTA.
- Loading: Trwa wysyłanie żądania.
- Empty: Pusty email: podaj adres.
- Error: Błąd sieci/limit; ponów.
- Success: Jeśli konto istnieje, wysłano instrukcję — identyczny komunikat dla wszystkich.
- Walidacje: Email poprawny; token resetu jednorazowy, TTL 30 min; ekran nowego hasła w produkcji poza makietą.
- API: `POST /auth/password-reset`

## S06 · Twój cel

- Trasa makiety: `#goals`; rola: Mentee.
- Cel: Sprecyzować oczekiwania do dopasowania i pierwszej sesji.
- Funkcje: Wybór celu, poziomu, opis potrzeby, zapis.
- Komponenty UI: Karty wyboru, select poziomu, textarea, CTA.
- Loading: Trwa zapis celu.
- Empty: Nie wybrano celu: wskaż kierunek.
- Error: Nie zapisano; pozostaw dane formularza.
- Success: Cel zapisany i widoczny w planie.
- Walidacje: Cel wymagany; opis 20–500 znaków; poziom z allowlisty.
- API: `PUT /me/goals`; `GET /me/goals`

## S07 · Wybór terminu

- Trasa makiety: `#booking`; rola: Mentee.
- Cel: Zarezerwować 50-minutową sesję w jawnej strefie czasowej.
- Funkcje: Dzień/godzina, informacja o anulowaniu, zmiana terminu istniejącej sesji.
- Komponenty UI: Lista dni, grid slotów, timezone, podsumowanie mentora i ceny.
- Loading: Pobieranie dostępnych slotów.
- Empty: Brak terminów: inny dzień lub kontakt.
- Error: 409 SLOT_TAKEN: wybierz inny slot.
- Success: Slot wybrany; przejście do płatności lub zapis przełożenia.
- Walidacje: Slot przyszły; min. 24 h wyprzedzenia; strefa IANA; niedostępny slot disabled.
- API: `GET /mentors/{id}/availability`; `POST /booking-holds`; `POST /sessions/{id}/reschedule`

## S08 · Podsumowanie i płatność

- Trasa makiety: `#checkout`; rola: Mentee.
- Cel: Sprawdzić koszt i potwierdzić sesję bez niejasnych zobowiązań.
- Funkcje: Podsumowanie, wybór wyniku płatności demo, akceptacja zasad, ponowienie po błędzie.
- Komponenty UI: Karta zamówienia, cena brutto, checkbox, przycisk płatności demo.
- Loading: Przetwarzanie; blokada duplikatu.
- Empty: Brak slotu/hold wygasł: wróć do terminarza.
- Error: Odrzucono płatność: nie twórz sesji, ponów lub zmień metodę u PSP.
- Success: Opłacono i potwierdzono sesję.
- Walidacje: Akceptacja zasad wymagana; cena z serwera; hold 10 min; nie zbierać numerów kart w portalu.
- API: `POST /checkout-sessions`; `GET /orders/{id}`; `POST /webhooks/payments`

## S09 · Rezerwacja potwierdzona

- Trasa makiety: `#confirmation`; rola: Mentee.
- Cel: Mieć pewność rezerwacji i wiedzieć co dalej.
- Funkcje: Szczegóły, pobranie ICS, przejście do sesji i wiadomości.
- Komponenty UI: Success badge, numer sesji, data/strefa, CTA, plik kalendarza.
- Loading: Oczekiwanie na potwierdzenie płatności.
- Empty: Brak zamówienia: lista sesji.
- Error: Płatność w toku: sprawdź status; nie płać ponownie.
- Success: Termin zapisany, kalendarz można pobrać.
- Walidacje: Dostęp wyłącznie właściciela; potwierdzenie tylko po webhooku PSP.
- API: `GET /orders/{id}`; `GET /sessions/{id}/calendar`

## S10 · Pulpit uczestnika

- Trasa makiety: `#dashboard`; rola: Mentee.
- Cel: Wiedzieć, jaki jest następny krok rozwoju.
- Funkcje: Najbliższa sesja, postęp celu, skróty do planu, wiadomości i katalogu.
- Komponenty UI: KPI, karta sesji, checklista, rekomendacje.
- Loading: Szkielety KPI i sesji.
- Empty: Brak rezerwacji: znajdź pierwszego mentora.
- Error: Błąd panelu: ponów; inne sekcje nadal dostępne.
- Success: Następne działania wyświetlone.
- Walidacje: Wyłącznie własne dane; procent postępu 0–100.
- API: `GET /me/dashboard`

## S11 · Moje sesje

- Trasa makiety: `#sessions`; rola: Mentee / mentor.
- Cel: Zarządzać spotkaniami i historią.
- Funkcje: Przyszłe/zakończone/anulowane, przełożenie, anulowanie z potwierdzeniem, wejście do pokoju.
- Komponenty UI: Filtry statusu, karty dat, dialog anulowania z kosztem, przyciski.
- Loading: Szkielety sesji.
- Empty: Brak sesji w filtrze: przejdź do katalogu.
- Error: Nie udało się zmienić sesji; zachowaj poprzedni termin.
- Success: Nowy termin albo anulowanie z informacją o zwrocie.
- Walidacje: Zmiany min. 24 h przed; później kontakt do supportu; anulowanie wymaga powodu; brak podwójnego zwrotu.
- API: `GET /me/sessions`; `POST /sessions/{id}/cancel`; `POST /sessions/{id}/reschedule`

## S12 · Pokój sesji

- Trasa makiety: `#room`; rola: Mentee / mentor.
- Cel: Przeprowadzić spotkanie i zapisać wnioski.
- Funkcje: Lobby, test urządzeń w produkcji, dołączenie, kamera/mikrofon demo, notatka, zakończenie.
- Komponenty UI: Scena rozmowy demo, status połączenia, pasek narzędzi, notatki.
- Loading: Łączenie z pokojem.
- Empty: Mentor jeszcze nie dołączył: lobby i wiadomości.
- Error: Brak połączenia/urządzeń: ponów lub zgłoś problem.
- Success: Sesja zakończona; przejście do podsumowania.
- Walidacje: Tylko uczestnicy; token pokoju krótko ważny; produkcja wejście od 10 min przed; notatka do 2000 znaków.
- API: `POST /sessions/{id}/join`; `PUT /sessions/{id}/notes`; `POST /sessions/{id}/complete`

## S13 · Podsumowanie i opinia

- Trasa makiety: `#review`; rola: Mentee.
- Cel: Utrwalić wnioski i ocenić odbytą sesję.
- Funkcje: Ocena 1–5, komentarz, zapis opinii, przejście do planu.
- Komponenty UI: Gwiazdy jako radio, textarea, karta kolejnych kroków.
- Loading: Zapisywanie opinii.
- Empty: Brak oceny: wybierz gwiazdki.
- Error: Opinia już istnieje lub sesja nieodbyta; link do supportu.
- Success: Opinia zapisana; plan gotowy do dalszej pracy.
- Walidacje: Jedna opinia na zakończoną sesję; ocena 1–5; komentarz 10–1000 znaków.
- API: `POST /sessions/{id}/reviews`

## S14 · Wiadomości

- Trasa makiety: `#messages`; rola: Mentee / mentor.
- Cel: Uzgodnić oczekiwania i sprawy organizacyjne.
- Funkcje: Wybór rozmowy, wysłanie tekstu, status dostarczenia, zgłoszenie do supportu.
- Komponenty UI: Lista wątków, bąbelki, input, status, CTA rezerwacji.
- Loading: Szkielety wątków.
- Empty: Brak wiadomości: rozpocznij rozmowę z profilu.
- Error: Nie wysłano; zachowaj szkic i ponów.
- Success: Wiadomość widoczna ze statusem wysłano (demo).
- Walidacje: Tekst 1–2000 znaków po trim; bez wykonywania HTML; rate limit; tylko uczestnicy wątku.
- API: `GET /conversations`; `POST /conversations`; `GET /conversations/{id}/messages`; `POST /conversations/{id}/messages`

## S15 · Plan rozwoju

- Trasa makiety: `#plan`; rola: Mentee / mentor.
- Cel: Mierzyć postęp między sesjami.
- Funkcje: Cel, kamienie milowe, odhaczanie kroków, rekomendowana następna sesja.
- Komponenty UI: Progress, zadania checkbox, karta celu, CTA rezerwacji.
- Loading: Szkielet celu i listy.
- Empty: Brak celu: uzupełnij onboarding.
- Error: Nie zapisano kroku: przywróć poprzedni stan.
- Success: Postęp zaktualizowany.
- Walidacje: Tylko mentee i przypisany mentor; wersja rekordu chroni przed nadpisaniem.
- API: `GET /me/learning-plan`; `PATCH /learning-plans/{id}/milestones/{milestoneId}`

## S16 · Płatności i współpraca

- Trasa makiety: `#billing`; rola: Mentee.
- Cel: Kontrolować wydatki i dobrowolne odnowienie planu.
- Funkcje: Historia, zakup pakietu 4 sesji, jawne auto-odnowienie, pauza/wznowienie/rezygnacja, dokument demo.
- Komponenty UI: Karty planów, status, data odnowienia, tabela transakcji, dialog potwierdzenia.
- Loading: Ładowanie historii rozliczeń.
- Empty: Brak płatności: pierwsza rezerwacja.
- Error: Płatność/zmiana planu nieudana: zachowaj aktywny plan.
- Success: Pakiet aktywny albo odnowienie wyłączone; wykorzystane sesje zachowane.
- Walidacje: Pakiet dopiero po odbytej pierwszej sesji; cena 4 × stawka; odnowienie tylko z osobną zgodą; saldo nieujemne.
- API: `GET /me/billing`; `POST /subscriptions`; `PATCH /subscriptions/{id}`; `GET /orders/{id}/receipt`

## S17 · Ustawienia konta

- Trasa makiety: `#settings`; rola: Mentee / mentor.
- Cel: Utrzymać aktualne dane i preferencje.
- Funkcje: Imię, email, strefa, powiadomienia organizacyjne, zapis, wylogowanie.
- Komponenty UI: Formularz, select timezone, checkbox, alert zapisania.
- Loading: Wczytywanie ustawień.
- Empty: Niepełny profil: uzupełnij dane.
- Error: Konflikt email lub błąd zapisu.
- Success: Ustawienia zapisane; nowe daty w wybranej strefie.
- Walidacje: Imię 2–80; email poprawny, zmiana wymaga weryfikacji; timezone IANA; walidacja po stronie serwera.
- API: `GET /me`; `PATCH /me`; `POST /auth/logout`

## S18 · Pomoc i zgłoszenia

- Trasa makiety: `#support`; rola: Każda rola.
- Cel: Uzyskać pomoc i rozwiązać problem z sesją lub płatnością.
- Funkcje: FAQ, kategoria, opis, numer sesji opcjonalnie, wysłanie zgłoszenia.
- Komponenty UI: Akordeony, formularz, potwierdzenie z numerem.
- Loading: Wysyłanie zgłoszenia.
- Empty: Brak zgłoszeń: formularz i FAQ.
- Error: Nie wysłano; zachowaj opis, ponów.
- Success: Zgłoszenie utworzone z numerem i statusem otwarte.
- Walidacje: Kategoria wymagana; opis 20–2000; email wymagany u gościa; sessionId musi należeć do zgłaszającego.
- API: `POST /support-tickets`; `GET /me/support-tickets`

## S19 · Zostań mentorem

- Trasa makiety: `#mentor-apply`; rola: Kandydat.
- Cel: Przekazać kompletną aplikację do weryfikacji.
- Funkcje: Bio, specjalizacja, doświadczenie, cena, akceptacja zasad, wysłanie.
- Komponenty UI: Formularz, kroki procesu, podgląd profilu.
- Loading: Zapisywanie aplikacji.
- Empty: Brak aplikacji: wypełnij formularz.
- Error: Brak danych albo aktywna aplikacja już istnieje.
- Success: Aplikacja oczekuje na moderację; profil nie jest publiczny.
- Walidacje: Bio 50–1000; doświadczenie 1–40 lat; cena 50–500 PLN; jedna otwarta aplikacja.
- API: `POST /mentor-applications`; `GET /me/mentor-application`

## S20 · Pulpit mentora

- Trasa makiety: `#mentor-dashboard`; rola: Mentor.
- Cel: Prowadzić sesje i monitorować praktykę.
- Funkcje: Status aplikacji, sesje, podsumowanie zarobków, skróty dostępności i profilu.
- Komponenty UI: KPI, status weryfikacji, lista sesji, powiadomienia.
- Loading: Szkielety statystyk.
- Empty: Brak mentees: ustaw dostępność.
- Error: Statystyki niedostępne: ponów.
- Success: Najbliższe zadania i status publikacji widoczne.
- Walidacje: Tylko własne statystyki; kandydat widzi status, nie zarobki.
- API: `GET /mentor/dashboard`

## S21 · Dostępność mentora

- Trasa makiety: `#availability`; rola: Mentor.
- Cel: Udostępnić terminy bez konfliktów.
- Funkcje: Wybór dni i godzin, usunięcie wolnego slotu, zapis terminarza.
- Komponenty UI: Tygodniowa siatka toggle, timezone, legenda, przycisk zapisu.
- Loading: Wczytywanie harmonogramu.
- Empty: Brak slotów: zaznacz pierwsze.
- Error: 409: termin jest już zarezerwowany; pokaż konflikt.
- Success: Dostępność opublikowana i widoczna w katalogu.
- Walidacje: Przyszłe sloty, brak nakładania; rezerwacje zablokowane przed usunięciem; UTC w API.
- API: `GET /mentor/availability`; `PUT /mentor/availability`

## S22 · Edycja profilu mentora

- Trasa makiety: `#mentor-profile`; rola: Mentor.
- Cel: Utrzymać wiarygodną publiczną ofertę.
- Funkcje: Edycja bio, nagłówka, specjalizacji, ceny; podgląd i zapis.
- Komponenty UI: Formularz, karta podglądu, badge statusu publikacji.
- Loading: Wczytywanie profilu.
- Empty: Nieuzupełniony profil: wskazanie braków.
- Error: Walidacja lub błąd zapisu.
- Success: Zmiany zapisane; istotne zmiany mogą wymagać moderacji.
- Walidacje: Nagłówek 10–100; bio 50–1000; cena 50–500; stare rezerwacje zachowują cenę.
- API: `GET /mentor/profile`; `PATCH /mentor/profile`

## S23 · Zarobki mentora

- Trasa makiety: `#earnings`; rola: Mentor.
- Cel: Rozumieć saldo i zlecić wypłatę.
- Funkcje: Historia, podział brutto/prowizja/netto, zlecenie wypłaty demo.
- Komponenty UI: KPI, tabela rozliczeń, dialog wypłaty i status.
- Loading: Wczytywanie salda.
- Empty: Brak rozliczonych sesji: saldo 0 PLN.
- Error: Wypłata zablokowana: brak salda albo weryfikacji.
- Success: Wypłata zlecona; saldo dostępne pomniejszone.
- Walidacje: Tylko środki rozliczone; kwota >0; KYC u PSP; idempotencja; prowizja propozycja 15%.
- API: `GET /mentor/earnings`; `POST /mentor/payouts`

## S24 · Panel operacyjny

- Trasa makiety: `#admin`; rola: Administrator / support.
- Cel: Zobaczyć kolejki wymagające działania.
- Funkcje: KPI operacyjne, aplikacje mentorów, zgłoszenia, przejście do sprawy.
- Komponenty UI: Sidebar, KPI, tabela, badge statusów i priorytetów.
- Loading: Szkielety kolejek.
- Empty: Brak otwartych spraw: wszystko obsłużone.
- Error: 403 brak uprawnień lub błąd kolejki.
- Success: Kolejka zaktualizowana po decyzji.
- Walidacje: RBAC; support bez decyzji publikacji i wypłat; brak sekretów płatniczych w UI.
- API: `GET /admin/overview`; `GET /admin/mentor-applications`; `GET /admin/support-tickets`

## S25 · Rozpatrzenie sprawy

- Trasa makiety: `#moderation`; rola: Administrator / support.
- Cel: Podjąć uzasadnioną i audytowalną decyzję.
- Funkcje: Weryfikacja mentora: zatwierdź/odrzuć; zgłoszenie: odpowiedź/status rozwiązane.
- Komponenty UI: Szczegóły sprawy, checklista, uzasadnienie, akcje, dziennik decyzji.
- Loading: Wczytywanie sprawy.
- Empty: Sprawa już zamknięta: pokaż wynik.
- Error: 409 zmieniona przez inną osobę; odśwież; 403 brak roli.
- Success: Decyzja zapisana; mentor opublikowany lub zgłoszenie rozwiązane.
- Walidacje: Uzasadnienie min. 10 znaków; decyzja z allowlisty; wersja rekordu; audit log; zwroty wymagają odrębnych uprawnień.
- API: `GET /admin/cases/{id}`; `POST /admin/cases/{id}/decision`
