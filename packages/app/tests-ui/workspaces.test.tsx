import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { Dashboard } from "../components/dashboard";
import { AdminWorkspace } from "../components/admin-workspace";
import { MentorWorkspace } from "../components/mentor-workspace";
import { SessionsPanel } from "../components/sessions-panel";
import {
  booking,
  jsonCalls,
  mentor,
  mockApi,
  slot,
  supportCase,
  user,
} from "./fixtures";
import { navigation } from "./setup";
function submit(label: string): void {
  const form = screen.getByRole("button", { name: label }).closest("form");
  if (!form) throw new Error("Missing form");
  fireEvent.submit(form);
}
async function idle(): Promise<void> {
  await waitFor(() =>
    expect(screen.queryByText("Trwa zapisywanie…")).not.toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(screen.queryAllByText("Wczytywanie danych…")).toHaveLength(0),
  );
}

test.each([
  "overview",
  "favorites",
  "sessions",
  "goals",
  "messages",
  "billing",
  "settings",
  "support",
  "invalid",
])(
  "dashboard selects tab %s and respects elevated navigation roles",
  async (tab) => {
    navigation.query = "tab=" + tab;
    mockApi({
      "/me": { ...user, roles: ["mentee", "mentor", "admin"] },
      "/me/sessions": [
        booking,
        { ...booking, id: "completed", state: "completed" },
      ],
      "/me/dashboard": {
        nextSession: booking,
        upcomingCount: 1,
        completedCount: 1,
      },
      "/conversations": [],
      "/me/billing": { orders: [], packages: [] },
      "/me/support-tickets": [],
    });
    render(<Dashboard />);
    expect(await screen.findByText("Cześć, Anna.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Panel mentora ↗" }),
    ).toHaveAttribute("href", "/mentor");
    expect(screen.getByRole("link", { name: "Administracja ↗" })).toBeVisible();
    if (tab === "overview" || tab === "invalid")
      await screen.findByText("Czas na kolejną rozmowę.");
  },
);
test("dashboard anonymous and empty overview states", async () => {
  mockApi({ "/me": user, "/me/sessions": [] });
  render(<Dashboard />);
  expect(await screen.findByText("Twój plan zaczyna się tutaj.")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Administracja ↗" }),
  ).not.toBeInTheDocument();
});
test("sessions filters and toggles management details with private notes", async () => {
  const fetcher = mockApi({
    "/me/sessions": [
      booking,
      { ...booking, id: "held", state: "held", refundState: "pending" },
    ],
    "/sessions/booking-1/notes": { note: "Prywatna notatka" },
    ["/mentors/" + mentor.id + "/availability"]: [
      slot,
      { ...slot, id: "busy", available: false },
    ],
    "/sessions/booking-1/join": { roomUrl: "/room/booking-1" },
  });
  render(<SessionsPanel user={user} />);
  await screen.findAllByRole("button", { name: "Szczegóły i zarządzanie" });
  fireEvent.change(screen.getByLabelText("Filtruj sesje"), {
    target: { value: "confirmed" },
  });
  expect(
    screen.queryByRole("link", { name: "Sprawdź płatność" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dołącz do spotkania" }));
  await idle();
  fireEvent.click(
    screen.getByRole("button", { name: "Szczegóły i zarządzanie" }),
  );
  await screen.findByLabelText(/Wnioski z rozmowy/);
  fireEvent.change(screen.getByLabelText("Nowy termin"), {
    target: { value: slot.id },
  });
  submit("Potwierdź nowy termin");
  await idle();
  fireEvent.click(
    screen.getByRole("button", { name: "Szczegóły i zarządzanie" }),
  );
  await idle();
  submit("Potwierdzam anulowanie sesji");
  await idle();
  fireEvent.click(
    screen.getByRole("button", { name: "Szczegóły i zarządzanie" }),
  );
  await idle();
  submit("Zapisz notatkę");
  await idle();
  expect(jsonCalls(fetcher).map((call) => call.path)).toEqual(
    expect.arrayContaining([
      "/api/v1/sessions/booking-1/join",
      "/api/v1/sessions/booking-1/reschedule",
      "/api/v1/sessions/booking-1/cancel",
      "/api/v1/sessions/booking-1/notes",
    ]),
  );
  fireEvent.click(screen.getByRole("button", { name: "Zwiń szczegóły" }));
  fireEvent.change(screen.getByLabelText("Filtruj sesje"), {
    target: { value: "cancelled" },
  });
  expect(screen.getByText("Czas na pierwszy wspólny krok.")).toBeVisible();
});
test("completed mentee session accepts a public review", async () => {
  const fetcher = mockApi({
    "/me/sessions": [{ ...booking, state: "completed" }],
    "/sessions/booking-1/notes": null,
    ["/mentors/" + mentor.id + "/availability"]: [],
  });
  render(<SessionsPanel user={user} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Szczegóły i zarządzanie" }),
  );
  fireEvent.change(screen.getByLabelText("Ocena"), { target: { value: "5" } });
  submit("Opublikuj opinię");
  await idle();
  expect(jsonCalls(fetcher)[0]?.body).toMatchObject({ rating: 5 });
});
test("mentor can mark a session complete and sees slot errors", async () => {
  const fetcher = mockApi({
    "/me/sessions": [booking],
    "/sessions/booking-1/notes": {},
    ["/mentors/" + mentor.id + "/availability"]: new Error(
      "Calendar unavailable",
    ),
  });
  render(<SessionsPanel user={{ ...user, id: mentor.userId }} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Szczegóły i zarządzanie" }),
  );
  expect(await screen.findByText("Calendar unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Oznacz odbytą sesję" }));
  await idle();
  expect(jsonCalls(fetcher)[0]?.path).toBe(
    "/api/v1/sessions/booking-1/complete",
  );
});
test("admin refuses a regular account", async () => {
  mockApi({ "/me": user });
  render(<AdminWorkspace />);
  expect(
    await screen.findByText("Ta przestrzeń wymaga dodatkowych uprawnień."),
  ).toBeVisible();
});
test.each(["mentor_application", "support"])(
  "admin reviews %s cases and records a reasoned decision",
  async (kind) => {
    const item = {
      ...supportCase,
      kind,
      status: kind === "support" ? "open" : "pending",
      payload: {
        name: "Anna Nowa",
        headline: "Ekspertka",
        bio: "Opis doświadczenia",
        specialty: "Frontend",
        category: "payment",
        description: "Opis sprawy",
      },
    };
    const fetcher = mockApi({
      "/me": { ...user, roles: ["admin"] },
      "/admin/overview": { pendingApplications: 1, openTickets: 2 },
      "/admin/mentor-applications": [item],
      "/admin/support-tickets": [item],
      "/admin/cases/case-1": {
        item,
        audit: [
          {
            id: "audit",
            action: "created",
            reason: "Zgłoszono",
            actorId: user.id,
            createdAt: booking.startsAt,
          },
        ],
      },
    });
    render(<AdminWorkspace />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Otwórz sprawę" }),
    );
    await screen.findByRole("button", { name: "Zapisz decyzję" });
    fireEvent.change(screen.getByLabelText(/Uzasadnienie decyzji/), {
      target: { value: "Dane zweryfikowane poprawnie" },
    });
    submit("Zapisz decyzję");
    await idle();
    expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
      version: 1,
      action: kind === "support" ? "resolve" : "approve",
      reason: "Dane zweryfikowane poprawnie",
    });
    fireEvent.click(screen.getByRole("button", { name: "Zgłoszenia pomocy" }));
    await screen.findByRole("button", { name: "Otwórz sprawę" });
    fireEvent.click(
      screen.getByRole("button", { name: "Zgłoszenia mentorów" }),
    );
  },
);
test.each([null, "Resolved"])(
  "admin displays resolved cases and safe fallback payload fields (%s)",
  async (reason) => {
    const item = {
      ...supportCase,
      status: "resolved",
      payload: { category: "Problem" },
      decisionReason: reason,
    };
    mockApi({
      "/me": { ...user, roles: ["support"] },
      "/admin/mentor-applications": [
        item,
        { ...item, id: "other", payload: {} },
      ],
      "/admin/cases/case-1": { item, audit: [] },
    });
    render(<AdminWorkspace />);
    fireEvent.click(
      (
        await screen.findAllByRole("button", { name: "Otwórz sprawę" })
      )[0] as HTMLElement,
    );
    expect(
      await screen.findByText(/Nie zapisano jeszcze decyzji/),
    ).toBeVisible();
  },
);
test("admin queue supports an empty list", async () => {
  mockApi({
    "/me": { ...user, roles: ["moderator"] },
    "/admin/mentor-applications": [],
  });
  render(<AdminWorkspace />);
  expect(await screen.findByText(/W tej kolejce nie ma spraw/)).toBeVisible();
});
test.each([null, "pending", "approved", "rejected"])(
  "mentor applicant sees application status %s",
  async (status) => {
    const fetcher = mockApi({
      "/me": user,
      "/me/mentor-application": status
        ? { ...supportCase, status, decisionReason: "Sprawdzono profil" }
        : null,
    });
    render(<MentorWorkspace />);
    await screen.findByText("Pomóż komuś zrobić kolejny krok.");
    if (status === null) {
      await screen.findByRole("button", {
        name: "Wyślij zgłoszenie do weryfikacji",
      });
      submit("Wyślij zgłoszenie do weryfikacji");
      await idle();
      expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
        priceMinor: "18000",
        specialty: "frontend",
        termsVersion: "2026-11-03",
      });
    } else {
      await screen.findByText(new RegExp("Twoje zgłoszenie ma numer"));
      if (status === "approved")
        fireEvent.click(
          screen.getByRole("button", { name: "Otwórz swój panel mentora" }),
        );
    }
  },
);
test.each(["overview", "sessions", "messages", "unknown"])(
  "mentor workspace navigates %s",
  async (tab) => {
    navigation.query = "tab=" + tab;
    const fetcher = mockApi({
      "/me": { ...user, roles: ["mentor"] },
      "/mentor/profile": mentor,
      "/me/sessions": [],
      "/conversations": [],
    });
    render(<MentorWorkspace />);
    await screen.findByText("Twoja praktyka mentoringowa.");
    if (tab === "overview") {
      await screen.findByRole("button", { name: "Zapisz profil" });
      submit("Zapisz profil");
      await idle();
      expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
        version: mentor.version,
        priceMinor: mentor.priceMinor,
        specialty: "frontend",
      });
    }
  },
);
test.each([true, false])(
  "mentor earnings gate payouts on provider readiness (%s)",
  async (ready) => {
    navigation.query = "tab=earnings";
    const fetcher = mockApi({
      "/me": { ...user, roles: ["mentor"] },
      "/mentor/earnings": {
        grossMinor: "100000",
        feeMinor: "15000",
        netMinor: "85000",
        availableMinor: "50000",
        connectAccount: { accountId: null, ready },
        payouts: ready
          ? [
              {
                id: "payout-1",
                amountMinor: "20000",
                currency: "PLN",
                state: "pending",
              },
            ]
          : [],
      },
      "/mentor/connect": { url: "https://connect.example.test" },
    });
    render(<MentorWorkspace />);
    await screen.findByRole("button", { name: "Zleć wypłatę" });
    if (ready) {
      fireEvent.change(screen.getByLabelText("Kwota wypłaty w PLN"), {
        target: { value: "25,50" },
      });
      submit("Zleć wypłatę");
      await idle();
      expect(jsonCalls(fetcher)[0]?.body).toEqual({
        amountMinor: "2550",
        currency: "PLN",
      });
    } else {
      expect(
        screen.getByRole("button", { name: "Zleć wypłatę" }),
      ).toBeDisabled();
      fireEvent.click(
        screen.getByRole("button", {
          name: "Przejdź do weryfikacji u operatora",
        }),
      );
      await idle();
    }
  },
);
test("mentor availability persists slots, recurring rules, exceptions and deletions", async () => {
  navigation.query = "tab=availability";
  const fetcher = mockApi({
    "/me": { ...user, roles: ["mentor"] },
    "/mentor/availability": [slot, { ...slot, id: "busy", available: false }],
    "/mentor/availability/rules": {
      rules: [
        { weekday: 1, localTime: "10:00", timezone: "UTC" },
        { weekday: 2, localTime: "11:00", timezone: "UTC" },
      ],
      exceptions: [
        { localDate: "2026-12-24", available: false },
        { localDate: "2026-12-25", available: true },
      ],
    },
  });
  render(<MentorWorkspace />);
  await screen.findByRole("button", { name: "Dodaj dostępny termin" });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Dodaj dostępny termin" }),
    ).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Dzień"), {
    target: { value: "2026-12-15" },
  });
  fireEvent.change(
    screen.getAllByLabelText("Godzina lokalna")[0] as HTMLElement,
    { target: { value: "10:00" } },
  );
  submit("Dodaj dostępny termin");
  await idle();
  fireEvent.change(
    screen.getAllByLabelText("Godzina lokalna")[1] as HTMLElement,
    { target: { value: "11:00" } },
  );
  submit("Dodaj regularny termin");
  await idle();
  fireEvent.change(screen.getByLabelText("Dzień wolny od regularnych sesji"), {
    target: { value: "2026-12-26" },
  });
  submit("Zapisz wyjątek");
  await idle();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Usuń regułę" })[0] as HTMLElement,
  );
  await idle();
  fireEvent.click(screen.getByRole("button", { name: "Usuń wolny termin" }));
  await idle();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Usuń wyjątek" })[0] as HTMLElement,
  );
  await idle();
  expect(jsonCalls(fetcher)).toHaveLength(6);
  expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
    slots: expect.arrayContaining([
      expect.objectContaining({ startsAt: "2026-12-15T09:00:00.000Z" }),
    ]),
  });
});
test.each([
  {
    date: "2027-03-28",
    time: "02:30",
    ambiguity: "reject",
    error: /nie istnieje/,
  },
  {
    date: "2027-10-31",
    time: "02:30",
    ambiguity: "reject",
    error: /dwukrotnie/,
  },
  { date: "2027-10-31", time: "02:30", ambiguity: "later", error: null },
])("availability handles DST %j", async (scenario) => {
  navigation.query = "tab=availability";
  const fetcher = mockApi({
    "/me": { ...user, roles: ["mentor"] },
    "/mentor/availability": [],
    "/mentor/availability/rules": null,
  });
  render(<MentorWorkspace />);
  await screen.findByText(/Nie ma jeszcze opublikowanych terminów/);
  fireEvent.change(screen.getByLabelText("Dzień"), {
    target: { value: scenario.date },
  });
  fireEvent.change(
    screen.getAllByLabelText("Godzina lokalna")[0] as HTMLElement,
    { target: { value: scenario.time } },
  );
  fireEvent.change(
    screen.getByLabelText("Jeśli godzina występuje dwukrotnie"),
    { target: { value: scenario.ambiguity } },
  );
  submit("Dodaj dostępny termin");
  await idle();
  if (scenario.error)
    expect(screen.getByRole("alert")).toHaveTextContent(scenario.error);
  else expect(jsonCalls(fetcher)).toHaveLength(1);
});

test("availability creates recurring rules and exceptions before any exist", async () => {
  navigation.query = "tab=availability";
  const fetcher = mockApi({
    "/me": { ...user, roles: ["mentor"] },
    "/mentor/availability": null,
    "/mentor/availability/rules": null,
  });
  render(<MentorWorkspace />);
  await screen.findByText(/Nie ma jeszcze opublikowanych terminów/);
  fireEvent.change(
    screen.getAllByLabelText("Godzina lokalna")[1] as HTMLElement,
    { target: { value: "12:00" } },
  );
  submit("Dodaj regularny termin");
  await idle();
  submit("Zapisz wyjątek");
  await idle();
  expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
    exceptions: [],
    rules: [expect.objectContaining({ localTime: "12:00" })],
  });
  fireEvent.change(screen.getByLabelText("Dzień"), {
    target: { value: "2026-12-15" },
  });
  fireEvent.change(
    screen.getAllByLabelText("Godzina lokalna")[0] as HTMLElement,
    { target: { value: "10:00" } },
  );
  submit("Dodaj dostępny termin");
  await idle();
});
