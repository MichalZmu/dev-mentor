import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { FavoritesPanel } from "../components/favorites-panel";
import { SettingsPanel, SupportPanel } from "../components/account-panels";
import { DevelopmentPanel } from "../components/development-panel";
import { BillingPanel } from "../components/billing-panel";
import { SessionRoom } from "../components/session-room";
import { MessagesPanel } from "../components/messages-panel";
import {
  booking,
  mentor,
  jsonCalls,
  mockApi,
  pack,
  supportCase,
  user,
} from "./fixtures";
import { navigation } from "./setup";

function submit(label: string): void {
  const control = screen.getByRole("button", { name: label });
  const form = control.closest("form");
  if (!form) throw new Error("Missing form");
  fireEvent.submit(form);
}
async function saved(
  fetcher: ReturnType<typeof mockApi>,
  path: string,
): Promise<void> {
  await waitFor(() =>
    expect(jsonCalls(fetcher).some((call) => call.path === path)).toBe(true),
  );
  await waitFor(() =>
    expect(screen.queryByText("Trwa zapisywanie…")).not.toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(screen.queryAllByText("Wczytywanie danych…")).toHaveLength(0),
  );
}

test("support submits optional session association and displays responses", async () => {
  const fetcher = mockApi({
    "/me/support-tickets": [
      supportCase,
      {
        ...supportCase,
        id: "case-2",
        payload: { description: 4 },
        decisionReason: "Wyjaśniono sprawę",
      },
    ],
  });
  render(<SupportPanel />);
  expect(
    await screen.findByText("Potrzebuję wyjaśnienia płatności."),
  ).toBeVisible();
  expect(screen.getByText(/Wyjaśniono/)).toBeVisible();
  fireEvent.change(screen.getByLabelText(/Opis sprawy/), {
    target: { value: "Opis sprawy wymagającej pomocy" },
  });
  submit("Wyślij zgłoszenie");
  await saved(fetcher, "/api/v1/support-tickets");
  expect(jsonCalls(fetcher)[0]?.body).not.toHaveProperty("sessionId");
  fireEvent.change(screen.getByLabelText(/Numer sesji/), {
    target: { value: "booking-1" },
  });
  submit("Wyślij zgłoszenie");
  await waitFor(() => expect(jsonCalls(fetcher)).toHaveLength(2));
  expect(jsonCalls(fetcher)[1]?.body).toHaveProperty("sessionId", "booking-1");
});
test("support presents an empty history", async () => {
  mockApi({ "/me/support-tickets": [] });
  render(<SupportPanel />);
  expect(await screen.findByText(/Nie masz jeszcze zgłoszeń/)).toBeVisible();
});
test("settings persists notifications and timezone, then logs out", async () => {
  const reload = vi.fn();
  const fetcher = mockApi();
  render(<SettingsPanel user={user} reload={reload} />);
  fireEvent.change(screen.getByLabelText("Strefa czasowa"), {
    target: { value: "UTC" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  submit("Zapisz ustawienia");
  await saved(fetcher, "/api/v1/me");
  expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
    timezone: "UTC",
    preferences: { notifications: false },
    version: 1,
  });
  expect(reload).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: /Wyloguj/ }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/"));
  expect(navigation.refresh).toHaveBeenCalledOnce();
});
test.each([
  new Response("{}", { status: 400 }),
  Response.json(null),
  Response.json([]),
  Response.json({ totpURI: 5 }),
])("settings refuses invalid TOTP responses", async (response) => {
  mockApi({ "/api/auth/two-factor/enable": response });
  render(
    <SettingsPanel
      user={{ ...user, preferences: { notifications: false } }}
      reload={vi.fn()}
    />,
  );
  submit("Włącz uwierzytelnianie dwuskładnikowe");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Nie udało się uruchomić/,
  );
});
test("settings enables TOTP and permits retry after invalid code", async () => {
  const fetcher = mockApi({
    "/api/auth/two-factor/enable": Response.json({
      totpURI: "otpauth://totp/Test",
      backupCodes: ["backup-one", "backup-two"],
    }),
    "/api/auth/two-factor/verify-totp": new Response(null, { status: 400 }),
  });
  render(<SettingsPanel user={user} reload={vi.fn()} />);
  submit("Włącz uwierzytelnianie dwuskładnikowe");
  expect(await screen.findByText("otpauth://totp/Test")).toBeVisible();
  expect(screen.getByText("backup-one")).toBeVisible();
  expect(screen.getByText("backup-two")).toBeVisible();
  submit("Potwierdź konfigurację");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Nieprawidłowy kod.",
  );
  fetcher.mockImplementationOnce(async () => Response.json({ success: true }));
  submit("Potwierdź konfigurację");
  await waitFor(() =>
    expect(screen.queryByText("otpauth://totp/Test")).not.toBeInTheDocument(),
  );
});
test("development saves goals and tracks completed milestones", async () => {
  const fetcher = mockApi({
    "/me/goals": {
      goal: "skills",
      level: "advanced",
      description: "Rozwijam umiejętności TypeScript",
    },
    "/me/learning-plan": {
      id: "plan-1",
      goal: "skills",
      version: 3,
      milestones: [
        { id: "step-1", title: "Testy", completed: false },
        { id: "step-2", title: "Typy", completed: true },
      ],
    },
  });
  render(<DevelopmentPanel />);
  expect(await screen.findByRole("progressbar")).toHaveAttribute("value", "1");
  submit("Zapisz swój cel");
  await saved(fetcher, "/api/v1/me/goals");
  expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
    goal: "skills",
    level: "advanced",
  });
  fireEvent.click(screen.getByLabelText("Testy"));
  await saved(fetcher, "/api/v1/learning-plans/plan-1/milestones/step-1");
  expect(jsonCalls(fetcher)[1]?.body).toEqual({ completed: true, version: 3 });
});
test("development starts with default goals and no plan", async () => {
  mockApi({ "/me/goals": null, "/me/learning-plan": null });
  render(<DevelopmentPanel />);
  expect(
    await screen.findByRole("button", { name: "Zapisz swój cel" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Główny cel")).toHaveValue("career");
  expect(screen.getByText(/Uzupełnij swój cel/)).toBeVisible();
});
test("billing shows states and allows pause, resume and cancel without auto renewal", async () => {
  const fetcher = mockApi({
    "/me/billing": {
      orders: [
        booking,
        { ...booking, id: "refunded", refundState: "succeeded" },
      ],
      packages: [
        pack,
        { ...pack, id: "paused", state: "paused", paymentState: "pending" },
        { ...pack, id: "cancelled", state: "cancelled" },
      ],
    },
  });
  render(<BillingPanel />);
  await screen.findByRole("button", { name: "Wstrzymaj" });
  for (const label of ["Wstrzymaj", "Wznów"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: label })).not.toBeDisabled(),
    );
  }
  fireEvent.click(
    screen.getAllByRole("button", {
      name: "Zrezygnuj z dalszego planu",
    })[0] as HTMLElement,
  );
  await waitFor(() => expect(jsonCalls(fetcher)).toHaveLength(3));
  expect(
    jsonCalls(fetcher).map((call) => (call.body as { action: string }).action),
  ).toEqual(["pause", "resume", "cancel"]);
});
test.each([null, { orders: [], packages: [] }])(
  "billing explains empty data and starts package checkout (%j)",
  async (data) => {
    const fetcher = mockApi({ "/me/billing": data, "/subscriptions": pack });
    render(<BillingPanel />);
    expect(await screen.findByText(/Nie masz jeszcze pakietów/)).toBeVisible();
    submit("Wybierz pakiet 4 sesji");
    await saved(fetcher, "/api/v1/subscriptions");
    expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
      packageSize: 4,
      autoRenew: false,
    });
  },
);
test("session room saves private notes", async () => {
  const fetcher = mockApi({
    "/sessions/booking-1": booking,
    "/sessions/booking-1/notes": { note: "Ważny wniosek" },
  });
  render(<SessionRoom id="booking-1" />);
  expect(await screen.findByLabelText(/Notatka z sesji/)).toHaveValue(
    "Ważny wniosek",
  );
  submit("Zapisz notatkę");
  await saved(fetcher, "/api/v1/sessions/booking-1/notes");
  expect(jsonCalls(fetcher)[0]?.body).toEqual({ note: "Ważny wniosek" });
  expect(
    fetcher.mock.calls.some(
      ([path]) => String(path) === "/api/v1/sessions/booking-1",
    ),
  ).toBe(true);
  expect(
    fetcher.mock.calls.some(([path]) => String(path).includes("/orders/")),
  ).toBe(false);
});
test("session room handles missing notes and booking", async () => {
  mockApi({
    "/sessions/booking-1": booking,
    "/sessions/booking-1/notes": null,
  });
  const view = render(<SessionRoom id="booking-1" />);
  expect(await screen.findByLabelText(/Notatka z sesji/)).toHaveValue("");
  view.unmount();
  mockApi({ "/sessions/missing": null });
  render(<SessionRoom id="missing" />);
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
  expect(screen.queryByText("Pokój demonstracyjny")).not.toBeInTheDocument();
});
test("messages show participants, pagination and send new messages", async () => {
  const conversations = [
    { id: "conversation-1", mentorName: "Jan Mentor" },
    { id: "conversation-2", mentorName: "Inny Mentor" },
  ];
  const messages = [
    {
      id: "msg-1",
      senderId: user.id,
      text: "Moja wiadomość",
      createdAt: booking.startsAt,
    },
    {
      id: "msg-2",
      senderId: "other",
      text: "Odpowiedź mentora",
      createdAt: booking.startsAt,
    },
  ];
  const fetcher = mockApi({
    "/conversations": conversations,
    "/conversations/conversation-1/messages": Response.json({
      data: messages,
      nextCursor: "older",
    }),
    "/conversations/conversation-2/messages": [],
  });
  render(<MessagesPanel user={user} />);
  expect(await screen.findByText("Odpowiedź mentora")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Starsze wiadomości" }));
  await screen.findByRole("button", { name: "Najnowsze wiadomości" });
  fireEvent.click(screen.getByRole("button", { name: "Najnowsze wiadomości" }));
  fireEvent.click(await screen.findByRole("button", { name: "Odśwież" }));
  fireEvent.change(screen.getByLabelText(/Twoja wiadomość/), {
    target: { value: "Dziękuję za pomoc" },
  });
  submit("Wyślij wiadomość");
  await saved(fetcher, "/api/v1/conversations/conversation-1/messages");
  expect(jsonCalls(fetcher)[0]?.body).toMatchObject({
    text: "Dziękuję za pomoc",
    clientMessageId: expect.any(String),
  });
  fireEvent.click(screen.getByRole("button", { name: /Inny Mentor/ }));
  expect(await screen.findByText(/To początek rozmowy/)).toBeVisible();
});
test("messages uses query selection and shows empty conversations", async () => {
  navigation.query = "conversation=selected";
  mockApi({ "/conversations": [] });
  render(<MessagesPanel user={user} />);
  expect(await screen.findByText("Zacznijmy od kontaktu.")).toBeVisible();
});

test("messages retry retains a client message id for the same draft", async () => {
  const fetcher = mockApi({
    "/conversations": [{ id: "conv", mentorName: "Jan" }],
    "/conversations/conv/messages": [],
  });
  fetcher.mockImplementation(async (input, options) =>
    options?.method
      ? Response.json(
          { error: { message: "Retry", code: "RETRY" } },
          { status: 503 },
        )
      : Response.json({
          data: String(input).endsWith("/conversations")
            ? [{ id: "conv", mentorName: "Jan" }]
            : [],
        }),
  );
  render(<MessagesPanel user={user} />);
  await screen.findByLabelText(/Twoja wiadomość/);
  fireEvent.change(screen.getByLabelText(/Twoja wiadomość/), {
    target: { value: "Moja wiadomość" },
  });
  submit("Wyślij wiadomość");
  await screen.findByRole("alert");
  submit("Wyślij wiadomość");
  await waitFor(() => expect(jsonCalls(fetcher)).toHaveLength(2));
  expect(jsonCalls(fetcher)[0]?.body).toEqual(jsonCalls(fetcher)[1]?.body);
});

test.each([
  { totpURI: "otpauth://totp/NoCodes" },
  { totpURI: "otpauth://totp/NoCodes", backupCodes: "invalid" },
  {
    totpURI: "otpauth://totp/NoCodes",
    backupCodes: [123, null, "valid-backup"],
  },
])(
  "TOTP only displays recovery codes validated from the enable response (%j)",
  async (body) => {
    mockApi({ "/api/auth/two-factor/enable": Response.json(body) });
    render(<SettingsPanel user={user} reload={vi.fn()} />);
    submit("Włącz uwierzytelnianie dwuskładnikowe");
    await screen.findByText("otpauth://totp/NoCodes");
    if (Array.isArray(body.backupCodes))
      expect(screen.getByText("valid-backup")).toBeVisible();
    else
      expect(
        screen.queryByText(/Zapisz kody odzyskiwania/),
      ).not.toBeInTheDocument();
  },
);

test.each([true, false])(
  "settings requires successful email-change confirmation (%s)",
  async (ok) => {
    const fetcher = mockApi({
      "/api/auth/change-email": new Response(null, { status: ok ? 200 : 400 }),
    });
    render(<SettingsPanel user={user} reload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nowy adres e-mail"), {
      target: { value: "new@example.test" },
    });
    submit("Poproś o zmianę adresu");
    if (ok)
      expect(
        await screen.findByText(/Sprawdź wiadomości na dotychczasowym/),
      ).toBeVisible();
    else
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Nie udało się rozpocząć zmiany/,
      );
    expect(jsonCalls(fetcher)[0]?.body).toEqual({
      newEmail: "new@example.test",
      callbackURL: "/auth",
    });
  },
);
test("favorites allows removal with explicit DELETE and explains empty data", async () => {
  const fetcher = mockApi({ "/me/favorites": [mentor] });
  const view = render(<FavoritesPanel />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Usuń z ulubionych" }),
  );
  await saved(fetcher, "/api/v1/favorites/mentor-1");
  expect(jsonCalls(fetcher)[0]?.method).toBe("DELETE");
  view.unmount();
  mockApi({ "/me/favorites": [] });
  render(<FavoritesPanel />);
  expect(await screen.findByText(/Zapisz interesujące osoby/)).toBeVisible();
});
