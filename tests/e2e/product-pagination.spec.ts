import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

async function registerPaginationOwner(
  request: APIRequestContext,
  origin: string,
  clientIP: string,
): Promise<void> {
  const email = `pagination-${randomUUID()}@example.test`;
  const password = "E2eOnly_Pagination2026!";
  const registration = await request.post("/api/v1/auth/register", {
    headers: { Origin: origin, "X-Forwarded-For": clientIP },
    data: {
      name: "Test paginacji",
      email,
      password,
      termsVersion: "2026-11-03",
    },
  });
  expect(registration.status()).toBe(201);
  const mailbox = await request.get("/api/v1/demo/mailbox");
  expect(mailbox.ok()).toBe(true);
  const body = (await mailbox.json()) as { data: { url: string | null }[] };
  const verification = body.data.find((mail) =>
    mail.url?.includes("verify-email"),
  )?.url;
  expect(verification).toBeTruthy();
  if (!verification)
    throw new Error("Brak wiadomości weryfikacyjnej dla konta testowego");
  const verified = await request.get(verification);
  expect(verified.ok()).toBe(true);
  const login = await request.post("/api/v1/auth/login", {
    headers: { Origin: origin },
    data: { email, password },
  });
  expect(login.ok()).toBe(true);
}

test("support pagination reaches every real ticket, supports keyboard/back navigation and canonical catalog filters", async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(120000);
  const origin = baseURL ?? "http://127.0.0.1:3100";
  const request = page.context().request;
  // Synthetic addresses represent separate clients at the trusted test ingress.
  await registerPaginationOwner(
    request,
    origin,
    `192.0.2.${testInfo.workerIndex + 101}`,
  );
  const ids: string[] = [];
  for (let index = 0; index < 22; index++) {
    const created = await request.post("/api/v1/support-tickets", {
      headers: { Origin: origin },
      data: {
        category: "other",
        description: `Prawdziwe zgłoszenie paginacji numer ${index + 1}: kontrola dostępu do dalszej strony.`,
      },
    });
    expect(created.status()).toBe(201);
    const body = (await created.json()) as { data: { id: string } };
    ids.push(body.data.id);
  }
  await page.goto("/dashboard?tab=support");
  const tickets = page.locator('section[data-slot="card"]').filter({
    has: page.getByRole("heading", { name: "Twoje zgłoszenia", exact: true }),
  });
  const rows = tickets.locator("article.data-row");
  await expect(rows).toHaveCount(20);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  const firstIds = (await rows.locator("p.subtle").allTextContents()).map(
    (text) => text.replace("Numer: ", "").trim(),
  );
  const navigation = tickets.getByRole("navigation", {
    name: "Stronicowanie: Twoje zgłoszenia",
    exact: true,
  });
  const next = navigation.getByRole("button", {
    name: "Następna strona",
    exact: true,
  });
  await next.focus();
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(navigation.getByRole("status")).toHaveText("Strona 2");
  await expect(rows).toHaveCount(2);
  const secondIds = (await rows.locator("p.subtle").allTextContents()).map(
    (text) => text.replace("Numer: ", "").trim(),
  );
  expect([...firstIds, ...secondIds].sort()).toEqual(ids.sort());
  expect(new Set([...firstIds, ...secondIds]).size).toBe(22);
  await expect(next).toBeDisabled();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await page.screenshot({
    path: testInfo.outputPath("support-page-two.png"),
    fullPage: true,
  });
  await navigation
    .getByRole("button", { name: "Poprzednia strona", exact: true })
    .click();
  await expect(rows).toHaveCount(20);
  expect(
    (await rows.locator("p.subtle").allTextContents()).map((text) =>
      text.replace("Numer: ", "").trim(),
    ),
  ).toEqual(firstIds);
  await expect(navigation.getByRole("status")).toHaveText("Strona 1");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await page.goto("/mentors");
  await page
    .getByRole("combobox", { name: "Specjalizacja", exact: true })
    .selectOption("frontend");
  await page.getByRole("button", { name: "Znajdź", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Anna Kowalska", exact: true }),
  ).toBeVisible();
});
