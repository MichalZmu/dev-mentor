# Dzienniki zadań AI

Jeden plik na zadanie: `YYYY-MM-DD-slug.md`. Utwórz go przy przygotowaniu pierwszego commita, używając daty rozpoczęcia zadania. Kolejne sesje i dni pracy kontynuują ten sam plik. Przy wznowieniu lub przejęciu zadania najpierw przeczytaj istniejący dziennik.

Poniższy wzór uzupełnij rzeczywistymi danymi. Nagłówek (tytuł, cele, specyfikacja, status) pozostaje na początku pliku i jest aktualizowany w miejscu. Tylko ukończone i zweryfikowane zadanie otrzymuje status `done`. Gdy specyfikacja nie istnieje, wpisz `Specyfikacja: brak`.

```markdown
# Nazwa zadania

Cele:
- Konkretny cel zadania i oczekiwany rezultat.

Specyfikacja: [Nazwa specyfikacji](../specs/YYYY-MM-DD-slug.md)
Status: in-progress

## Wpisy

### YYYY-MM-DD — krótki opis commita
Zakres: zmiany zawarte w tym commicie; wynik weryfikacji, jeśli dotyczy.
Decyzje / pułapki: istotne ustalenie, napotkany problem albo „brak”.
Do zrobienia: konkretne dalsze kroki albo „brak — zadanie ukończone”.
```

Każdy wpis ma 2–5 linii (wzór ma cztery), zawiera datę, zakres commita, decyzje lub pułapki i pozostałą pracę. Przygotuj go przed każdym commitem i dołącz do tego samego commita co opisywane zmiany. Kolejne wpisy dopisuj na końcu pliku; nie edytuj wcześniejszych. Korekty zapisuj nowym wpisem. Po przeniesieniu specyfikacji popraw jej link w nagłówku.

Obowiązujące zasady pracy znajdują się w `../../AGENTS.md` i `../../CLAUDE.md`.
