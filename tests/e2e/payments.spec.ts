import { expect, test } from "@playwright/test";
import { demoUsers, expectNoPageOverflow, loginViaApi } from "./helpers";

test("owner can post a reservation payment ledger transaction", async ({ context, page, request }) => {
  await loginViaApi(request, context);
  await page.goto("/payments");
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();

  const reference = `E2E-PAY-${Date.now()}`;
  const reservationSelect = page.getByLabel("Reservation");
  const reservationId = await reservationSelect.locator("option", { hasText: "NE250523-0019" }).first().getAttribute("value");
  expect(reservationId).toBeTruthy();

  await reservationSelect.selectOption(reservationId!);
  await page.getByLabel("Type").selectOption("PAYMENT");
  await page.getByLabel("Method").selectOption("BANK_TRANSFER");
  await page.getByLabel("Amount").fill("123456");
  await page.getByLabel("Reference").fill(reference);
  await page.getByLabel("Note").fill("E2E ledger payment smoke");
  await page.getByRole("button", { name: "Post Transaction" }).click();

  await page.waitForURL(/\/payments\?actionStatus=success/);
  await expect(page.getByRole("status")).toContainText("berhasil diposting");
  await expect(page.getByText(reference)).toBeVisible();
  await expectNoPageOverflow(page);
});

test("F&B role cannot access stay payment ledger", async ({ context, page, request }) => {
  await loginViaApi(request, context, demoUsers.fnb);
  await page.goto("/payments");
  await expect(page).toHaveURL(/\/dashboard\?actionStatus=error/);
  await expect(page.getByRole("alert")).toContainText("Anda tidak memiliki akses");
});
