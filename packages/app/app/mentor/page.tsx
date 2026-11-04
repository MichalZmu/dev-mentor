import { Suspense } from "react";
import type { JSX } from "react";
import { MentorWorkspace } from "@/components/mentor-workspace";
export default function MentorPage(): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <Suspense
        fallback={
          <p role="status" className="notice">
            Wczytywanie przestrzeni mentora…
          </p>
        }
      >
        <MentorWorkspace />
      </Suspense>
    </main>
  );
}
