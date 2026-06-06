import { expect, test } from "@playwright/test";
import { loginViaApi } from "./helpers";

test("invalid catalog submission returns to the workflow with an error banner", async ({ context, page, request }) => {
  await loginViaApi(request, context);
  await page.goto("/catalog");
  await page.getByLabel("Item Name").first().fill("x");
  await page.getByRole("button", { name: "Create Item" }).click();
  await page.waitForURL(/\/catalog\?actionStatus=error/);
  await expect(page.getByRole("alert")).toContainText("Form belum lengkap atau ada nilai yang tidak valid.");
});

test("invalid calendar start date renders feedback without breaking the board", async ({ context, page, request }) => {
  await loginViaApi(request, context);
  await page.goto("/calendar?start=bad-date");
  await expect(page.getByRole("alert")).toContainText("Tanggal awal calendar tidak valid");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
});
