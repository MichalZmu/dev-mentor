import type { JSX } from "react";
export default function Loading(): JSX.Element {
  return (
    <main id="main" className="shell content-wrap">
      <p role="status" className="notice skeleton">
        Przygotowujemy Twoją przestrzeń…
      </p>
    </main>
  );
}
