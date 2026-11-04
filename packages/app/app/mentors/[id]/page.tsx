import { Suspense } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { MentorProfile } from "@/components/mentor-profile";
async function ProfileContent({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  return <MentorProfile id={id} />;
}
export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <div className="page-heading">
        <Link href="/mentors" className="text-link">
          ← Wszyscy mentorzy
        </Link>
      </div>
      <Suspense
        fallback={
          <p role="status" className="notice">
            Wczytywanie profilu…
          </p>
        }
      >
        <ProfileContent params={params} />
      </Suspense>
    </main>
  );
}
