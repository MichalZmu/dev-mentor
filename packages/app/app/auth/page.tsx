import { Suspense } from "react";
import type { JSX } from "react";
import { AuthForm } from "@/components/auth-form";
export default function AuthPage(): JSX.Element {
  return (
    <main id="main" tabIndex={-1} className="shell content-wrap">
      <header className="page-heading auth-wrap">
        <p className="eyebrow">TWOJA PRZESTRZEŃ ROZWOJU</p>
        <h1>Zacznij od rozmowy.</h1>
        <p>Jedno konto do sesji, wiadomości i Twojego planu.</p>
      </header>
      <div className="auth-wrap">
        <Suspense
          fallback={
            <p role="status" className="notice">
              Wczytywanie formularza…
            </p>
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
