import { expect, test } from "@playwright/test";
import { expectNoPageOverflow, loginViaApi } from "./helpers";

test("reservation invoice shows folio totals and print controls", async ({ context, page, request }) => {
  await loginViaApi(request, context);
  await page.goto("/reservations");
  await page.locator("a", { hasText: "NE250523-0012" }).first().click();
  await page.getByRole("link", { name: "Invoice" }).click();

  await expect(page.getByRole("heading", { name: "INV-NE250523-0012" })).toBeVisible();
  await expect(page.getByText("Balance due")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print Invoice" })).toBeVisible();
  await expectNoPageOverflow(page);
});
