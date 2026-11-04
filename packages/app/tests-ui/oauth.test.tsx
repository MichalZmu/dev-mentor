import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, test } from "vitest";
import { AuthForm } from "../components/auth-form";
import { jsonCalls, mockApi } from "./fixtures";
import { navigation } from "./setup";

const configured = { mode: "production", oauth: { google: true } };
const buttonName = "Kontynuuj przez Google";

test("configured Google login is available for login and registration", async () => {
  mockApi({ "/config": configured });
  render(<AuthForm />);
  expect(await screen.findByRole("button", { name: buttonName })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Utwórz konto" }));
  expect(screen.getByRole("button", { name: buttonName })).toBeVisible();
});

test.each([
  undefined,
  { mode: "production", oauth: { google: false } },
  { mode: "demo" },
  null,
])("Google is hidden when not configured (%j)", async (config) => {
  const fetcher = mockApi(config === undefined ? {} : { "/config": config });
  render(<AuthForm />);
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  await act(async () => {});
  expect(
    screen.queryByRole("button", { name: buttonName }),
  ).not.toBeInTheDocument();
});

test.each(["reset", "confirm"])(
  "Google is hidden during password %s",
  async (mode) => {
    navigation.query = "mode=" + mode;
    const fetcher = mockApi({ "/config": configured });
    render(<AuthForm />);
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    await act(async () => {});
    expect(
      screen.queryByRole("button", { name: buttonName }),
    ).not.toBeInTheDocument();
  },
);

test("Google is hidden during an active MFA challenge", async () => {
  mockApi({
    "/config": configured,
    "/auth/login": { twoFactorRedirect: true },
  });
  render(<AuthForm />);
  await screen.findByRole("button", { name: buttonName });
  const form = screen
    .getByRole("button", { name: "Zaloguj się" })
    .closest("form");
  if (!form) throw new Error("Missing login form");
  fireEvent.submit(form);
  await screen.findByRole("button", { name: "Potwierdź kod" });
  expect(
    screen.queryByRole("button", { name: buttonName }),
  ).not.toBeInTheDocument();
});

test.each([
  { next: undefined, expected: "/dashboard" },
  { next: "", expected: "/dashboard" },
  {
    next: "/dashboard?tab=goals#first",
    expected: "/dashboard?tab=goals#first",
  },
  { next: "//evil.example.test", expected: "/dashboard" },
  { next: "https://evil.example.test", expected: "/dashboard" },
  { next: "/bad\\path", expected: "/dashboard" },
  { next: "/bad path", expected: "/dashboard" },
  { next: "/bad\npath", expected: "/dashboard" },
])(
  "Google sign-in sends only a safe local callback: $next",
  async ({ next, expected }) => {
    navigation.query =
      next === undefined ? "" : new URLSearchParams({ next }).toString();
    const fetcher = mockApi({
      "/config": configured,
      "/api/auth/sign-in/social": Response.json({
        url: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
      }),
    });
    render(<AuthForm />);
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    expect(
      await screen.findByText("Otwieramy stronę logowania Google."),
    ).toBeVisible();
    expect(jsonCalls(fetcher)).toEqual([
      {
        path: "/api/auth/sign-in/social",
        method: "POST",
        body: { provider: "google", callbackURL: expected },
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/sign-in/social",
      expect.objectContaining({
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  },
);

test.each([
  {
    response: Response.json(
      { url: "https://accounts.google.com/" },
      { status: 503 },
    ),
    expected: /chwilowo niedostępne/,
  },
  { response: Response.json("invalid"), expected: /chwilowo niedostępne/ },
  { response: Response.json(null), expected: /chwilowo niedostępne/ },
  { response: Response.json({}), expected: /chwilowo niedostępne/ },
  { response: Response.json({ url: 42 }), expected: /chwilowo niedostępne/ },
  {
    response: Response.json({ url: "http://accounts.google.com/" }),
    expected: /bezpiecznej strony/,
  },
  { response: Response.json({ url: "not-a-url" }), expected: /Invalid URL/ },
  {
    response: new Response("not-json", { status: 200 }),
    expected: /JSON|Unexpected token/,
  },
  { response: new Error("Provider offline"), expected: /Provider offline/ },
])(
  "Google sign-in reports provider failures and rejects unsafe replies (%j)",
  async ({ response, expected }) => {
    mockApi({ "/config": configured, "/api/auth/sign-in/social": response });
    render(<AuthForm />);
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByRole("button", { name: buttonName })).not.toBeDisabled();
    expect(
      screen.queryByText("Otwieramy stronę logowania Google."),
    ).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  },
);

test.each(["/bad path", "/bad\npath"])(
  "password login also rejects unsafe whitespace callbacks (%j)",
  async (next) => {
    navigation.query = new URLSearchParams({ next }).toString();
    mockApi({ "/auth/login": {} });
    render(<AuthForm />);
    const form = screen
      .getByRole("button", { name: "Zaloguj się" })
      .closest("form");
    if (!form) throw new Error("Missing login form");
    fireEvent.submit(form);
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith("/dashboard"),
    );
  },
);
