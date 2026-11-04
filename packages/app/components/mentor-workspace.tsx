"use client";
import { mentorSpecialties } from "./mentor-specialties";
import { useMemo } from "react";
import type { FormEvent, JSX } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { localTimeCandidates } from "@devmentor/core";
import type {
  AvailabilityRule,
  CalendarException,
  AvailabilitySlot,
  Case,
  Mentor,
  Payout,
  UserProfile,
} from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card, CardTitle } from "@devmentor/ui/components/card";
import { Textarea } from "@devmentor/ui/components/textarea";
import { Feedback, Field, LoadState, Status, TextField } from "./shared";
import {
  dateTime,
  formText,
  money,
  priceMinor,
  useAction,
  useResource,
} from "./api-client";
import { SessionsPanel } from "./sessions-panel";
import { MessagesPanel } from "./messages-panel";
const mentorTabs = [
  { id: "overview", title: "Twój profil" },
  { id: "availability", title: "Dostępność" },
  { id: "sessions", title: "Sesje" },
  { id: "messages", title: "Wiadomości" },
  { id: "earnings", title: "Rozliczenia" },
];
export function MentorWorkspace(): JSX.Element {
  const query = useSearchParams();
  const tab = query.get("tab") ?? "overview";
  const me = useResource<UserProfile>("/me");
  return (
    <LoadState {...me} retry={me.reload}>
      {me.data && (
        <>
          <header className="page-heading">
            <p className="eyebrow">
              WIEDZA MA WIĘKSZY SENS, GDY SIĘ NIĄ DZIELISZ
            </p>
            <h1>
              {me.data.roles.includes("mentor")
                ? "Twoja praktyka mentoringowa."
                : "Pomóż komuś zrobić kolejny krok."}
            </h1>
            <p>
              Twoje doświadczenie, konkretna pomoc i współpraca na jasnych
              zasadach.
            </p>
          </header>
          {me.data.roles.includes("mentor") ? (
            <>
              <nav className="tabs" aria-label="Panel mentora">
                {mentorTabs.map((item) => (
                  <Link
                    aria-current={tab === item.id ? "page" : undefined}
                    href={`/mentor?tab=${item.id}`}
                    key={item.id}
                  >
                    {item.title}
                  </Link>
                ))}
              </nav>
              {tab === "overview" && <MentorEditor />}
              {tab === "availability" && <AvailabilityEditor />}
              {tab === "sessions" && <SessionsPanel user={me.data} />}
              {tab === "messages" && <MessagesPanel user={me.data} />}
              {tab === "earnings" && <EarningsPanel />}
            </>
          ) : (
            <MentorApplication />
          )}
        </>
      )}
    </LoadState>
  );
}
function priceInput(value: string): string {
  const amount = BigInt(value);
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
}
function MentorForm({
  mentor,
  application = false,
  complete,
}: {
  mentor?: Mentor;
  application?: boolean;
  complete: () => void;
}): JSX.Element {
  const action = useAction();
  function save(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(
      async () => {
        await action.mutate(
          application ? "/mentor-applications" : "/mentor/profile",
          {
            headline: formText(form, "headline"),
            bio: formText(form, "bio"),
            specialty: formText(form, "specialty"),
            languages: form
              .getAll("languages")
              .filter((value): value is string => typeof value === "string"),
            priceMinor: priceMinor(formText(form, "price")),
            years: Number(formText(form, "years")),
            ...(mentor ? { version: mentor.version } : {}),
            ...(application ? { termsVersion: "2026-11-03" } : {}),
          },
          application ? "POST" : "PATCH",
        );
        complete();
      },
      application
        ? "Zgłoszenie wysłane. Twój profil pozostaje niepubliczny do zakończenia weryfikacji."
        : "Profil zapisany. Poprzednie rezerwacje zachowują swoją cenę.",
    );
  }
  return (
    <form onSubmit={save} className="form-stack">
      <TextField
        label="Nagłówek profilu (10–100 znaków)"
        name="headline"
        minLength={10}
        maxLength={100}
        defaultValue={mentor?.headline ?? ""}
      />
      <Field label="Opowiedz o swoim doświadczeniu (50–1000 znaków)">
        <Textarea
          name="bio"
          minLength={50}
          maxLength={1000}
          required
          defaultValue={mentor?.bio ?? ""}
        />
      </Field>
      <div className="form-grid">
        <Field label="Główna specjalizacja">
          <select
            name="specialty"
            className="select"
            defaultValue={mentor?.specialty.toLowerCase() ?? "frontend"}
          >
            {mentorSpecialties.map((specialty) => (
              <option key={specialty.value} value={specialty.value}>
                {specialty.label}
              </option>
            ))}
          </select>
        </Field>
        <TextField
          label="Lata doświadczenia (1–40)"
          name="years"
          type="number"
          min="1"
          max="40"
          defaultValue={String(mentor?.years ?? 3)}
        />
        <TextField
          label="Cena sesji 50 min (PLN)"
          name="price"
          defaultValue={mentor ? priceInput(mentor.priceMinor) : "180"}
        />
        <fieldset>
          <legend className="text-sm font-semibold mb-2">Języki sesji</legend>
          {[
            { value: "pl", title: "Polski" },
            { value: "en", title: "Angielski" },
          ].map((item) => (
            <label key={item.value} className="check-label">
              <input
                type="checkbox"
                name="languages"
                value={item.value}
                defaultChecked={
                  mentor
                    ? mentor.languages.includes(item.value)
                    : item.value === "pl"
                }
              />
              {item.title}
            </label>
          ))}
        </fieldset>
      </div>
      {application && (
        <label className="check-label">
          <input type="checkbox" required />
          <span>
            Potwierdzam zgodność danych i akceptuję warunki współpracy oraz
            propozycję prowizji 15%.
          </span>
        </label>
      )}
      <Feedback {...action} />
      <Button disabled={action.busy}>
        {application ? "Wyślij zgłoszenie do weryfikacji" : "Zapisz profil"}
      </Button>
    </form>
  );
}
function MentorApplication(): JSX.Element {
  const application = useResource<Case | null>("/me/mentor-application");
  return (
    <div className="panel-grid">
      <Card>
        <CardTitle>Zacznij od swojego doświadczenia.</CardTitle>
        <p className="muted text-sm my-5">
          Napisz, w czym możesz pomóc. Zespół sprawdzi zgłoszenie przed
          publikacją profilu.
        </p>
        <LoadState {...application} retry={application.reload}>
          {application.data ? (
            <>
              <Status value={application.data.status} />
              <p className="notice">
                Twoje zgłoszenie ma numer {application.data.id}.{" "}
                {application.data.status === "pending"
                  ? "Czeka na ocenę. Nie musisz wysyłać go ponownie."
                  : application.data.decisionReason}
              </p>
              {application.data.status === "approved" && (
                <Button onClick={() => window.location.reload()}>
                  Otwórz swój panel mentora
                </Button>
              )}
            </>
          ) : (
            <MentorForm application complete={application.reload} />
          )}
        </LoadState>
      </Card>
      <Card>
        <CardTitle>Praktyka, która daje wartość.</CardTitle>
        <ol className="item-list mt-5">
          <li>
            <strong>1. Opowiedz, kim jesteś.</strong>
            <p className="muted text-sm">
              Doświadczenie, specjalizacja i podejście do pracy.
            </p>
          </li>
          <li>
            <strong>2. Poznajmy się.</strong>
            <p className="muted text-sm">
              Profil trafia do moderacji. Decyzję otrzymasz z uzasadnieniem.
            </p>
          </li>
          <li>
            <strong>3. Ustal swoją dostępność.</strong>
            <p className="muted text-sm">
              Po akceptacji samodzielnie udostępnisz terminy i cenę.
            </p>
          </li>
        </ol>
      </Card>
    </div>
  );
}
function MentorEditor(): JSX.Element {
  const profile = useResource<Mentor>("/mentor/profile");
  return (
    <LoadState {...profile} retry={profile.reload}>
      {profile.data && (
        <div className="panel-grid">
          <Card>
            <CardTitle>Twoja oferta, Twoje doświadczenie</CardTitle>
            <p className="muted text-sm my-5">
              Pomóż uczestnikom zrozumieć, w czym możesz ich wesprzeć.
            </p>
            <MentorForm mentor={profile.data} complete={profile.reload} />
          </Card>
          <Card>
            <CardTitle>Twój publiczny profil</CardTitle>
            <p className="text-2xl font-semibold mt-5">{profile.data.name}</p>
            <p className="muted my-3">{profile.data.headline}</p>
            <Status value={profile.data.status} />
            <p className="font-semibold mt-5">
              {money(profile.data.priceMinor, profile.data.currency)} / 50 min
            </p>
            <Button className="mt-5" asChild variant="outline">
              <Link href={`/mentors/${profile.data.id}`}>Zobacz profil</Link>
            </Button>
          </Card>
        </div>
      )}
    </LoadState>
  );
}
function AvailabilityEditor(): JSX.Element {
  const range = useMemo(() => {
    const start = new Date();
    return new URLSearchParams({
      from: start.toISOString(),
      to: new Date(start.getTime() + 30 * 86400000).toISOString(),
    }).toString();
  }, []);
  const slots = useResource<AvailabilitySlot[]>(
    `/mentor/availability?${range}`,
  );
  const rules = useResource<{
    rules: AvailabilityRule[];
    exceptions: CalendarException[];
  }>("/mentor/availability/rules");
  const currentRules = rules.data;
  const action = useAction();
  function add(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      const zone = formText(form, "timezone");
      const candidates = localTimeCandidates(
        formText(form, "localDate") + "T" + formText(form, "localTime"),
        zone,
      );
      const firstCandidate = candidates[0];
      if (firstCandidate === undefined)
        throw new Error(
          "Ta godzina nie istnieje w wybranej strefie z powodu zmiany czasu. Wybierz inną.",
        );
      const ambiguity = formText(form, "ambiguity");
      if (candidates.length > 1 && ambiguity === "reject")
        throw new Error(
          "Ta godzina występuje dwukrotnie. Wybierz wcześniejszy lub późniejszy wariant.",
        );
      // The first-candidate check proves this array is nonempty.
      const startsAt =
        ambiguity === "later" ? (candidates.at(-1) as string) : firstCandidate;
      const next = [
        ...(slots.data ?? []).map((slot) => ({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          timezone: slot.timezone,
        })),
        {
          startsAt,
          endsAt: new Date(Date.parse(startsAt) + 50 * 60_000).toISOString(),
          timezone: zone,
        },
      ];
      await action.mutate("/mentor/availability", { slots: next }, "PUT");
      slots.reload();
    }, "Termin dodany do kalendarza.");
  }
  function addRule(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      const rule = {
        weekday: Number(formText(form, "weekday")),
        localTime: formText(form, "localTime"),
        timezone: formText(form, "timezone"),
        disambiguation: formText(form, "disambiguation"),
      };
      await action.mutate(
        "/mentor/availability/rules",
        {
          rules: [...(rules.data?.rules ?? []), rule],
          exceptions: rules.data?.exceptions ?? [],
        },
        "PUT",
      );
      rules.reload();
      slots.reload();
    }, "Cykliczny termin zapisany.");
  }
  return (
    <div className="panel-grid">
      <div className="item-list">
        <Card>
          <CardTitle>Dodaj pojedynczy termin</CardTitle>
          <p className="muted text-sm my-4">
            Sesja trwa 50 minut. Podajesz godzinę lokalną w wybranej strefie.
            Godziny w kalendarzu uwzględniają zmianę czasu.
          </p>
          <form className="form-stack" onSubmit={add}>
            <TextField label="Dzień" name="localDate" type="date" />
            <TextField label="Godzina lokalna" name="localTime" type="time" />
            <TextField
              label="Strefa IANA"
              name="timezone"
              defaultValue="Europe/Warsaw"
            />
            <Field label="Jeśli godzina występuje dwukrotnie">
              <select name="ambiguity" className="select">
                <option value="reject">Poproś o wybór</option>
                <option value="earlier">Wcześniejsza chwila</option>
                <option value="later">Późniejsza chwila</option>
              </select>
            </Field>
            <Button disabled={action.busy || slots.loading}>
              Dodaj dostępny termin
            </Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Regularna dostępność</CardTitle>
          <LoadState {...rules} retry={rules.reload}>
            {currentRules?.rules.map((rule, index) => (
              <div
                className="data-row flex justify-between items-center gap-3"
                key={`${rule.weekday}-${rule.localTime}-${index}`}
              >
                <p className="text-sm">
                  {
                    [
                      "Niedziela",
                      "Poniedziałek",
                      "Wtorek",
                      "Środa",
                      "Czwartek",
                      "Piątek",
                      "Sobota",
                    ][rule.weekday]
                  }{" "}
                  · {rule.localTime} · {rule.timezone}
                </p>
                <Button
                  variant="ghost"
                  disabled={action.busy}
                  onClick={() => {
                    void action.run(async () => {
                      await action.mutate(
                        "/mentor/availability/rules",
                        {
                          rules: currentRules.rules.filter(
                            (_, i) => i !== index,
                          ),
                          exceptions: currentRules.exceptions,
                        },
                        "PUT",
                      );
                      rules.reload();
                      slots.reload();
                    });
                  }}
                >
                  Usuń regułę
                </Button>
              </div>
            ))}
          </LoadState>
          <form className="form-stack mt-5" onSubmit={addRule}>
            <Field label="Dzień tygodnia">
              <select name="weekday" className="select">
                {[
                  "Niedziela",
                  "Poniedziałek",
                  "Wtorek",
                  "Środa",
                  "Czwartek",
                  "Piątek",
                  "Sobota",
                ].map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </Field>
            <TextField label="Godzina lokalna" name="localTime" type="time" />
            <TextField
              label="Strefa IANA"
              name="timezone"
              defaultValue="Europe/Warsaw"
            />
            <Field label="Powtórzona godzina przy zmianie czasu">
              <select name="disambiguation" className="select">
                <option value="reject">Pomiń niejednoznaczny termin</option>
                <option value="earlier">Wcześniejsza chwila</option>
                <option value="later">Późniejsza chwila</option>
              </select>
            </Field>
            <Button variant="outline" disabled={action.busy || rules.loading}>
              Dodaj regularny termin
            </Button>
          </form>
          <form
            className="form-stack data-row"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void action.run(async () => {
                await action.mutate(
                  "/mentor/availability/rules",
                  {
                    rules: rules.data?.rules ?? [],
                    exceptions: [
                      ...(rules.data?.exceptions ?? []),
                      {
                        localDate: formText(form, "localDate"),
                        available: false,
                      },
                    ],
                  },
                  "PUT",
                );
                rules.reload();
                slots.reload();
              }, "Dzień wolny zapisany.");
            }}
          >
            <TextField
              label="Dzień wolny od regularnych sesji"
              name="localDate"
              type="date"
            />
            <Button variant="outline" disabled={action.busy}>
              Zapisz wyjątek
            </Button>
          </form>
          {currentRules?.exceptions.map((exception, index) => (
            <div
              className="data-row flex items-center justify-between gap-3"
              key={`${exception.localDate}-${index}`}
            >
              <p className="subtle">
                {exception.localDate}:{" "}
                {exception.available ? "Dostępny" : "Dzień wolny"}
              </p>
              <Button
                variant="ghost"
                disabled={action.busy}
                onClick={() => {
                  void action.run(async () => {
                    await action.mutate(
                      "/mentor/availability/rules",
                      {
                        rules: currentRules.rules,
                        exceptions: currentRules.exceptions.filter(
                          (_, i) => i !== index,
                        ),
                      },
                      "PUT",
                    );
                    rules.reload();
                    slots.reload();
                  }, "Wyjątek usunięty.");
                }}
              >
                Usuń wyjątek
              </Button>
            </div>
          ))}
        </Card>
        <Feedback {...action} />
      </div>
      <Card>
        <CardTitle>Najbliższe 30 dni</CardTitle>
        <LoadState {...slots} retry={slots.reload}>
          {slots.data?.length ? (
            <div className="item-list mt-5">
              {slots.data.map((slot) => (
                <div key={slot.id} className="data-row">
                  <p className="font-semibold">
                    {dateTime(slot.startsAt, slot.timezone)}
                  </p>
                  <p className="subtle">
                    {slot.timezone} ·{" "}
                    {slot.available ? "Dostępny" : "Zarezerwowany"}
                  </p>
                  {slot.available && (
                    <Button
                      variant="ghost"
                      disabled={action.busy}
                      onClick={() => {
                        void action.run(async () => {
                          await action.mutate(
                            "/mentor/availability",
                            {
                              slots: slots.data
                                ?.filter((item) => item.id !== slot.id)
                                .map((item) => ({
                                  startsAt: item.startsAt,
                                  endsAt: item.endsAt,
                                  timezone: item.timezone,
                                })),
                            },
                            "PUT",
                          );
                          slots.reload();
                        }, "Termin usunięty.");
                      }}
                    >
                      Usuń wolny termin
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="notice">
              Nie ma jeszcze opublikowanych terminów. Dodaj pierwszy z
              formularza obok.
            </p>
          )}
        </LoadState>
      </Card>
    </div>
  );
}
interface Earnings {
  grossMinor: string;
  feeMinor: string;
  netMinor: string;
  availableMinor: string;
  payouts: Payout[];
  connectAccount: { accountId: string | null; ready: boolean };
}
function EarningsPanel(): JSX.Element {
  const earnings = useResource<Earnings>("/mentor/earnings");
  const action = useAction();
  function payout(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate("/mentor/payouts", {
        amountMinor: priceMinor(formText(form, "amount")),
        currency: "PLN",
      });
      earnings.reload();
    }, "Dyspozycja wypłaty zapisana. Śledź jej status poniżej.");
  }
  return (
    <LoadState {...earnings} retry={earnings.reload}>
      {earnings.data && (
        <>
          <div className="metric-grid">
            <div className="metric">
              <strong>{money(earnings.data.grossMinor)}</strong>
              <span>Wartość sesji brutto</span>
            </div>
            <div className="metric">
              <strong>{money(earnings.data.feeMinor)}</strong>
              <span>Prowizja platformy</span>
            </div>
            <div className="metric">
              <strong>{money(earnings.data.availableMinor)}</strong>
              <span>Dostępne do wypłaty</span>
            </div>
          </div>
          <div className="panel-grid">
            <Card>
              <CardTitle>Wypłata na Twoje konto</CardTitle>
              <p className="muted text-sm mt-3">
                Dostępne są tylko rozliczone środki. Wypłata wymaga weryfikacji
                tożsamości u operatora płatności.
              </p>
              <p className="notice">
                Weryfikacja operatora:{" "}
                {earnings.data.connectAccount.ready ? "ukończona" : "wymagana"}
              </p>
              {!earnings.data.connectAccount.ready && (
                <Button
                  variant="outline"
                  disabled={action.busy}
                  onClick={() => {
                    void action.run(async () => {
                      const result = await action.mutate<{ url: string }>(
                        "/mentor/connect",
                        {},
                      );
                      window.location.assign(result.url);
                    });
                  }}
                >
                  Przejdź do weryfikacji u operatora
                </Button>
              )}
              <form className="form-stack mt-5" onSubmit={payout}>
                <TextField label="Kwota wypłaty w PLN" name="amount" />
                <Button
                  disabled={action.busy || !earnings.data.connectAccount.ready}
                >
                  Zleć wypłatę
                </Button>
              </form>
              <Feedback {...action} />
            </Card>
            <Card>
              <CardTitle>Historia wypłat</CardTitle>
              {earnings.data.payouts.length ? (
                earnings.data.payouts.map((item) => (
                  <article className="data-row" key={item.id}>
                    <p className="font-semibold">
                      {money(item.amountMinor, item.currency)}
                    </p>
                    <Status value={item.state} />
                    <p className="subtle mt-2">Numer: {item.id}</p>
                  </article>
                ))
              ) : (
                <p className="notice">Nie ma jeszcze zleconych wypłat.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </LoadState>
  );
}
