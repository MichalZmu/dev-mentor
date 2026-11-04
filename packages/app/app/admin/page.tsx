import { Suspense } from "react";
import type { JSX } from "react";
import { AdminWorkspace } from "@/components/admin-workspace";
export default function AdminPage(): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <header className="page-heading">
        <p className="eyebrow">JAKOŚĆ I BEZPIECZEŃSTWO WSPÓŁPRACY</p>
        <h1>Panel administracyjny</h1>
        <p>
          Weryfikacja mentorów, pomoc uczestnikom i historia uzasadnionych
          decyzji.
        </p>
      </header>
      <Suspense
        fallback={
          <p role="status" className="notice">
            Wczytywanie kolejek…
          </p>
        }
      >
        <AdminWorkspace />
      </Suspense>
    </main>
  );
}
