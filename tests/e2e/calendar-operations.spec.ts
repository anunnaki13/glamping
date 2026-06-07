import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { demoUsers, expectNoPageOverflow, loginViaApi } from "./helpers";

const execFileAsync = promisify(execFile);
const calendarFixtureCommand = ["tsx", "tests/e2e/create-calendar-fixtures.ts"] as const;

test.beforeEach(async () => {
  await createCalendarFixtures();
});

test.afterEach(async () => {
  await cleanupCalendarFixtures();
});

test("manager can create and release calendar maintenance blocks", async ({ context, page, request }) => {
  const calendarStart = dateKeyFromToday(0);
  const blockDate = dateKeyFromToday(7);
  const blockEnd = dateKeyFromToday(8);

  await loginViaApi(request, context, demoUsers.manager);
  await page.goto(`/calendar?start=${calendarStart}`);

  const blockCell = page.getByTestId(`calendar-cell-QA-CAL-02-${blockDate}`);
  await expect(blockCell).toBeVisible();
  await blockCell.locator("summary").filter({ hasText: "Block" }).click();
  await blockCell.getByLabel(`Block reason ${blockDate}`).fill("QA Calendar Maintenance");
  await blockCell.getByLabel(`Block notes ${blockDate}`).fill("AC service window from calendar E2E.");
  await blockCell.getByRole("button", { name: "Save Block" }).click();

  await page.waitForURL(/\/calendar\?start=.*actionStatus=success/);
  await expect(page.getByRole("status")).toContainText("berhasil diblok");
  await expect(page.getByTestId(`calendar-cell-QA-CAL-02-${blockDate}`)).toContainText("QA Calendar Maintenance");

  await page.goto(`/reservations/new?checkIn=${blockDate}&checkOut=${blockEnd}`);
  const blockedOption = page.locator('select[name="unitId"] option').filter({ hasText: "QA-CAL-02" });
  await expect(blockedOption).toHaveAttribute("disabled", "");
  await expect(blockedOption).toContainText("Date blocked");

  await page.goto(`/calendar?start=${calendarStart}`);
  const releaseCell = page.getByTestId(`calendar-cell-QA-CAL-02-${blockDate}`);
  await releaseCell.getByRole("button", { name: "Release" }).click();

  await page.waitForURL(/\/calendar\?start=.*actionStatus=success/);
  await expect(page.getByRole("status")).toContainText("berhasil dibuka");
  await expect(page.getByTestId(`calendar-cell-QA-CAL-02-${blockDate}`)).not.toContainText("QA Calendar Maintenance");
  await expectNoPageOverflow(page);
});

test("front office can reschedule confirmed reservations from the calendar", async ({ context, page, request }) => {
  const calendarStart = dateKeyFromToday(0);
  const moveDate = dateKeyFromToday(5);

  await loginViaApi(request, context, demoUsers.frontOffice);
  await page.goto(`/calendar?start=${calendarStart}`);

  const sourceCell = page.getByTestId(`calendar-cell-QA-CAL-01-${moveDate}`);
  await expect(sourceCell).toContainText("QA-CAL-1001");
  await sourceCell.locator("summary").filter({ hasText: "Move" }).click();
  await sourceCell.getByLabel("Move QA-CAL-1001 unit").selectOption({ label: "QA-CAL-02" });
  await sourceCell.getByRole("button", { name: "Save Move" }).click();

  await page.waitForURL(/\/calendar\?start=.*actionStatus=success/);
  await expect(page.getByRole("status")).toContainText("berhasil di-reschedule");
  await expect(page.getByTestId(`calendar-cell-QA-CAL-02-${moveDate}`)).toContainText("QA-CAL-1001");
  await expect(page.getByTestId(`calendar-cell-QA-CAL-01-${moveDate}`)).not.toContainText("QA-CAL-1001");
  await expect(page.getByRole("button", { name: "Save Block" })).toHaveCount(0);
  await expectNoPageOverflow(page);
});

async function createCalendarFixtures() {
  await execFileAsync("npx", [...calendarFixtureCommand], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}

async function cleanupCalendarFixtures() {
  await execFileAsync("npx", [...calendarFixtureCommand, "cleanup"], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}

function dateKeyFromToday(offsetDays: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
