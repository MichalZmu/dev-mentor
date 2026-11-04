import { Suspense } from "react";
import type { JSX } from "react";
import { CheckoutStatus } from "@/components/checkout-status";
export default function CheckoutPage(): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <header className="page-heading auth-wrap">
        <p className="eyebrow">OSTATNI KROK PRZED ROZMOWĄ</p>
      </header>
      <Suspense
        fallback={
          <p role="status" className="notice">
            Wczytywanie statusu…
          </p>
        }
      >
        <CheckoutStatus />
      </Suspense>
    </main>
  );
}
