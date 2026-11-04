"use client";
import type { JSX } from "react";
import { Button } from "@devmentor/ui/components/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <section className="page-heading">
        <h1>Coś zatrzymało ten krok.</h1>
        <p role="alert">
          Nie udało się wczytać strony. Spróbuj ponownie za chwilę.
        </p>
        <Button className="mt-6" onClick={reset}>
          Spróbuj ponownie
        </Button>
      </section>
    </main>
  );
}
