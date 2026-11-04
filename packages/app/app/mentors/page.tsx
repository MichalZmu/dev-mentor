import { Suspense } from "react";
import type { JSX } from "react";
import { Catalog } from "@/components/catalog";
export default function MentorsPage(): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <header className="page-heading">
        <p className="eyebrow">DOBRE DOPASOWANIE MA ZNACZENIE</p>
        <h1>Znajdź swojego mentora.</h1>
        <p>
          Praktycy, różne perspektywy i konkretne doświadczenie. Wybierz osobę,
          z którą chcesz zrobić następny krok.
        </p>
      </header>
      <Suspense
        fallback={
          <p role="status" className="notice">
            Wczytywanie katalogu…
          </p>
        }
      >
        <Catalog />
      </Suspense>
    </main>
  );
}
