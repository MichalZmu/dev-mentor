import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

interface Mail {
  subject: string;
  url: string;
  createdAt: string;
}
async function registerOther(
  request: APIRequestContext,
  email: string,
  origin: string,
  clientIP: string,
): Promise<void> {
  const registration = await request.post("/api/v1/auth/register", {
    headers: { Origin: origin, "X-Forwarded-For": clientIP },
    data: {
      name: "Inny uczestnik",
      email,
      password: "E2eOnly_Password2026!",
      termsVersion: "2026-11-03",
    },
  });
  expect(registration.status()).toBe(201);
  const mailbox = await request.get("/api/v1/demo/mailbox");
  expect(mailbox.ok()).toBe(true);
  const body = (await mailbox.json()) as { data: Mail[] };
  const mail = body.data.find((item) => item.url.includes("verify-email"));
  expect(mail).toBeDefined();
  if (!mail)
    throw new Error("Brak e-maila weryfikacyjnego w lokalnej skrzynce");
  await request.get(mail.url);
  const login = await request.post("/api/v1/auth/login", {
    headers: { Origin: origin },
    data: { email, password: "E2eOnly_Password2026!" },
  });
  expect(login.ok()).toBe(true);
}

test("registration, verified session, message, booking, async demo payment, cancellation and IDOR", async ({
  page,
  playwright,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120000);
  // The harness simulates distinct clients behind the trusted ingress using
  // Better Auth's configured single-address XFF model; runtime limits stay intact.
  await page.context().setExtraHTTPHeaders({
    "X-Forwarded-For": `192.0.2.${testInfo.workerIndex + 1}`,
  });
  const origin = baseURL ?? "http://localhost:3100";
  const email = `e2e-${randomUUID()}@example.test`;
  await page.goto("/auth");
  await page.getByRole("button", { name: "Utwórz konto", exact: true }).click();
  await page.getByLabel("Imię i nazwisko").fill("Uczestnik testowy");
  await page.getByLabel("Adres e-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill("E2eOnly_Password2026!");
  await page.getByRole("checkbox").check();
  await page
    .locator("form")
    .getByRole("button", { name: "Utwórz konto", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Konto utworzone" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pokaż lokalne wiadomości demonstracyjne" })
    .click();
  await page.locator('a[href*="/api/auth/verify-email"]').first().click();
  await page.getByLabel("Adres e-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill("E2eOnly_Password2026!");
  await page
    .locator("form")
    .getByRole("button", { name: "Zaloguj się", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Cześć, Uczestnik." }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await page.goto("/mentors");
  await page
    .getByRole("link", { name: /Poznajmy się/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Napisz wiadomość" }).click();
  await expect(page).toHaveURL(/tab=messages/);
  const conversation = new URL(page.url()).searchParams.get("conversation");
  const message =
    "Chcę przygotować plan nauki TypeScript i omówić architekturę mojego projektu.";
  await page.getByLabel("Twoja wiadomość (do 2000 znaków)").fill(message);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  const sent = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/v1/conversations/${conversation}/messages`,
  );
  await page.getByRole("button", { name: "Wyślij wiadomość" }).click();
  expect((await sent).status()).toBe(201);
  const deliveredMessage = page
    .locator(".message-list article")
    .getByText(message, { exact: true });
  await expect(deliveredMessage).toBeVisible();
  await page.reload();
  await expect(deliveredMessage).toBeVisible();
  const draft = "Szkic kolejnego pytania uczestnika";
  await page.getByLabel("Twoja wiadomość (do 2000 znaków)").fill(draft);
  const reply = "Dziękuję za wiadomość. Omówimy plan nauki podczas sesji.";
  const replyClient = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: {
      "X-Forwarded-For": `198.51.100.${testInfo.workerIndex + 1}`,
    },
  });
  try {
    const login = await replyClient.post("/api/v1/auth/login", {
      headers: { Origin: origin },
      data: { email: "mentor@example.test", password: "DemoOnly_2026!" },
    });
    expect(login.ok()).toBe(true);
    const received = await replyClient.post(
      `/api/v1/conversations/${conversation}/messages`,
      {
        headers: { Origin: origin },
        data: { text: reply, clientMessageId: randomUUID() },
      },
    );
    expect(received.status()).toBe(201);
    // Keep the mentee's existing page open: only its periodic read can reveal this reply.
    const receivedMessage = page
      .locator(".message-list article")
      .getByText(reply, { exact: true });
    await expect(receivedMessage).toBeVisible({ timeout: 15_000 });
    await expect(receivedMessage).toHaveCount(1);
    await expect(
      page.getByLabel("Twoja wiadomość (do 2000 znaków)"),
    ).toHaveValue(draft);
    await expect(deliveredMessage).toBeVisible();
  } finally {
    await replyClient.dispose();
  }
  await page.goto("/mentors/demo-mentor");
  // Seeded 10:00 and 14:00 slots are disjoint even when both projects run together.
  const slotHourByProject: Record<string, string> = {
    "desktop-chromium": "10:00",
    "mobile-chromium": "14:00",
  };
  const slotHour = slotHourByProject[testInfo.project.name];
  if (!slotHour)
    throw new Error(
      `Assign a separate seeded slot hour for ${testInfo.project.name}`,
    );
  await page
    .getByRole("group", { name: "Dostępne terminy" })
    .getByRole("button", { name: new RegExp(slotHour) })
    .first()
    .click();
  await page.getByRole("button", { name: "Zarezerwuj wybrany termin" }).click();
  await page.getByRole("checkbox", { name: /Akceptuję cenę/ }).check();
  await page.getByRole("button", { name: "Przejdź do płatności" }).click();
  await expect(page).toHaveURL(/\/checkout\?order=/);
  const booking = new URL(page.url()).searchParams.get("order");
  expect(booking).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Sprawdzamy status płatności." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Potwierdź płatność demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Do zobaczenia na sesji." }),
  ).toBeVisible({ timeout: 30000 });
  await page.screenshot({
    path: testInfo.outputPath("booking-confirmed.png"),
    fullPage: true,
  });
  await page.goto(`/room/${booking}`);
  await expect(
    page.getByText("Pokój demonstracyjny", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Notatka z sesji (do 2000 znaków)")
    .fill("Prywatny wniosek uczestnika");
  await page
    .getByRole("button", { name: "Zapisz notatkę", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Twoja prywatna notatka została zapisana." }),
  ).toBeVisible();
  const mentorContext = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: {
      "X-Forwarded-For": `203.0.113.${testInfo.workerIndex + 1}`,
    },
  });
  try {
    const login = await mentorContext.request.post("/api/v1/auth/login", {
      headers: { Origin: origin },
      data: { email: "mentor@example.test", password: "DemoOnly_2026!" },
    });
    expect(login.ok()).toBe(true);
    const details = await mentorContext.request.get(
      `/api/v1/sessions/${booking}`,
    );
    expect(details.status()).toBe(200);
    expect((await details.json()) as unknown).toMatchObject({
      data: { id: booking, checkoutUrl: null, checkoutId: null },
    });
    expect(
      (await mentorContext.request.get(`/api/v1/orders/${booking}`)).status(),
    ).toBe(404);
    const mentorPage = await mentorContext.newPage();
    await mentorPage.goto(`/room/${booking}`);
    await expect(
      mentorPage.getByText("Pokój demonstracyjny", { exact: true }),
    ).toBeVisible();
    await expect(
      mentorPage.getByLabel("Notatka z sesji (do 2000 znaków)"),
    ).toHaveValue("");
    await mentorPage
      .getByLabel("Notatka z sesji (do 2000 znaków)")
      .fill("Prywatny wniosek mentora");
    await mentorPage
      .getByRole("button", { name: "Zapisz notatkę", exact: true })
      .click();
    await expect(
      mentorPage
        .getByRole("status")
        .filter({ hasText: "Twoja prywatna notatka została zapisana." }),
    ).toBeVisible();
    await mentorPage.reload();
    await expect(
      mentorPage.getByLabel("Notatka z sesji (do 2000 znaków)"),
    ).toHaveValue("Prywatny wniosek mentora");
    await page.reload();
    await expect(
      page.getByLabel("Notatka z sesji (do 2000 znaków)"),
    ).toHaveValue("Prywatny wniosek uczestnika");
    await mentorPage.screenshot({
      path: testInfo.outputPath("mentor-room.png"),
      fullPage: true,
    });
  } finally {
    await mentorContext.close();
  }
  const other = await playwright.request.newContext({ baseURL: origin });
  try {
    await registerOther(
      other,
      `other-${randomUUID()}@example.test`,
      origin,
      `198.51.100.${testInfo.workerIndex + 1}`,
    );
    const foreignBooking = await other.get(`/api/v1/orders/${booking}`);
    expect(foreignBooking.status()).toBe(404);
    expect((await other.get(`/api/v1/sessions/${booking}`)).status()).toBe(404);
    const foreignMessages = await other.get(
      `/api/v1/conversations/${conversation}/messages`,
    );
    expect(foreignMessages.status()).toBe(404);
  } finally {
    await other.dispose();
  }
  await page.goto("/dashboard?tab=sessions");
  await page
    .getByRole("button", { name: "Szczegóły i zarządzanie" })
    .first()
    .click();
  await page.getByText("Anuluj sesję", { exact: true }).click();
  await page
    .getByLabel("Powód anulowania (10–500 znaków)")
    .fill("Zmiana planów uczestnika — test anulowania i zwrotu płatności.");
  await page
    .getByRole("button", { name: "Potwierdzam anulowanie sesji" })
    .click();
  await expect(page.getByText("Anulowana", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});
