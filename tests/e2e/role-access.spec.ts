import { expect, type Browser, type APIRequestContext, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { demoUsers, e2eBaseURL, expectNoPageOverflow, loginViaApi } from "./helpers";

const execFileAsync = promisify(execFile);

const roleFixtureCommand = ["tsx", "tests/e2e/create-role-fixtures.ts"] as const;

test.beforeEach(async () => {
  await createRoleFixtures();
});

test.afterEach(async () => {
  await cleanupRoleFixtures();
});

test("role permissions allow and block operational modules consistently", async ({ browser, request }) => {
  await assertRoleRoutes(browser, request, demoUsers.owner, {
    allowed: [
      { route: "/settings", heading: "Settings" },
      { route: "/activity", heading: "Activity Log" },
      { route: "/payments", heading: "Payments" },
    ],
  });

  await assertRoleRoutes(browser, request, demoUsers.frontOffice, {
    allowed: [{ route: "/payments", heading: "Payments" }],
    forbidden: ["/settings", "/activity"],
  });

  await assertRoleRoutes(browser, request, demoUsers.housekeeping, {
    allowed: [{ route: "/housekeeping", heading: "Housekeeping" }],
    forbidden: ["/guests", "/payments", "/reports"],
  });

  await assertRoleRoutes(browser, request, demoUsers.fnb, {
    allowed: [
      { route: "/catalog", heading: "Catalog" },
      { route: "/orders", heading: "Orders" },
      { route: "/reports", heading: "Reports" },
    ],
    forbidden: ["/payments", "/settings"],
  });

  await assertRoleRoutes(browser, request, demoUsers.viewer, {
    allowed: [
      { route: "/guests", heading: "Guest CRM" },
      { route: "/reports", heading: "Reports" },
      { route: "/orders", heading: "Orders" },
    ],
    forbidden: ["/payments", "/settings", "/activity"],
  });
});

test("financial and guest contact visibility follows role scope", async ({ context, page, request }) => {
  await loginViaApi(request, context, demoUsers.frontOffice);
  await page.goto("/reservations");
  await expect(page.getByRole("heading", { name: "Reservasi" })).toBeVisible();
  await expect(page.getByText("Revenue Envelope")).toBeVisible();
  await expect(page.getByText("Outstanding").first()).toBeVisible();
  await expect(page.getByText("Total Booking")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("/guests");
  await expect(page.getByRole("heading", { name: "Guest CRM" })).toBeVisible();
  await expect(page.getByText("+6281234567890").first()).toBeVisible();

  await context.clearCookies();
  await loginViaApi(request, context, demoUsers.fnb);
  await page.goto("/reservations");
  await expect(page.getByRole("heading", { name: "Reservasi" })).toBeVisible();
  await expect(page.getByText("Revenue Envelope")).toHaveCount(0);
  await expect(page.getByText("Outstanding")).toHaveCount(0);
  await expect(page.getByText("Upcoming")).toBeVisible();
  await expect(page.locator("main")).toContainText("****");

  await page.goto("/reports");
  const fnbReports = page.locator("main");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(fnbReports.getByRole("columnheader", { name: "Order Revenue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(0);
  await expect(fnbReports.getByText("Total Revenue", { exact: true })).toHaveCount(0);

  await context.clearCookies();
  await loginViaApi(request, context, demoUsers.viewer);
  await page.goto("/reports");
  const viewerReports = page.locator("main");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(viewerReports.getByText("Recent Orders", { exact: true })).toBeVisible();
  await expect(viewerReports.getByText("Order Revenue", { exact: true })).toHaveCount(0);
  await expect(viewerReports.getByText("Total Revenue", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(0);
});

test("read-only and specialist roles see the right write controls", async ({ context, page, request }) => {
  await loginViaApi(request, context, demoUsers.viewer);

  await page.goto("/reservations");
  await expect(page.getByRole("heading", { name: "Reservasi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Buat Reservasi" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Check-in" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);

  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Order" })).toHaveCount(0);
  await expect(page.getByText("Read-only").first()).toBeVisible();

  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Catalog", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Item" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Item" })).toHaveCount(0);

  await context.clearCookies();
  await loginViaApi(request, context, demoUsers.housekeeping);
  await page.goto("/housekeeping");
  await expect(page.getByRole("heading", { name: "Housekeeping" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Task" })).toBeVisible();

  await context.clearCookies();
  await loginViaApi(request, context, demoUsers.frontOffice);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Order" })).toHaveCount(0);

  await context.clearCookies();
  await loginViaApi(request, context, demoUsers.fnb);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Order" })).toBeVisible();
});

type RoleRouteMatrix = {
  allowed?: Array<{ route: string; heading: string }>;
  forbidden?: string[];
};

async function assertRoleRoutes(browser: Browser, request: APIRequestContext, email: string, matrix: RoleRouteMatrix) {
  const context = await browser.newContext({ baseURL: e2eBaseURL });
  const page = await context.newPage();

  try {
    await loginViaApi(request, context, email);

    for (const { route, heading } of matrix.allowed ?? []) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${escapeRegex(route)}(?:\\?|$)`));
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expectNoPageOverflow(page);
    }

    for (const route of matrix.forbidden ?? []) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard\?actionStatus=error/);
      await expect(page.getByRole("alert").filter({ hasText: "Anda tidak memiliki akses" })).toBeVisible();
      await expectNoPageOverflow(page);
    }
  } finally {
    await context.close();
  }
}

async function createRoleFixtures() {
  await execFileAsync("npx", [...roleFixtureCommand], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}

async function cleanupRoleFixtures() {
  await execFileAsync("npx", [...roleFixtureCommand, "cleanup"], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
