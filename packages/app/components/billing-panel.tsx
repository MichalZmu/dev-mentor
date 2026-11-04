"use client";
import type { FormEvent, JSX } from "react";
import Link from "next/link";
import type { Booking, Package } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card, CardTitle } from "@devmentor/ui/components/card";
import { Feedback, LoadState, Status, TextField } from "./shared";
import {
  dateTime,
  formText,
  money,
  useAction,
  useResource,
} from "./api-client";
interface Billing {
  orders: Booking[];
  packages: Package[];
}
export function BillingPanel(): JSX.Element {
  const billing = useResource<Billing>("/me/billing");
  const action = useAction();
  function buy(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      const pack = await action.mutate<Package>("/subscriptions", {
        mentorId: formText(form, "mentorId"),
        packageSize: 4,
        autoRenew: false,
      });
      window.location.assign(pack.checkoutUrl ?? `/checkout?order=${pack.id}`);
    }, "Pakiet oczekuje na opłacenie.");
  }
  return (
    <section>
      <h2 className="section-subtitle">Pełna kontrola nad współpracą.</h2>
      <LoadState {...billing} retry={billing.reload}>
        <div className="panel-grid">
          <Card>
            <CardTitle>Twoje pakiety</CardTitle>
            <p className="muted text-sm mt-2">
              Dobrowolne 4 sesje u jednego mentora. Automatyczne odnowienie
              pozostaje wyłączone.
            </p>
            {billing.data?.packages.length ? (
              <div className="item-list mt-5">
                {billing.data.packages.map((pack) => (
                  <article className="data-row" key={pack.id}>
                    <Status value={pack.state} />
                    <p className="font-semibold mt-2">
                      Pozostałe kredyty: {pack.credits}
                    </p>
                    <p className="subtle">
                      Ważność: {dateTime(pack.expiresAt)} ·{" "}
                      {money(pack.amountMinor, pack.currency)}
                    </p>
                    <p className="subtle">
                      Płatność: <Status value={pack.paymentState} />
                    </p>
                    <div className="actions">
                      {pack.paymentState === "pending" && (
                        <Button asChild variant="outline">
                          <Link href={`/checkout?order=${pack.id}`}>
                            Sprawdź płatność
                          </Link>
                        </Button>
                      )}
                      {(pack.state === "active" || pack.state === "paused") && (
                        <>
                          {[
                            pack.state === "active" ? "pause" : "resume",
                            "cancel",
                          ].map((name) => (
                            <Button
                              key={name}
                              variant="outline"
                              disabled={action.busy}
                              onClick={() => {
                                void action.run(async () => {
                                  await action.mutate(
                                    `/subscriptions/${pack.id}`,
                                    { action: name, version: pack.version },
                                    "PATCH",
                                  );
                                  billing.reload();
                                }, "Status pakietu zaktualizowany. Wcześniej opłacone sesje pozostają bez zmian.");
                              }}
                            >
                              {name === "pause"
                                ? "Wstrzymaj"
                                : name === "resume"
                                  ? "Wznów"
                                  : "Zrezygnuj z dalszego planu"}
                            </Button>
                          ))}
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="notice">
                Nie masz jeszcze pakietów. Po pierwszej odbytej sesji możesz
                wybrać dalszą współpracę.
              </p>
            )}
            <form onSubmit={buy} className="form-stack data-row">
              <h3 className="font-semibold">Chcesz pracować regularnie?</h3>
              <TextField
                label="Identyfikator mentora z odbytej sesji"
                name="mentorId"
              />
              <p className="subtle">
                Pakiet kosztuje 4 × aktualna cena sesji i jest ważny 90 dni.
                Cena i dostępność zostaną zweryfikowane przed płatnością.
              </p>
              <Button disabled={action.busy}>Wybierz pakiet 4 sesji</Button>
            </form>
          </Card>
          <Card>
            <CardTitle>Historia płatności</CardTitle>
            {billing.data?.orders.length ? (
              <div className="table-scroll mt-5">
                <table className="data-table">
                  <caption className="sr-only">
                    Twoje płatności za sesje
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Termin sesji</th>
                      <th scope="col">Kwota</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.data.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          {dateTime(order.startsAt)}
                          <Link
                            className="text-link block"
                            href={`/checkout?order=${order.id}`}
                          >
                            Szczegóły
                          </Link>
                        </td>
                        <td>{money(order.amountMinor, order.currency)}</td>
                        <td>
                          <Status value={order.paymentState} />
                          {order.refundState !== "none" && (
                            <p className="mt-2">
                              Zwrot: <Status value={order.refundState} />
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="notice">
                Twoje płatności pojawią się tutaj po pierwszej rezerwacji.
              </p>
            )}
          </Card>
        </div>
      </LoadState>
      <Feedback {...action} />
    </section>
  );
}
