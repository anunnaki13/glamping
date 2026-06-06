import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expectNoPageOverflow, loginViaApi } from "./helpers";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X7Qv8AAAAASUVORK5CYII=",
  "base64",
);
const execFileAsync = promisify(execFile);

test.afterEach(async () => {
  await cleanupMediaTestArtifacts();
});

test("unit, catalog, and order media surfaces render and catalog accepts uploads", async ({ context, page, request }) => {
  await loginViaApi(request, context);

  await page.goto("/units");
  await expect(page.locator('img[alt$="photo"]').first()).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("/catalog");
  await expect(page.locator('img[alt$="photo"]').first()).toBeVisible();

  const itemName = `Media Test ${Date.now()}`;
  await page.getByLabel("Item Name").first().fill(itemName);
  await page.getByLabel("Price").first().fill("123000");
  await page.getByLabel("Upload Photo").first().setInputFiles({
    name: "media-test.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.getByRole("button", { name: "Create Item" }).click();
  await page.waitForURL(/\/catalog\?actionStatus=success/);
  await expect(page.getByRole("status")).toContainText(`Item ${itemName} berhasil dibuat.`);
  await expect(page.locator(`img[alt="${itemName} photo"]`)).toBeVisible();

  await page.goto("/orders");
  await expect(page.locator('img[alt$="photo"]').first()).toBeVisible();
  await expectNoPageOverflow(page);
});

async function cleanupMediaTestArtifacts() {
  await execFileAsync("npx", ["tsx", "tests/e2e/cleanup-media-artifacts.ts"], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}
