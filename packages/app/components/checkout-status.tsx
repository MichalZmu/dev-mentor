"use client";
import { useEffect } from "react";
import type { JSX } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Booking } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card } from "@devmentor/ui/components/card";
import { Feedback, LoadState, Status } from "./shared";
import { dateTime, money, useAction, useResource } from "./api-client";
interface Order extends Partial<Omit<Booking, "state">> {
  id: string;
  state: string;
  paymentState: "pending" | "paid" | "failed";
  amountMinor: string;
  currency: string;
  credits?: number;
}
export function CheckoutStatus(): JSX.Element {
  const params = useSearchParams();
  const id = params.get("order");
  const order = useResource<Order>(
    id ? `/orders/${encodeURIComponent(id)}` : null,
  );
  const mode = useResource<{ mode: string }>("/config");
  const action = useAction();
  useEffect(() => {
    if (!id || order.data?.paymentState === "paid") return;
    const timer = setInterval(order.reload, 5000);
    return () => clearInterval(timer);
  }, [id, order.data?.paymentState, order.reload]);
  if (!id)
    return (
      <p className="notice">
        Brakuje numeru zamówienia.{" "}
        <Link className="text-link" href="/dashboard">
          Przejdź do swoich sesji
        </Link>
        .
      </p>
    );
  return (
    <LoadState {...order} retry={order.reload}>
      {order.data && (
        <Card className="auth-wrap">
          <p className="eyebrow">TWOJA REZERWACJA</p>
          <h1 className="text-3xl font-semibold mb-5">
            {order.data.paymentState === "paid"
              ? order.data.state === "confirmed"
                ? "Do zobaczenia na sesji."
                : "Płatność przyjęta."
              : "Sprawdzamy status płatności."}
          </h1>
          <Status value={order.data.state} />
          <div className="date-card">
            <p className="font-semibold">
              {money(order.data.amountMinor, order.data.currency)}
            </p>
            {order.data.startsAt && (
              <p>
                {dateTime(order.data.startsAt, order.data.timezone)} ·{" "}
                {order.data.timezone}
              </p>
            )}
            <p className="subtle">Numer: {order.data.id}</p>
          </div>
          <p>
            Status płatności: <Status value={order.data.paymentState} />
          </p>
          {order.data.refundState && order.data.refundState !== "none" && (
            <p className="mt-3">
              Zwrot: <Status value={order.data.refundState} />
            </p>
          )}
          {order.data.paymentState !== "paid" && (
            <p className="notice">
              Powrót z płatności nie jest jeszcze potwierdzeniem rezerwacji.
              Status odświeżamy automatycznie. Nie płać ponownie.
            </p>
          )}
          {mode.data?.mode === "demo" && order.data.paymentState !== "paid" && (
            <div className="notice">
              <p>
                <strong>Tryb demonstracyjny</strong>
              </p>
              <p className="mb-3">
                Ta płatność nie obciąży żadnej karty. Potwierdzenie zostanie
                przetworzone w tle.
              </p>
              <Button
                disabled={action.busy}
                onClick={() => {
                  void action.run(async () => {
                    await action.mutate(`/demo/payments/${id}`, {});
                    order.reload();
                  }, "Zlecono płatność demonstracyjną. Oczekujemy na potwierdzenie.");
                }}
              >
                Potwierdź płatność demo
              </Button>
            </div>
          )}
          {order.data.checkoutUrl &&
            mode.data?.mode !== "demo" &&
            order.data.paymentState === "pending" && (
              <a className="text-link" href={order.data.checkoutUrl}>
                Otwórz bezpieczną stronę operatora płatności
              </a>
            )}
          <Feedback {...action} />
          <div className="actions">
            <Button variant="outline" onClick={order.reload}>
              Sprawdź ponownie
            </Button>
            <Button asChild>
              <Link href="/dashboard?tab=sessions">Moje sesje</Link>
            </Button>
          </div>
          {order.data.state === "confirmed" && (
            <a
              className="text-link inline-block mt-5"
              href={`/api/v1/sessions/${id}/calendar`}
            >
              Dodaj termin do kalendarza (.ics)
            </a>
          )}
        </Card>
      )}
    </LoadState>
  );
}
