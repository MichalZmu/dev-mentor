import { Suspense } from "react";
import type { JSX } from "react";
import { Dashboard } from "@/components/dashboard";
export default function DashboardPage(): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <Suspense
        fallback={
          <p role="status" className="notice">
            Wczytywanie Twojego panelu…
          </p>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}
