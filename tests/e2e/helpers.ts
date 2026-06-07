import { expect, type BrowserContext, type Page, type APIRequestContext } from "@playwright/test";

export const e2eBaseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export const demoUsers = {
  owner: "owner@nusaescape.local",
  manager: "manager@nusaescape.local",
  frontOffice: "frontoffice@nusaescape.local",
  housekeeping: "housekeeping@nusaescape.local",
  fnb: "fnb@nusaescape.local",
  viewer: "qa-viewer@nusaescape.local",
} as const;

export const demoPassword = "password123";

export async function loginViaApi(request: APIRequestContext, context: BrowserContext, email: string = demoUsers.owner) {
  const response = await request.post("/api/auth/login", {
    data: { email, password: demoPassword, remember: true },
  });

  expect(response.ok()).toBeTruthy();

  const cookie = response.headers()["set-cookie"]?.split(";")[0];
  expect(cookie).toBeTruthy();

  const [name, ...valueParts] = cookie!.split("=");
  const cookieDomain = new URL(e2eBaseURL).hostname;

  await context.addCookies([
    {
      name,
      value: valueParts.join("="),
      domain: cookieDomain,
      path: "/",
    },
  ]);
}

export async function loginThroughUi(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(demoUsers.owner);
  await page.locator('input[type="password"]').fill(demoPassword);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard/);
}

export async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(8);
}
