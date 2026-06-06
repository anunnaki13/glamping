import { expect, test } from "@playwright/test";
import { expectNoPageOverflow, loginViaApi } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("owner mobile navigation exposes every permitted module and keeps active item visible", async ({ context, page, request }) => {
  await loginViaApi(request, context);

  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Mobile primary navigation" });
  await expect(nav).toBeVisible();

  for (const label of ["Calendar", "Units", "Guests", "Messages", "Catalog", "Payments", "AI", "Activity", "Settings"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  for (const [route, activeLabel] of [
    ["/calendar", "Calendar"],
    ["/activity", "Activity"],
    ["/settings", "Settings"],
  ] as const) {
    await page.goto(route);
    const activeLink = nav.getByRole("link", { name: activeLabel });
    await expect(activeLink).toHaveAttribute("aria-current", "page");
    await expect(activeLink).toBeInViewport();
    await expectNoPageOverflow(page);
  }
});
