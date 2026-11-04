"use client";
import { useMemo, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AvailabilitySlot,
  Booking,
  Mentor,
  Review,
  Conversation,
} from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card, CardTitle } from "@devmentor/ui/components/card";
import { Badge, Feedback, LoadState, Pagination } from "./shared";
import {
  dateTime,
  money,
  useAction,
  useResource,
  usePaginatedResource,
} from "./api-client";
export function MentorProfile({ id }: { id: string }): JSX.Element {
  const router = useRouter();
  const mentor = useResource<Mentor>(`/mentors/${id}`);
  const dates = useMemo(() => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 30);
    return new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: "Europe/Warsaw",
    }).toString();
  }, []);
  const availability = useResource<AvailabilitySlot[]>(
    `/mentors/${id}/availability?${dates}`,
  );
  const reviews = usePaginatedResource<Review>(`/mentors/${id}/reviews`);
  const action = useAction();
  const [selected, setSelected] = useState("");
  const [hold, setHold] = useState<Booking | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"psp" | "credit">("psp");
  function reserve(): void {
    void action.run(async () => {
      const booking = await action.mutate<Booking>("/booking-holds", {
        mentorId: id,
        slotId: selected,
        durationMinutes: 50,
      });
      setHold(booking);
    }, "Termin jest wstępnie zarezerwowany. Sprawdź podsumowanie poniżej.");
  }
  function checkout(hold: Booking): void {
    void action.run(async () => {
      const booking = await action.mutate<Booking>("/checkout-sessions", {
        holdId: hold.id,
        paymentMode,
        acceptedPolicyVersion: hold.policyVersion,
      });
      window.location.assign(
        booking.checkoutUrl ??
          `/checkout?order=${encodeURIComponent(booking.id)}`,
      );
    }, "Przechodzimy do płatności.");
  }
  return (
    <LoadState {...mentor} retry={mentor.reload}>
      {mentor.data && (
        <div className="profile-grid">
          <div>
            <div className="profile-title">
              <span className="monogram" aria-hidden="true">
                {mentor.data.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div>
                <Badge>Profil po weryfikacji</Badge>
                <h1>{mentor.data.name}</h1>
                <p className="muted">{mentor.data.headline}</p>
              </div>
            </div>
            <Card>
              <CardTitle>Doświadczenie, którym się dzielę</CardTitle>
              <p className="prose-copy mt-5">{mentor.data.bio}</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <Badge>{mentor.data.specialty}</Badge>
                <Badge>{mentor.data.years} lat doświadczenia</Badge>
                <Badge>{mentor.data.languages.join(" / ")}</Badge>
              </div>
              <div className="actions">
                <Button
                  variant="outline"
                  disabled={action.busy}
                  onClick={() => {
                    void action.run(async () => {
                      const conversation = await action.mutate<Conversation>(
                        "/conversations",
                        { mentorId: id },
                      );
                      router.push(
                        `/dashboard?tab=messages&conversation=${conversation.id}`,
                      );
                    });
                  }}
                >
                  Napisz wiadomość
                </Button>
                <Button
                  variant="ghost"
                  disabled={action.busy}
                  onClick={() => {
                    void action.run(async () => {
                      await action.mutate(`/favorites/${id}`, {}, "PUT");
                    }, "Mentor dodany do ulubionych.");
                  }}
                >
                  Zapisz w ulubionych
                </Button>
              </div>
            </Card>
            <section className="mt-8">
              <h2 className="section-subtitle">Opinie po wspólnych sesjach</h2>
              <LoadState {...reviews} retry={reviews.retry}>
                {reviews.data?.length ? (
                  <div className="item-list">
                    {reviews.data.map((review) => (
                      <Card key={review.id}>
                        <p className="rating">
                          {"★".repeat(review.rating)}{" "}
                          <span className="muted">{review.rating}/5</span>
                        </p>
                        <p className="prose-copy mt-3">{review.comment}</p>
                        <p className="subtle mt-3">
                          {review.authorName} · {dateTime(review.createdAt)}
                        </p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="notice">
                    To początek historii tego mentora. Pierwsze opinie pojawią
                    się po zakończonych sesjach.
                  </p>
                )}
              </LoadState>
              <Pagination {...reviews} label="Opinie o mentorze" />
            </section>
          </div>
          <Card className="sticky top-6">
            <p className="eyebrow">50 MINUT TYLKO DLA CIEBIE</p>
            <p className="text-3xl font-semibold">
              {money(mentor.data.priceMinor, mentor.data.currency)}
            </p>
            <p className="subtle mt-2">
              Pojedyncza sesja online · bez automatycznego pakietu
            </p>
            <h2 className="section-subtitle mt-7">Wybierz dobry moment.</h2>
            <p className="subtle">
              Strefa: Europe/Warsaw. Zmiany co najmniej 24 godziny przed
              spotkaniem.
            </p>
            <LoadState {...availability} retry={availability.reload}>
              {availability.data?.filter((slot) => slot.available).length ? (
                <fieldset>
                  <legend className="sr-only">Dostępne terminy</legend>
                  <div className="slot-grid">
                    {availability.data
                      .filter((slot) => slot.available)
                      .map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          className="slot-button"
                          aria-pressed={selected === slot.id}
                          onClick={() => setSelected(slot.id)}
                        >
                          {dateTime(slot.startsAt, slot.timezone)}
                          <span className="block subtle">{slot.timezone}</span>
                        </button>
                      ))}
                  </div>
                </fieldset>
              ) : (
                <p className="notice">
                  Brak wolnych terminów w najbliższych 30 dniach. Napisz do
                  mentora, aby ustalić dostępność.
                </p>
              )}
            </LoadState>
            <Button
              className="w-full mt-5"
              disabled={!selected || action.busy}
              onClick={reserve}
            >
              Zarezerwuj wybrany termin
            </Button>
            <p className="subtle mt-3">
              Do rezerwacji potrzebujesz{" "}
              <Link className="text-link" href={`/auth?next=/mentors/${id}`}>
                zweryfikowanego konta
              </Link>
              .
            </p>
            {hold && (
              <section className="date-card">
                <h3 className="font-semibold">Sprawdź swoją sesję</h3>
                <p>
                  {dateTime(hold.startsAt, hold.timezone)} · {hold.timezone}
                </p>
                <p className="font-semibold mt-2">
                  {money(hold.amountMinor, hold.currency)}
                </p>
                <p className="subtle">
                  Termin zablokowany do{" "}
                  {dateTime(hold.expiresAt, hold.timezone)}.
                </p>
                <label className="field mt-4">
                  <span>Sposób płatności</span>
                  <select
                    className="select"
                    value={paymentMode}
                    onChange={(event) =>
                      setPaymentMode(
                        event.target.value === "credit" ? "credit" : "psp",
                      )
                    }
                  >
                    <option value="psp">Płatność za pojedynczą sesję</option>
                    <option value="credit">
                      Kredyt z pakietu u tego mentora
                    </option>
                  </select>
                </label>
                <label className="check-label mt-4">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  <span>
                    Akceptuję cenę i zasady anulowania co najmniej 24 godziny
                    wcześniej.
                  </span>
                </label>
                <Button
                  className="w-full mt-4"
                  onClick={() => checkout(hold)}
                  disabled={!accepted || action.busy}
                >
                  Przejdź do płatności
                </Button>
              </section>
            )}
            <Feedback {...action} />
          </Card>
        </div>
      )}
    </LoadState>
  );
}
