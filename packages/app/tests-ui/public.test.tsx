import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { Catalog, MentorCard } from "../components/catalog";
import { AuthForm } from "../components/auth-form";
import { MentorProfile } from "../components/mentor-profile";
import { CheckoutStatus } from "../components/checkout-status";
import { booking, jsonCalls, mentor, mockApi, slot } from "./fixtures";
import { navigation } from "./setup";
function submit(label: string): void {
  const button = screen.getByRole("button", { name: label });
  const form = button.closest("form");
  if (!form) throw new Error("Missing form");
  fireEvent.submit(form);
}
async function completed(): Promise<void> {
  await waitFor(() =>
    expect(screen.queryByText("Trwa zapisywanie…")).not.toBeInTheDocument(),
  );
}

test("catalog filters by all criteria and pages through result cursors", async () => {
  navigation.query = "q=typescript";
  const fetcher = mockApi({
    "/mentors": Response.json({ data: [mentor], nextCursor: "next-page" }),
  });
  render(<Catalog />);
  expect(
    await screen.findByRole("heading", { name: mentor.name }),
  ).toBeVisible();
  expect(screen.getByLabelText("Czego chcesz się nauczyć?")).toHaveValue(
    "typescript",
  );
  fireEvent.change(screen.getByLabelText("Specjalizacja"), {
    target: { value: "frontend" },
  });
  fireEvent.change(screen.getByLabelText("Język"), { target: { value: "en" } });
  fireEvent.change(screen.getByLabelText(/Budżet/), {
    target: { value: "250" },
  });
  submit("Znajdź");
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([path]) =>
        String(path).includes("maxPriceMinor=25000"),
      ),
    ).toBe(true),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Następna strona" }),
  );
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([path]) =>
        String(path).includes("cursor=next-page"),
      ),
    ).toBe(true),
  );
});
test("catalog clears filters and explains empty results", async () => {
  const fetcher = mockApi({ "/mentors": [] });
  render(<Catalog />);
  expect(
    await screen.findByText("Jeszcze nie ma takiego dopasowania."),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Pokaż wszystkich mentorów" }),
  );
  submit("Znajdź");
  expect(fetcher).toHaveBeenCalled();
});
test("new mentor card avoids presenting a nonexistent rating", () => {
  render(<MentorCard mentor={{ ...mentor, rating: 0 }} />);
  expect(screen.getByText(/Nowy mentor/)).toBeVisible();
});
test.each([
  "/dashboard?tab=goals",
  "//evil.test",
  "https://evil.test",
  "/bad\\path",
  "",
])("login constrains next redirect %s", async (next) => {
  navigation.query = new URLSearchParams({ next }).toString();
  const fetcher = mockApi({
    "/config": { mode: "production" },
    "/auth/login": {},
  });
  render(<AuthForm />);
  submit("Zaloguj się");
  await waitFor(() =>
    expect(navigation.push).toHaveBeenCalledWith(
      next === "/dashboard?tab=goals" ? next : "/dashboard",
    ),
  );
  expect(jsonCalls(fetcher)[0]?.path).toBe("/api/v1/auth/login");
});
test("registration accepts policy and exposes the demo verification mailbox", async () => {
  const fetcher = mockApi({
    "/config": { mode: "production" },
    "/auth/register": {
      emailVerificationRequired: true,
      demoMailboxAvailable: true,
      verificationUrl: "/verify?token=test",
    },
    "/demo/mailbox": [
      {
        subject: "Potwierdź konto",
        url: "/verify",
        createdAt: booking.startsAt,
      },
    ],
  });
  render(<AuthForm />);
  fireEvent.click(screen.getByRole("button", { name: "Utwórz konto" }));
  fireEvent.change(screen.getByLabelText("Imię i nazwisko"), {
    target: { value: "Anna Nowa" },
  });
  const form = screen.getByLabelText("Imię i nazwisko").closest("form");
  if (!form) throw new Error("Missing registration");
  fireEvent.submit(form);
  expect(
    await screen.findByRole("link", {
      name: "Otwórz potwierdzenie adresu e-mail",
    }),
  ).toHaveAttribute("href", "/verify?token=test");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(jsonCalls(fetcher)[0]?.body).toHaveProperty(
    "termsVersion",
    "2026-11-03",
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Pokaż lokalne wiadomości demonstracyjne",
    }),
  );
  expect(
    await screen.findByRole("link", { name: "Potwierdź konto" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Logowanie" }));
  expect(screen.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
});
test.each([[], new Error("Mailbox unavailable")])(
  "demo mailbox handles empty and failed messages",
  async (messages) => {
    mockApi({ "/config": { mode: "demo" }, "/demo/mailbox": messages });
    render(<AuthForm />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Pokaż lokalne wiadomości demonstracyjne",
      }),
    );
    expect(
      await screen.findByText(
        messages instanceof Error
          ? "Mailbox unavailable"
          : /Nie ma jeszcze wiadomości/,
      ),
    ).toBeVisible();
  },
);
test("password reset can be requested from login", async () => {
  const fetcher = mockApi({ "/config": { mode: "production" } });
  render(<AuthForm />);
  fireEvent.click(screen.getByRole("button", { name: "Nie pamiętam hasła" }));
  submit("Wyślij instrukcję");
  expect(await screen.findByText(/Jeśli konto istnieje/)).toBeVisible();
  expect(jsonCalls(fetcher)[0]?.path).toBe("/api/v1/auth/password-reset");
});
test.each(["confirm", "confirm&token=link-token"])(
  "password reset confirmation accepts link and typed token (%s)",
  async (mode) => {
    navigation.query = "mode=" + mode;
    const fetcher = mockApi({ "/config": { mode: "production" } });
    render(<AuthForm />);
    if (mode === "confirm")
      fireEvent.change(screen.getByLabelText("Token z wiadomości"), {
        target: { value: "typed-token" },
      });
    submit("Zmień hasło");
    await screen.findByRole("button", { name: "Zaloguj się" });
    expect(jsonCalls(fetcher)[0]?.body).toHaveProperty(
      "token",
      mode === "confirm" ? "typed-token" : "link-token",
    );
  },
);
test("initial reset mode and MFA challenge show correct forms and retry invalid codes", async () => {
  navigation.query = "mode=reset";
  const view = render(<AuthForm />);
  expect(screen.getByText("Odzyskaj dostęp.")).toBeVisible();
  view.unmount();
  navigation.query = "";
  const fetcher = mockApi({
    "/auth/login": { twoFactorRedirect: true },
    "/api/auth/two-factor/verify-totp": new Response(null, { status: 400 }),
  });
  render(<AuthForm />);
  submit("Zaloguj się");
  await screen.findByRole("button", { name: "Potwierdź kod" });
  submit("Potwierdź kod");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Kod jest niepoprawny/,
  );
  fetcher.mockImplementationOnce(async () => Response.json({ success: true }));
  submit("Potwierdź kod");
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/admin"));
  expect(navigation.refresh).toHaveBeenCalledOnce();
});
test("profile reserves available slots, messages, favorites, and starts checkout", async () => {
  const fetcher = mockApi({
    ["/mentors/" + mentor.id]: mentor,
    ["/mentors/" + mentor.id + "/reviews"]: [
      {
        id: "review-1",
        rating: 5,
        comment: "Polecam wspólną pracę",
        authorName: "Anna",
        createdAt: booking.startsAt,
      },
    ],
    ["/mentors/" + mentor.id + "/availability"]: [
      slot,
      { ...slot, id: "taken", available: false },
    ],
    "/booking-holds": booking,
    "/checkout-sessions": booking,
    "/conversations": { id: "conversation-1" },
  });
  render(<MentorProfile id={mentor.id} />);
  await screen.findByRole("heading", { name: mentor.name });
  fireEvent.click(screen.getByRole("button", { name: "Napisz wiadomość" }));
  await waitFor(() =>
    expect(navigation.push).toHaveBeenCalledWith(
      "/dashboard?tab=messages&conversation=conversation-1",
    ),
  );
  await completed();
  fireEvent.click(screen.getByRole("button", { name: "Zapisz w ulubionych" }));
  await completed();
  const slots = screen.getByRole("group", { name: "Dostępne terminy" });
  fireEvent.click(slots.querySelector("button") as HTMLElement);
  fireEvent.click(
    screen.getByRole("button", { name: "Zarezerwuj wybrany termin" }),
  );
  await screen.findByRole("heading", { name: "Sprawdź swoją sesję" });
  await completed();
  fireEvent.change(screen.getByLabelText("Sposób płatności"), {
    target: { value: "credit" },
  });
  fireEvent.change(screen.getByLabelText("Sposób płatności"), {
    target: { value: "psp" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Przejdź do płatności" }));
  await waitFor(() =>
    expect(
      jsonCalls(fetcher).some(
        (call) => call.path === "/api/v1/checkout-sessions",
      ),
    ).toBe(true),
  );
  expect(
    jsonCalls(fetcher).find((call) => call.path === "/api/v1/checkout-sessions")
      ?.body,
  ).toMatchObject({
    holdId: booking.id,
    acceptedPolicyVersion: booking.policyVersion,
  });
});
test("profile explains absent reviews and slots", async () => {
  mockApi({
    ["/mentors/" + mentor.id]: mentor,
    ["/mentors/" + mentor.id + "/reviews"]: [],
    ["/mentors/" + mentor.id + "/availability"]: [],
  });
  render(<MentorProfile id={mentor.id} />);
  expect(await screen.findByText(/To początek historii/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Zarezerwuj wybrany termin" }),
  ).toBeDisabled();
});
test("checkout requires an order id", () => {
  mockApi();
  render(<CheckoutStatus />);
  expect(screen.getByText(/Brakuje numeru/)).toBeVisible();
});
test.each([
  {
    paymentState: "paid",
    state: "confirmed",
    mode: "demo",
    refundState: "none",
  },
  {
    paymentState: "paid",
    state: "active",
    mode: "production",
    refundState: "succeeded",
  },
  {
    paymentState: "pending",
    state: "held",
    mode: "production",
    refundState: "none",
  },
  {
    paymentState: "failed",
    state: "expired",
    mode: "demo",
    refundState: undefined,
  },
])("checkout displays payment and booking states %j", async (options) => {
  navigation.query = "order=booking-1";
  const fetcher = mockApi({
    "/orders/booking-1": {
      ...booking,
      ...options,
      checkoutUrl: "https://checkout.example.test",
    },
    "/config": { mode: options.mode },
  });
  render(<CheckoutStatus />);
  await screen.findByText("Numer: booking-1");
  if (options.paymentState === "paid")
    expect(
      screen.queryByRole("button", { name: "Potwierdź płatność demo" }),
    ).not.toBeInTheDocument();
  else if (options.mode === "demo") {
    fireEvent.click(
      screen.getByRole("button", { name: "Potwierdź płatność demo" }),
    );
    await waitFor(() =>
      expect(jsonCalls(fetcher)[0]?.path).toBe(
        "/api/v1/demo/payments/booking-1",
      ),
    );
  } else
    expect(
      screen.getByRole("link", { name: /Otwórz bezpieczną/ }),
    ).toHaveAttribute("href", "https://checkout.example.test");
  fireEvent.click(
    await screen.findByRole("button", { name: "Sprawdź ponownie" }),
  );
});
