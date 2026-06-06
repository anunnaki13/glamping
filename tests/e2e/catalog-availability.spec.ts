import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expectNoPageOverflow, loginViaApi } from "./helpers";

const execFileAsync = promisify(execFile);

test.beforeEach(async () => {
  await cleanupCapacityTestArtifacts();
});

test.afterEach(async () => {
  await cleanupCapacityTestArtifacts();
});

test("POS daily capacity is enforced against stale order submissions", async ({ context, page, request }) => {
  await loginViaApi(request, context);

  const itemName = `Capacity Test ${Date.now()}`;

  await page.goto("/catalog");
  await page.getByLabel("Item Name").first().fill(itemName);
  await page.getByLabel("Category").first().selectOption("FOOD");
  await page.getByLabel("Price").first().fill("125000");
  await page.getByLabel("Slot / Service Window").first().fill("12:00-14:00");
  await page.getByLabel("Lead Time Minutes").first().fill("15");
  await page.getByLabel("Daily Capacity").first().fill("1");
  await page.getByRole("button", { name: "Create Item" }).click();

  await page.waitForURL(/\/catalog\?actionStatus=success/);
  await expect(page.getByRole("status")).toContainText(`Item ${itemName} berhasil dibuat.`);

  await page.goto("/orders");
  const itemRow = page.locator("label").filter({ hasText: itemName }).first();
  await expect(itemRow).toBeVisible();
  await expect(itemRow.getByText("1/1 left today")).toBeVisible();
  await expect(itemRow.locator('input[type="number"]')).toBeEnabled();

  await createCapacityConflictOrder(itemName);

  await itemRow.locator('input[type="number"]').fill("1");
  await page.getByRole("button", { name: "Create Order" }).click();
  await page.waitForURL(/\/orders\?actionStatus=error/);
  await expect(page.getByRole("alert").filter({ hasText: itemName })).toContainText(`${itemName} melewati kuota hari ini. Sisa kuota: 0.`);

  await page.goto("/orders");
  const refreshedItemRow = page.locator("label").filter({ hasText: itemName }).first();
  await expect(refreshedItemRow.getByText("Quota full")).toBeVisible();
  await expect(refreshedItemRow.locator('input[type="number"]')).toBeDisabled();
  await expectNoPageOverflow(page);
});

async function createCapacityConflictOrder(itemName: string) {
  await execFileAsync("npx", ["tsx", "tests/e2e/create-capacity-conflict.ts", itemName], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}

async function cleanupCapacityTestArtifacts() {
  await execFileAsync("npx", ["tsx", "tests/e2e/cleanup-media-artifacts.ts"], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}
