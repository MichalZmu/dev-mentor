"use client";
import type { FormEvent, JSX } from "react";
import Link from "next/link";
import type { Booking } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card, CardTitle } from "@devmentor/ui/components/card";
import { Textarea } from "@devmentor/ui/components/textarea";
import { Feedback, Field, LoadState } from "./shared";
import { dateTime, formText, useAction, useResource } from "./api-client";
export function SessionRoom({ id }: { id: string }): JSX.Element {
  const session = useResource<Booking>(`/sessions/${id}`);
  const notes = useResource<{ note: string }>(`/sessions/${id}/notes`);
  const action = useAction();
  function save(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(
        `/sessions/${id}/notes`,
        { note: formText(form, "note") },
        "PUT",
      );
      notes.reload();
    }, "Twoja prywatna notatka została zapisana.");
  }
  return (
    <LoadState {...session} retry={session.reload}>
      {session.data && (
        <div className="panel-grid">
          <Card>
            <p className="eyebrow">PRZESTRZEŃ SPOTKANIA</p>
            <CardTitle>Skupmy się na Twoim celu.</CardTitle>
            <p className="date-card">
              {dateTime(session.data.startsAt, session.data.timezone)} ·{" "}
              {session.data.timezone}
            </p>
            <p className="notice">
              <strong>Pokój demonstracyjny</strong>
              <br />
              Ta lokalna wersja nie transmituje dźwięku ani obrazu i nie prosi o
              dostęp do urządzeń. Rzeczywisty link do spotkania wymaga
              skonfigurowanego dostawcy wideorozmów.
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard?tab=sessions">Wróć do swoich sesji</Link>
            </Button>
          </Card>
          <Card>
            <CardTitle>Twoje prywatne wnioski</CardTitle>
            <LoadState {...notes} retry={notes.reload}>
              <form className="form-stack mt-5" onSubmit={save}>
                <Field label="Notatka z sesji (do 2000 znaków)">
                  <Textarea
                    name="note"
                    maxLength={2000}
                    defaultValue={notes.data?.note ?? ""}
                  />
                </Field>
                <Feedback {...action} />
                <Button disabled={action.busy}>Zapisz notatkę</Button>
              </form>
            </LoadState>
          </Card>
        </div>
      )}
    </LoadState>
  );
}
