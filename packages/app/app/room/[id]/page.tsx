import { Suspense } from "react";
import type { JSX } from "react";
import { SessionRoom } from "@/components/session-room";
async function RoomContent({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  return <SessionRoom id={id} />;
}
export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <header className="page-heading">
        <h1>Twoja sesja mentoringowa.</h1>
      </header>
      <Suspense
        fallback={
          <p role="status" className="notice">
            Wczytywanie sesji…
          </p>
        }
      >
        <RoomContent params={params} />
      </Suspense>
    </main>
  );
}
