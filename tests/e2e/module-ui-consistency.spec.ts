import { expect, test } from "@playwright/test";
import { expectNoPageOverflow, loginViaApi } from "./helpers";

const moduleRoutes = [
  "/dashboard",
  "/reservations",
  "/units",
  "/housekeeping",
  "/service-requests",
  "/orders",
  "/catalog",
  "/payments",
  "/reports",
  "/activity",
  "/messages",
  "/settings",
] as const;

test("primary modules render without page-level horizontal overflow", async ({ context, page, request }) => {
  await loginViaApi(request, context);

  for (const route of moduleRoutes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expectNoPageOverflow(page);
  }
});

test("Rupiah money fields format thousands while editing", async ({ context, page, request }) => {
  await loginViaApi(request, context);

  await page.goto("/catalog");
  const priceInput = page.getByLabel("Price").first();

  await priceInput.fill("1234567");
  await expect(priceInput).toHaveValue("1.234.567");
});
