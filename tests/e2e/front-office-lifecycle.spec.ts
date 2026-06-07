import { expect, type TestInfo, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expectNoPageOverflow, loginViaApi } from "./helpers";

const execFileAsync = promisify(execFile);

test.beforeEach(async () => {
  await cleanupLifecycleArtifacts();
});

test.afterEach(async () => {
  await cleanupLifecycleArtifacts();
});

function uniqueSuffix(testInfo: TestInfo) {
  return `${testInfo.project.name}-${Date.now().toString(36)}-${testInfo.workerIndex}`.replace(/[^a-z0-9-]/gi, "");
}

function dateInputFromOffset(offsetDays: number) {
  const date = new Date(Date.UTC(2035, 0, 1));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function uniqueFutureStay(testInfo: TestInfo) {
  const projectOffset = testInfo.project.name === "mobile" ? 500 : 0;
  const runOffset = Number(Date.now().toString().slice(-5)) % 300;

  return {
    checkIn: dateInputFromOffset(projectOffset + runOffset),
    checkOut: dateInputFromOffset(projectOffset + runOffset + 2),
  };
}

test("front office can check in, add an activity order, and check out with housekeeping handoff", async ({ context, page, request }, testInfo) => {
  await loginViaApi(request, context);

  const suffix = uniqueSuffix(testInfo);
  const guestName = `QA Guest Lifecycle ${suffix}`;
  const unitCode = `QA-LF-${suffix.slice(0, 12).toUpperCase()}`;
  const itemName = `QA Adventure Trek ${suffix}`;
  const { checkIn, checkOut } = uniqueFutureStay(testInfo);

  await createLifecycleFixtures(unitCode, itemName);

  await page.goto("/guests/new");
  await page.getByLabel("Nama lengkap").fill(guestName);
  await page.getByLabel("Guest type").fill("QA Lifecycle Guest");
  await page.getByLabel("Phone / WhatsApp").fill("+628123450001");
  await page.getByLabel("Email").fill(`${suffix}@lifecycle.test`);
  await page.getByLabel("Country").fill("Indonesia");
  await page.getByLabel("City").fill("Lombok");
  await page.getByLabel("Preferences").fill("Adventure itinerary and early breakfast");
  await page.getByRole("button", { name: "Simpan Guest" }).click();

  await page.waitForURL(/\/guests\/[^/?]+\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: `Guest ${guestName} berhasil dibuat.` })).toBeVisible();

  await page.goto(`/reservations/new?checkIn=${checkIn}&checkOut=${checkOut}`);
  const guestOptionValue = await page.locator('select[name="guestId"] option', { hasText: guestName }).first().getAttribute("value");
  const unitOptionValue = await page.locator('select[name="unitId"] option', { hasText: unitCode }).first().getAttribute("value");
  expect(guestOptionValue).toBeTruthy();
  expect(unitOptionValue).toBeTruthy();

  await page.locator('select[name="guestId"]').selectOption(guestOptionValue!);
  await page.locator('select[name="unitId"]').selectOption(unitOptionValue!);
  await page.getByLabel("Payment status").selectOption("PARTIAL");
  await page.getByLabel("Room rate").fill("1500000");
  await expect(page.getByLabel("Room rate")).toHaveValue("1.500.000");
  await page.getByLabel("Amount paid / deposit").fill("750000");
  await page.getByLabel("Internal notes").fill(`Lifecycle smoke ${suffix}`);
  await page.getByRole("button", { name: "Confirm Booking" }).click();

  await page.waitForURL(/\/reservations\/[^/?]+\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: "berhasil dibuat." })).toBeVisible();
  const reservationId = page.url().match(/\/reservations\/([^/?]+)/)?.[1];
  expect(reservationId).toBeTruthy();

  await page.goto(`/check-in/${reservationId}`);
  await expect(page.getByRole("heading", { name: "Check-in Wizard" })).toBeVisible();
  await expect(page.getByText(unitCode).first()).toBeVisible();
  await page.getByLabel("Final payment status").selectOption("PAID");
  await page.getByLabel("Amount paid for room").fill("3000000");
  await expect(page.getByLabel("Amount paid for room")).toHaveValue("3.000.000");
  await page.getByLabel("Payment method").selectOption("QRIS");
  await page.getByLabel("Payment reference").fill(`CHKIN-${suffix}`);
  await page.getByLabel("Check-in notes").fill("Guest arrived with activity request confirmed.");
  await page.getByRole("button", { name: "Final Check-in" }).click();

  await page.waitForURL(new RegExp(`/check-in/${reservationId}\\?done=1`));
  await expect(page.getByRole("heading", { name: "Check-in complete" })).toBeVisible();
  await expect(page.getByText("Final check-in baru saja tersimpan.")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("/orders");
  const createOrderForm = page.locator("form", { has: page.getByRole("button", { name: "Create Order" }) });
  const reservationOptionValue = await createOrderForm.locator('select[name="reservationId"] option', { hasText: guestName }).first().getAttribute("value");
  expect(reservationOptionValue).toBeTruthy();
  await createOrderForm.locator('select[name="reservationId"]').selectOption(reservationOptionValue!);
  await createOrderForm.locator("label", { hasText: itemName }).locator('input[type="number"]').fill("2");
  await createOrderForm.getByLabel("Status").selectOption("CONFIRMED");
  await createOrderForm.getByLabel("Payment").selectOption("PARTIAL");
  await createOrderForm.getByLabel("Notes").fill("Schedule trek before breakfast.");
  await createOrderForm.getByRole("button", { name: "Create Order" }).click();

  await page.waitForURL(/\/orders\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: "berhasil dibuat." })).toBeVisible();
  await expect(page.getByText(itemName).first()).toBeVisible();

  const orderRow = page.locator("tr", { hasText: itemName }).first();
  await expect(orderRow).toBeVisible();
  await orderRow.locator('select[name="status"]').selectOption("DELIVERED");
  await orderRow.locator('select[name="paymentStatus"]').selectOption("PAID");
  await orderRow.getByRole("button", { name: "Save" }).click();

  await page.waitForURL(/\/orders\?actionStatus=success/);
  const paidOrderRow = page.locator("tr", { hasText: itemName }).first();
  await expect(paidOrderRow.locator('select[name="status"]')).toHaveValue("DELIVERED");
  await expect(paidOrderRow.locator('select[name="paymentStatus"]')).toHaveValue("PAID");
  await expectNoPageOverflow(page);

  await page.goto(`/check-out/${reservationId}`);
  await expect(page.getByRole("heading", { name: "Check-out Wizard" })).toBeVisible();
  await expect(page.getByText(itemName).first()).toBeVisible();
  await page.getByLabel("Final payment status").selectOption("PAID");
  await page.getByLabel("Amount paid for room").fill("3000000");
  await page.getByLabel("Payment method").selectOption("QRIS");
  await page.getByLabel("Payment reference").fill(`CHKOUT-${suffix}`);
  await page.getByLabel("Checkout notes").fill("Guest departed, room ready for housekeeping inspection.");
  await page.getByRole("button", { name: "Final Check-out" }).click();

  await page.waitForURL(new RegExp(`/check-out/${reservationId}\\?done=1`));
  await expect(page.getByRole("heading", { name: "Check-out complete" })).toBeVisible();
  await expect(page.getByText("Final check-out baru saja tersimpan.")).toBeVisible();
  await expect(page.getByText("Checkout Cleaning - Dirty")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("/housekeeping");
  const checkoutTask = page.locator("article").filter({ hasText: unitCode }).filter({ hasText: "Checkout Cleaning" }).first();
  await expect(checkoutTask).toBeVisible();
  await expect(checkoutTask).toContainText(guestName);
});

async function createLifecycleFixtures(unitCode: string, itemName: string) {
  await execFileAsync("npx", ["tsx", "tests/e2e/create-lifecycle-fixtures.ts", unitCode, itemName], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}

async function cleanupLifecycleArtifacts() {
  await execFileAsync("npx", ["tsx", "tests/e2e/cleanup-media-artifacts.ts"], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}
