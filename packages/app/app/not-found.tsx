import type { JSX } from "react";
import Link from "next/link";
import { Button } from "@devmentor/ui/components/button";
export default function NotFound(): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <section className="page-heading">
        <p className="eyebrow">404 · TUTAJ JESZCZE NIE DOTARLIŚMY</p>
        <h1>Wróćmy na dobrą ścieżkę.</h1>
        <p>
          Nie znaleźliśmy tej strony. Sprawdź adres lub wróć do katalogu
          mentorów.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/mentors">Znajdź mentora</Link>
        </Button>
      </section>
    </main>
  );
}
