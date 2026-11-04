"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { JSX } from "react";
import type { UserProfile, Booking } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card } from "@devmentor/ui/components/card";
import { LoadState } from "./shared";
import { dateTime, useResource } from "./api-client";
import { SessionsPanel } from "./sessions-panel";
import { FavoritesPanel } from "./favorites-panel";
import { MessagesPanel } from "./messages-panel";
import { DevelopmentPanel } from "./development-panel";
import { BillingPanel } from "./billing-panel";
import { SettingsPanel, SupportPanel } from "./account-panels";
const tabs = [
  { id: "overview", title: "Mój pulpit" },
  { id: "sessions", title: "Sesje" },
  { id: "favorites", title: "Ulubieni mentorzy" },
  { id: "goals", title: "Cel i plan rozwoju" },
  { id: "messages", title: "Wiadomości" },
  { id: "billing", title: "Płatności i pakiety" },
  { id: "settings", title: "Ustawienia" },
  { id: "support", title: "Pomoc" },
];
export function Dashboard(): JSX.Element {
  const query = useSearchParams();
  const tab = tabs.some((item) => item.id === query.get("tab"))
    ? query.get("tab")
    : "overview";
  const me = useResource<UserProfile>("/me");
  return (
    <LoadState {...me} retry={me.reload}>
      {me.data && (
        <>
          <header className="page-heading">
            <p className="eyebrow">TWOJA PRZESTRZEŃ ROZWOJU</p>
            <h1>Cześć, {me.data.name.split(" ")[0]}.</h1>
            <p>Nie wszystko naraz. Wybierz swój następny krok.</p>
          </header>
          <div className="workspace">
            <aside>
              <nav className="workspace-nav" aria-label="Panel uczestnika">
                {tabs.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard?tab=${item.id}`}
                    aria-current={tab === item.id ? "page" : undefined}
                  >
                    {item.title}
                  </Link>
                ))}
                {me.data.roles.includes("mentor") && (
                  <Link href="/mentor">Panel mentora ↗</Link>
                )}
                {me.data.roles.some((role) =>
                  ["admin", "moderator", "support"].includes(role),
                ) && <Link href="/admin">Administracja ↗</Link>}
              </nav>
            </aside>
            <div className="workspace-body">
              {tab === "overview" && <Overview user={me.data} />}
              {tab === "sessions" && <SessionsPanel user={me.data} />}
              {tab === "messages" && <MessagesPanel user={me.data} />}
              {tab === "favorites" && <FavoritesPanel />}
              {tab === "goals" && <DevelopmentPanel />}
              {tab === "billing" && <BillingPanel />}
              {tab === "settings" && (
                <SettingsPanel user={me.data} reload={me.reload} />
              )}
              {tab === "support" && <SupportPanel userId={me.data.id} />}
            </div>
          </div>
        </>
      )}
    </LoadState>
  );
}
function Overview({ user }: { user: UserProfile }): JSX.Element {
  const summary = useResource<{
    nextSession: Booking | null;
    upcomingCount: number;
    completedCount: number;
  }>("/me/dashboard", user.id);
  const next = summary.data?.nextSession;
  return (
    <>
      <div className="metric-grid">
        <div className="metric">
          <strong>{summary.data?.upcomingCount ?? "—"}</strong>
          <span>Nadchodzące sesje</span>
        </div>
        <div className="metric">
          <strong>{summary.data?.completedCount ?? "—"}</strong>
          <span>Odbyte spotkania</span>
        </div>
        <div className="metric">
          <strong>Twój rytm</strong>
          <span>Małe kroki w dobrą stronę</span>
        </div>
      </div>
      <Card>
        <p className="eyebrow">NAJBLIŻSZY KROK</p>
        <LoadState {...summary} retry={summary.reload}>
          {next ? (
            <>
              <h2 className="text-2xl font-semibold">
                Czas na kolejną rozmowę.
              </h2>
              <p className="date-card">
                {dateTime(next.startsAt, user.timezone)} · {user.timezone}
              </p>
              <Button asChild>
                <Link href="/dashboard?tab=sessions">Zobacz swoje sesje</Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold">
                Twój plan zaczyna się tutaj.
              </h2>
              <p className="muted my-4">
                Znajdź osobę, która pomoże Ci uporządkować wyzwania i przełożyć
                je na działanie.
              </p>
              <div className="actions">
                <Button asChild>
                  <Link href="/mentors">Wybierz mentora</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard?tab=goals">Określ swój cel</Link>
                </Button>
              </div>
            </>
          )}
        </LoadState>
      </Card>
      <div className="panel-grid mt-6">
        <Card>
          <h2 className="section-subtitle">Wracaj do swoich wniosków.</h2>
          <p className="muted text-sm">
            Prywatne notatki znajdziesz w szczegółach każdej sesji. Plan pomaga
            utrzymać kierunek między spotkaniami.
          </p>
          <Link
            className="text-link inline-block mt-5"
            href="/dashboard?tab=goals"
          >
            Mój plan rozwoju ↗
          </Link>
        </Card>
        <Card>
          <h2 className="section-subtitle">Dobra rozmowa przed rozmową.</h2>
          <p className="muted text-sm">
            Ustal z mentorem, co jest dla Ciebie najważniejsze. Wiadomości
            pozostają w Twoim panelu.
          </p>
          <Link
            className="text-link inline-block mt-5"
            href="/dashboard?tab=messages"
          >
            Otwórz wiadomości ↗
          </Link>
        </Card>
      </div>
    </>
  );
}
