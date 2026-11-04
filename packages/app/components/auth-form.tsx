"use client";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@devmentor/ui/components/button";
import { Card } from "@devmentor/ui/components/card";
import { Feedback, TextField } from "./shared";
import { formText, useAction, useResource } from "./api-client";
interface AuthResult {
  emailVerificationRequired?: boolean;
  twoFactorRedirect?: boolean;
  verificationUrl?: string;
  demoMailboxAvailable?: boolean;
}
export function AuthForm(): JSX.Element {
  const router = useRouter();
  const query = useSearchParams();
  const initial = query.get("mode");
  const [mode, setMode] = useState(
    initial === "reset" || initial === "confirm" ? initial : "login",
  );
  const [verificationUrl, setVerificationUrl] = useState("");
  const [mailboxAvailable, setMailboxAvailable] = useState(false);
  const config = useResource<{ mode: string; oauth?: { google: boolean } }>(
    "/config",
  );
  const action = useAction();
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(
      async () => {
        if (mode === "reset") {
          await action.mutate("/auth/password-reset", {
            email: formText(form, "email"),
          });
          return;
        }
        if (mode === "confirm") {
          await action.mutate("/auth/password-reset/confirm", {
            token: query.get("token") ?? formText(form, "token"),
            newPassword: formText(form, "password"),
          });
          setMode("login");
          return;
        }
        const data = await action.mutate<AuthResult>(
          `/auth/${mode === "register" ? "register" : "login"}`,
          {
            email: formText(form, "email"),
            password: formText(form, "password"),
            ...(mode === "register"
              ? { name: formText(form, "name"), termsVersion: "2026-11-03" }
              : {}),
          },
        );
        if (data.verificationUrl) setVerificationUrl(data.verificationUrl);
        if (data.demoMailboxAvailable) setMailboxAvailable(true);
        if (data.twoFactorRedirect) {
          setMode("mfa");
          return;
        }
        if (mode === "register" && data.emailVerificationRequired) return;
        const next = query.get("next");
        let destination = "/dashboard";
        if (next?.startsWith("/") && !/[\\\u0000-\u0020]/.test(next)) {
          const target = new URL(next, window.location.origin);
          if (target.origin === window.location.origin)
            destination = target.pathname + target.search + target.hash;
        }
        window.dispatchEvent(new Event("devmentor-auth-change"));
        router.push(destination);
      },
      mode === "reset"
        ? "Jeśli konto istnieje, wysłaliśmy instrukcję resetu hasła."
        : mode === "register"
          ? "Konto utworzone. Potwierdź adres, korzystając z wiadomości e-mail."
          : "Gotowe.",
    );
  }
  return (
    <Card>
      <div className="tabs" role="group" aria-label="Sposób dostępu">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => setMode("login")}
        >
          Logowanie
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          onClick={() => setMode("register")}
        >
          Utwórz konto
        </button>
      </div>
      <h2 className="section-subtitle">
        {mode === "register"
          ? "Zrób pierwszy krok."
          : mode === "reset"
            ? "Odzyskaj dostęp."
            : mode === "confirm"
              ? "Ustaw nowe hasło."
              : mode === "mfa"
                ? "Potwierdź drugi składnik."
                : "Dobrze Cię widzieć."}
      </h2>
      {mode === "mfa" ? (
        <MfaForm />
      ) : (
        <form className="form-stack" onSubmit={submit}>
          {mode === "register" && (
            <TextField
              label="Imię i nazwisko"
              name="name"
              minLength={2}
              maxLength={80}
            />
          )}
          {mode !== "confirm" && (
            <TextField
              label="Adres e-mail"
              name="email"
              type="email"
              maxLength={254}
            />
          )}
          {mode !== "reset" && (
            <TextField
              label={
                mode === "confirm" ? "Nowe hasło (minimum 12 znaków)" : "Hasło"
              }
              name="password"
              type="password"
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
            />
          )}
          {mode === "confirm" && !query.get("token") && (
            <TextField label="Token z wiadomości" name="token" />
          )}
          {mode === "register" && (
            <label className="check-label">
              <input type="checkbox" name="terms" required />
              <span>
                Akceptuję zasady usługi: sesja 50 minut, płatność przed
                spotkaniem i zmiany co najmniej 24 godziny wcześniej.
              </span>
            </label>
          )}
          <Feedback {...action} />
          <Button type="submit" disabled={action.busy}>
            {mode === "register"
              ? "Utwórz konto"
              : mode === "reset"
                ? "Wyślij instrukcję"
                : mode === "confirm"
                  ? "Zmień hasło"
                  : "Zaloguj się"}
          </Button>
        </form>
      )}
      {(mode === "login" || mode === "register") &&
        config.data?.oauth?.google && (
          <div className="mt-5 border-t pt-5">
            <p className="subtle mb-3">Możesz też użyć swojego konta Google.</p>
            <Button
              className="w-full"
              variant="outline"
              disabled={action.busy}
              onClick={() => {
                void action.run(async () => {
                  let destination = "/dashboard";
                  const next = query.get("next");
                  if (
                    next?.startsWith("/") &&
                    !/[\\\u0000-\u0020]/.test(next)
                  ) {
                    const target = new URL(next, window.location.origin);
                    if (target.origin === window.location.origin)
                      destination =
                        target.pathname + target.search + target.hash;
                  }
                  const response = await fetch("/api/auth/sign-in/social", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      provider: "google",
                      callbackURL: destination,
                    }),
                  });
                  const result: unknown = await response.json();
                  if (
                    !response.ok ||
                    typeof result !== "object" ||
                    result === null ||
                    !("url" in result) ||
                    typeof result.url !== "string"
                  )
                    throw new Error(
                      "Logowanie przez Google jest chwilowo niedostępne. Spróbuj ponownie.",
                    );
                  const redirect = new URL(result.url);
                  if (redirect.protocol !== "https:")
                    throw new Error(
                      "Nie udało się otworzyć bezpiecznej strony logowania Google.",
                    );
                  window.location.assign(redirect.href);
                }, "Otwieramy stronę logowania Google.");
              }}
            >
              Kontynuuj przez Google
            </Button>
          </div>
        )}
      {(mailboxAvailable || config.data?.mode === "demo") && <DemoMailbox />}
      {verificationUrl && (
        <p className="notice">
          Tryb demonstracyjny:{" "}
          <a className="text-link" href={verificationUrl}>
            Otwórz potwierdzenie adresu e-mail
          </a>
        </p>
      )}
      {mode === "login" && (
        <button className="text-link mt-5" onClick={() => setMode("reset")}>
          Nie pamiętam hasła
        </button>
      )}
      <p className="subtle mt-6">
        Przed rezerwacją zweryfikuj adres e-mail. Płatność za pojedynczą sesję
        nie włącza subskrypcji.
      </p>
      <Link href="/mentors" className="text-link">
        Wróć do mentorów
      </Link>
    </Card>
  );
}
function MfaForm(): JSX.Element {
  const router = useRouter();
  const action = useAction();
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      const response = await fetch("/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: formText(form, "code") }),
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Kod jest niepoprawny lub wygasł.");
      window.dispatchEvent(new Event("devmentor-auth-change"));
      router.push("/admin");
      router.refresh();
    });
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <TextField
        label="Kod z aplikacji uwierzytelniającej"
        name="code"
        minLength={6}
        maxLength={6}
      />
      <Feedback {...action} />
      <Button disabled={action.busy}>Potwierdź kod</Button>
    </form>
  );
}

function DemoMailbox(): JSX.Element {
  const [open, setOpen] = useState(false);
  const messages = useResource<
    { subject: string; url: string; createdAt: string }[]
  >(open ? "/demo/mailbox" : null);
  return (
    <section className="notice">
      <h3 className="font-semibold">Lokalna skrzynka demonstracyjna</h3>
      <p className="text-sm mb-3">
        Wiadomości dotyczą wyłącznie kont utworzonych w tej przeglądarce w
        lokalnym trybie demo.
      </p>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          messages.reload();
        }}
      >
        Pokaż lokalne wiadomości demonstracyjne
      </Button>
      {messages.loading && <p role="status">Wczytywanie wiadomości…</p>}
      {messages.error && <p role="alert">{messages.error}</p>}
      {messages.data?.map((message) => (
        <p key={message.url} className="mt-4">
          <a className="text-link" href={message.url}>
            {message.subject}
          </a>
        </p>
      ))}
      {open && messages.data?.length === 0 && (
        <p className="text-sm mt-3">
          Nie ma jeszcze wiadomości. Odśwież skrzynkę za chwilę.
        </p>
      )}
    </section>
  );
}
