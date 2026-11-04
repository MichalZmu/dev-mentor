"use client";
import { useMemo, useState } from "react";
import type { FormEvent, JSX } from "react";
import Link from "next/link";
import type { AvailabilitySlot, Booking, UserProfile } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card } from "@devmentor/ui/components/card";
import { Textarea } from "@devmentor/ui/components/textarea";
import { Feedback, Field, LoadState, Pagination, Status } from "./shared";
import {
  dateTime,
  formText,
  money,
  useAction,
  useResource,
  usePaginatedResource,
} from "./api-client";
export function SessionsPanel({ user }: { user: UserProfile }): JSX.Element {
  const sessions = usePaginatedResource<Booking>("/me/sessions", user.id);
  const [filter, setFilter] = useState("all");
  const rows =
    sessions.data?.filter(
      (item) => filter === "all" || item.state === filter,
    ) ?? [];
  return (
    <section>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
        <h2 className="section-subtitle mb-0">Twoje sesje</h2>
        <select
          className="select max-w-60"
          aria-label="Filtruj sesje"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Wszystkie</option>
          <option value="confirmed">Nadchodzące</option>
          <option value="held">W trakcie rezerwacji</option>
          <option value="completed">Zakończone</option>
          <option value="cancelled">Anulowane</option>
        </select>
      </div>
      <LoadState {...sessions} retry={sessions.retry}>
        {rows.length ? (
          <div className="item-list">
            {rows.map((booking) => (
              <SessionCard
                booking={booking}
                user={user}
                reload={sessions.reload}
                key={booking.id}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3 className="section-subtitle">Czas na pierwszy wspólny krok.</h3>
            <p>Twoje spotkania pojawią się tutaj po rezerwacji.</p>
            <Button asChild className="mt-5">
              <Link href="/mentors">Znajdź mentora</Link>
            </Button>
          </div>
        )}
      </LoadState>
      <Pagination {...sessions} label="Sesje" />
    </section>
  );
}
function SessionCard({
  booking,
  user,
  reload,
}: {
  booking: Booking;
  user: UserProfile;
  reload: () => void;
}): JSX.Element {
  const action = useAction();
  const [details, setDetails] = useState(false);
  const notes = useResource<{ note: string }>(
    details ? `/sessions/${booking.id}/notes` : null,
  );
  const range = useMemo(() => {
    const now = new Date();
    return new URLSearchParams({
      from: now.toISOString(),
      to: new Date(now.getTime() + 30 * 86400000).toISOString(),
    }).toString();
  }, []);
  const slots = useResource<AvailabilitySlot[]>(
    details ? `/mentors/${booking.mentorId}/availability?${range}` : null,
  );
  function cancel(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(`/sessions/${booking.id}/cancel`, {
        reason: formText(form, "reason"),
        version: booking.version,
      });
      reload();
    }, "Sesja anulowana. Status zwrotu znajdziesz w jej szczegółach.");
  }
  function reschedule(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(`/sessions/${booking.id}/reschedule`, {
        slotId: formText(form, "slotId"),
        version: booking.version,
      });
      reload();
    }, "Termin sesji został zmieniony.");
  }
  function saveNote(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(
        `/sessions/${booking.id}/notes`,
        { note: formText(form, "note"), version: booking.version },
        "PUT",
      );
      notes.reload();
    }, "Prywatna notatka zapisana.");
  }
  function review(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(`/sessions/${booking.id}/reviews`, {
        rating: Number(formText(form, "rating")),
        comment: formText(form, "comment"),
      });
    }, "Dziękujemy. Twoja opinia jest zapisana.");
  }
  return (
    <Card>
      <div className="flex justify-between gap-3 flex-wrap">
        <div>
          <p className="subtle">Sesja 50 minut · {booking.timezone}</p>
          <h3 className="text-xl font-semibold">
            {dateTime(booking.startsAt, booking.timezone)}
          </h3>
          <Link className="text-link" href={`/mentors/${booking.mentorId}`}>
            Profil mentora
          </Link>
        </div>
        <div className="text-right">
          <Status value={booking.state} />
          <p className="mt-2 font-semibold">
            {money(booking.amountMinor, booking.currency)}
          </p>
        </div>
      </div>
      <p className="subtle mt-3">
        Płatność: <Status value={booking.paymentState} />
        {booking.refundState !== "none" && (
          <>
            {" "}
            · Zwrot: <Status value={booking.refundState} />
          </>
        )}
      </p>
      <div className="actions">
        {booking.state === "held" && (
          <Button asChild>
            <Link href={`/checkout?order=${booking.id}`}>Sprawdź płatność</Link>
          </Button>
        )}
        {booking.state === "confirmed" && (
          <>
            <Button
              disabled={action.busy}
              onClick={() => {
                void action.run(async () => {
                  const room = await action.mutate<{ roomUrl: string }>(
                    `/sessions/${booking.id}/join`,
                    {},
                  );
                  window.location.assign(room.roomUrl);
                });
              }}
            >
              Dołącz do spotkania
            </Button>
            <a
              className="text-link"
              href={`/api/v1/sessions/${booking.id}/calendar`}
            >
              Kalendarz .ics
            </a>
          </>
        )}
        <Button
          variant="outline"
          aria-expanded={details}
          onClick={() => setDetails(!details)}
        >
          {details ? "Zwiń szczegóły" : "Szczegóły i zarządzanie"}
        </Button>
      </div>
      {details && (
        <div className="mt-6">
          <p className="subtle">
            Numer sesji: {booking.id}. Przełożenie i anulowanie są dostępne co
            najmniej 24 godziny wcześniej. W późniejszym terminie skontaktuj się
            z pomocą.
          </p>
          {booking.state === "confirmed" && (
            <div className="panel-grid mt-5">
              <details className="rounded-xl border p-4">
                <summary className="font-semibold">Zmień termin</summary>
                <form className="form-stack mt-4" onSubmit={reschedule}>
                  <Field label="Nowy termin">
                    <select name="slotId" className="select" required>
                      <option value="">Wybierz termin</option>
                      {slots.data
                        ?.filter((slot) => slot.available)
                        .map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {dateTime(slot.startsAt, slot.timezone)} ·{" "}
                            {slot.timezone}
                          </option>
                        ))}
                    </select>
                  </Field>
                  {slots.error && <p role="alert">{slots.error}</p>}
                  <Button
                    disabled={
                      action.busy || !slots.data?.some((slot) => slot.available)
                    }
                  >
                    Potwierdź nowy termin
                  </Button>
                </form>
              </details>
              <details className="rounded-xl border p-4">
                <summary className="font-semibold">Anuluj sesję</summary>
                <form className="form-stack mt-4" onSubmit={cancel}>
                  <p className="text-sm">
                    Pojedyncza płatność zostanie skierowana do zwrotu. Jeśli
                    użyto kredytu, wróci on do pakietu.
                  </p>
                  <Field label="Powód anulowania (10–500 znaków)">
                    <Textarea
                      name="reason"
                      minLength={10}
                      maxLength={500}
                      required
                    />
                  </Field>
                  <Button variant="destructive" disabled={action.busy}>
                    Potwierdzam anulowanie sesji
                  </Button>
                </form>
              </details>
            </div>
          )}
          <section className="data-row">
            <h4 className="font-semibold mb-3">Twoja prywatna notatka</h4>
            <p className="subtle mb-4">
              Ta treść jest widoczna wyłącznie dla Ciebie. Nie jest publiczną
              opinią.
            </p>
            <LoadState {...notes} retry={notes.reload}>
              <form className="form-stack" onSubmit={saveNote}>
                <Field label="Wnioski z rozmowy (do 2000 znaków)">
                  <Textarea
                    name="note"
                    maxLength={2000}
                    defaultValue={notes.data?.note ?? ""}
                  />
                </Field>
                <Button
                  className="w-fit"
                  variant="outline"
                  disabled={action.busy}
                >
                  Zapisz notatkę
                </Button>
              </form>
            </LoadState>
          </section>
          {booking.state === "completed" && booking.menteeId === user.id && (
            <form className="form-stack data-row" onSubmit={review}>
              <h4 className="font-semibold">Jak oceniasz wspólną sesję?</h4>
              <Field label="Ocena">
                <select name="rating" className="select" required>
                  <option value="">Wybierz ocenę</option>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option value={rating} key={rating}>
                      {rating} / 5
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Twoja publiczna opinia (10–1000 znaków)">
                <Textarea
                  name="comment"
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </Field>
              <Button disabled={action.busy}>Opublikuj opinię</Button>
            </form>
          )}
          {booking.state === "confirmed" &&
            booking.mentorUserId === user.id && (
              <Button
                className="mt-5"
                variant="outline"
                disabled={action.busy}
                onClick={() => {
                  void action.run(async () => {
                    await action.mutate(`/sessions/${booking.id}/complete`, {});
                    reload();
                  }, "Odnotowano zakończenie sesji.");
                }}
              >
                Oznacz odbytą sesję
              </Button>
            )}
          <a
            className="text-link block mt-5"
            href={`/api/v1/orders/${booking.id}/receipt`}
          >
            Dokument płatności
          </a>
        </div>
      )}
      <Feedback {...action} />
    </Card>
  );
}
