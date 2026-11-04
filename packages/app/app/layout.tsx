import type { JSX } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccountNav } from "@/components/shared";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "DevMentor — rozwijaj się z praktykiem",
    template: "%s | DevMentor",
  },
  description:
    "Mentoring technologiczny 1:1. Znajdź mentora, zaplanuj sesję i pracuj nad swoim kolejnym krokiem w IT.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="pl">
      <body>
        <a className="skip-link" href="#main">
          Przejdź do treści
        </a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link
              href="/"
              className="brand"
              aria-label="DevMentor — strona główna"
            >
              <span className="brand-mark">
                d<span>m</span>
              </span>
              DevMentor<span className="brand-dot">.</span>
            </Link>
            <AccountNav />
          </div>
        </header>
        {children}
        <footer className="site-footer shell">
          <div>
            <Link className="brand" href="/">
              DevMentor.
            </Link>
            <p>Twój kolejny krok w IT. Z kimś, kto już go zrobił.</p>
          </div>
          <nav aria-label="Stopka">
            <Link href="/mentor">Zostań mentorem</Link>
            <Link href="/dashboard?tab=support">Pomoc</Link>
            <Link href="/admin">Administracja</Link>
          </nav>
          <p className="text-sm">Sesje online · Polska · PLN</p>
        </footer>
      </body>
    </html>
  );
}
