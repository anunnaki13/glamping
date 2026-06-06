import { expect, test } from "@playwright/test";
import { demoUsers, e2eBaseURL, expectNoPageOverflow, loginThroughUi, loginViaApi } from "./helpers";

test("development owner credentials log in through the UI", async ({ page }) => {
  await loginThroughUi(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Welcome back")).toBeVisible();
});

test("report exports respect authentication and role feedback", async ({ browser, request }) => {
  const unauthenticatedExport = await request.get("/reports/export?from=2026-06-01&to=2026-06-05", {
    maxRedirects: 0,
  });
  expect(unauthenticatedExport.status()).toBe(303);
  expect(unauthenticatedExport.headers().location).toContain("/login?next=%2Freports");
  expect(unauthenticatedExport.headers().location).toContain("from%3D2026-06-01");

  const ownerContext = await browser.newContext({ baseURL: e2eBaseURL });
  await loginViaApi(request, ownerContext, demoUsers.owner);
  const ownerExport = await ownerContext.request.get("/reports/export?from=2026-06-01&to=2026-06-05");
  expect(ownerExport.status()).toBe(200);
  expect(ownerExport.headers()["content-type"]).toContain("text/csv");
  expect(ownerExport.headers()["cache-control"]).toContain("no-store");
  expect(ownerExport.headers()["content-disposition"]).toContain("smart-glamping-report-2026-06-01-2026-06-05.csv");
  expect(await ownerExport.text()).toContain("Smart Glamping OS Report");
  await ownerContext.close();

  const fnbContext = await browser.newContext({ baseURL: e2eBaseURL });
  await loginViaApi(request, fnbContext, demoUsers.fnb);
  const fnbExport = await fnbContext.request.get("/reports/export?from=2026-06-01&to=2026-06-05", {
    maxRedirects: 0,
  });
  expect(fnbExport.status()).toBe(303);
  expect(fnbExport.headers().location).toContain("/reports?actionStatus=error");

  const fnbPage = await fnbContext.newPage();
  await fnbPage.goto("/reports?actionStatus=error&actionMessage=Export%20ditolak");
  await expect(fnbPage.getByRole("alert")).toContainText("Export ditolak");
  await expectNoPageOverflow(fnbPage);
  await fnbContext.close();
});

test("forbidden pages redirect to dashboard feedback", async ({ context, page, request }) => {
  await loginViaApi(request, context, demoUsers.fnb);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/dashboard\?actionStatus=error/);
  await expect(page.getByRole("alert")).toContainText("Anda tidak memiliki akses");
});
