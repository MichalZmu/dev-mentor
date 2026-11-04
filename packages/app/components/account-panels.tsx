"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent, JSX } from "react";
import type { Case, UserProfile } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card, CardTitle } from "@devmentor/ui/components/card";
import { Textarea } from "@devmentor/ui/components/textarea";
import {
  Feedback,
  Field,
  LoadState,
  Pagination,
  Status,
  TextField,
} from "./shared";
import { formText, useAction, usePaginatedResource } from "./api-client";
export function SettingsPanel({
  user,
  reload,
}: {
  user: UserProfile;
  reload: () => void;
}): JSX.Element {
  const router = useRouter();
  const action = useAction();
  const [totp, setTotp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  function save(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(
        "/me",
        {
          name: formText(form, "name"),
          timezone: formText(form, "timezone"),
          preferences: { notifications: form.get("notifications") === "on" },
          version: user.version,
        },
        "PATCH",
      );
      reload();
    });
  }
  return (
    <div className="panel-grid">
      <Card>
        <CardTitle>Twoje dane i preferencje</CardTitle>
        <form className="form-stack mt-5" onSubmit={save}>
          <TextField
            label="Imię i nazwisko"
            name="name"
            defaultValue={user.name}
            minLength={2}
            maxLength={80}
          />
          <p className="text-sm">
            Zweryfikowany adres: <strong>{user.email}</strong>
          </p>
          <Field label="Strefa czasowa">
            <select
              name="timezone"
              defaultValue={user.timezone}
              className="select"
            >
              {[
                "Europe/Warsaw",
                "Europe/London",
                "Europe/Berlin",
                "America/New_York",
                "America/Los_Angeles",
                "Asia/Tokyo",
                "UTC",
              ].map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              name="notifications"
              defaultChecked={user.preferences.notifications !== false}
            />
            <span>Powiadomienia organizacyjne o sesjach i wiadomościach</span>
          </label>
          <Button disabled={action.busy}>Zapisz ustawienia</Button>
        </form>
        <form
          className="form-stack data-row"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action.run(async () => {
              const result = await fetch("/api/auth/change-email", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  newEmail: formText(form, "newEmail"),
                  callbackURL: "/auth",
                }),
              });
              if (!result.ok)
                throw new Error(
                  "Nie udało się rozpocząć zmiany adresu. Spróbuj ponownie.",
                );
            }, "Sprawdź wiadomości na dotychczasowym i nowym adresie. Adres zmieni się dopiero po wymaganych potwierdzeniach.");
          }}
        >
          <h3 className="font-semibold">Zmiana adresu e-mail</h3>
          <TextField label="Nowy adres e-mail" name="newEmail" type="email" />
          <Button variant="outline" disabled={action.busy}>
            Poproś o zmianę adresu
          </Button>
        </form>
        <div className="data-row">
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={() => {
              void action.run(async () => {
                await action.mutate("/auth/logout", {});
                window.dispatchEvent(new Event("devmentor-auth-change"));
                router.push("/");
                router.refresh();
              });
            }}
          >
            Wyloguj się ze swojego konta
          </Button>
        </div>
        <Feedback {...action} />
      </Card>
      <Card>
        <CardTitle>Bezpieczeństwo konta</CardTitle>
        <p className="muted text-sm mt-3">
          Dostęp do administracji w środowisku produkcyjnym wymaga dodatkowego
          potwierdzenia.
        </p>
        <form
          className="form-stack mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action.run(async () => {
              const response = await fetch("/api/auth/two-factor/enable", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: formText(form, "password") }),
              });
              const body: unknown = await response.json();
              if (
                !response.ok ||
                typeof body !== "object" ||
                body === null ||
                !("totpURI" in body) ||
                typeof body.totpURI !== "string"
              )
                throw new Error(
                  "Nie udało się uruchomić uwierzytelniania dwuskładnikowego.",
                );
              setBackupCodes(
                "backupCodes" in body && Array.isArray(body.backupCodes)
                  ? body.backupCodes.filter(
                      (code): code is string => typeof code === "string",
                    )
                  : [],
              );
              setTotp(body.totpURI);
              if ("backupCodes" in body && Array.isArray(body.backupCodes))
                setBackupCodes(
                  body.backupCodes.filter(
                    (code: unknown): code is string => typeof code === "string",
                  ),
                );
            }, "Dodaj konto do aplikacji uwierzytelniającej i potwierdź kod.");
          }}
        >
          <TextField label="Obecne hasło" name="password" type="password" />
          <Button variant="outline" disabled={action.busy}>
            Włącz uwierzytelnianie dwuskładnikowe
          </Button>
        </form>
        {totp && (
          <div className="notice">
            <p>Dodaj ten adres do aplikacji TOTP:</p>
            <code className="break-all text-xs">{totp}</code>
            {backupCodes.length > 0 && (
              <section className="mt-4">
                <h3 className="font-semibold">
                  Zapisz kody odzyskiwania w bezpiecznym miejscu
                </h3>
                <p className="text-sm">
                  Każdego kodu można użyć tylko raz. Nie wysyłaj ich nikomu.
                </p>
                <ul className="mt-3 text-sm">
                  {backupCodes.map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <form
              className="form-stack mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void action.run(async () => {
                  const response = await fetch(
                    "/api/auth/two-factor/verify-totp",
                    {
                      method: "POST",
                      credentials: "same-origin",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code: formText(form, "code") }),
                    },
                  );
                  if (!response.ok) throw new Error("Nieprawidłowy kod.");
                  setTotp("");
                  setBackupCodes([]);
                }, "Uwierzytelnianie dwuskładnikowe jest aktywne.");
              }}
            >
              <TextField
                label="Kod z aplikacji"
                name="code"
                minLength={6}
                maxLength={6}
              />
              <Button disabled={action.busy}>Potwierdź konfigurację</Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
export function SupportPanel({
  userId = "",
}: {
  userId?: string;
}): JSX.Element {
  const cases = usePaginatedResource<Case>("/me/support-tickets", userId);
  const action = useAction();
  function send(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const element = event.currentTarget;
    void action.run(async () => {
      const sessionId = formText(form, "sessionId");
      await action.mutate("/support-tickets", {
        category: formText(form, "category"),
        description: formText(form, "description"),
        ...(sessionId ? { sessionId } : {}),
      });
      element.reset();
      cases.reload();
    }, "Zgłoszenie zapisane. Jego status znajdziesz poniżej.");
  }
  return (
    <div className="panel-grid">
      <Card>
        <CardTitle>W czym możemy pomóc?</CardTitle>
        <p className="muted text-sm mt-3">
          Opisz sytuację. Nie przesyłaj haseł ani danych kart.
        </p>
        <form className="form-stack mt-5" onSubmit={send}>
          <Field label="Temat zgłoszenia">
            <select name="category" className="select">
              <option value="session">Sesja i termin</option>
              <option value="payment">Płatność lub zwrot</option>
              <option value="account">Dostęp do konta</option>
              <option value="other">Inna sprawa</option>
            </select>
          </Field>
          <TextField
            label="Numer sesji (opcjonalnie)"
            name="sessionId"
            required={false}
          />
          <Field label="Opis sprawy (20–2000 znaków)">
            <Textarea
              name="description"
              required
              minLength={20}
              maxLength={2000}
            />
          </Field>
          <Feedback {...action} />
          <Button disabled={action.busy}>Wyślij zgłoszenie</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>Twoje zgłoszenia</CardTitle>
        <LoadState {...cases} retry={cases.retry}>
          {cases.data?.length ? (
            cases.data.map((item) => (
              <article className="data-row" key={item.id}>
                <Status value={item.status} />
                <p className="subtle mt-2">Numer: {item.id}</p>
                <p className="prose-copy text-sm mt-2">
                  {typeof item.payload.description === "string"
                    ? item.payload.description
                    : ""}
                </p>
                {item.decisionReason && (
                  <p className="notice">Odpowiedź: {item.decisionReason}</p>
                )}
              </article>
            ))
          ) : (
            <p className="notice">
              Nie masz jeszcze zgłoszeń. Gdy będziesz potrzebować pomocy,
              jesteśmy tutaj.
            </p>
          )}
        </LoadState>
        <Pagination {...cases} label="Twoje zgłoszenia" />
      </Card>
    </div>
  );
}
