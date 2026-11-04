import { expect, test } from "@playwright/test";

test("public navigation supports keyboard, mobile and real mentor catalog", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Twój kolejny",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Przejdź do treści" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByRole("link", { name: "Znajdź swojego mentora" }).click();
  await expect(page).toHaveURL(/\/mentors$/);
  await expect(
    page.getByRole("heading", { name: "Znajdź swojego mentora." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Poznajmy się/ }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "Zaloguj się", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
