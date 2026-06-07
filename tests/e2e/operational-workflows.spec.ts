import { expect, type TestInfo, test } from "@playwright/test";
import { expectNoPageOverflow, loginViaApi } from "./helpers";

function uniqueSuffix(testInfo: TestInfo) {
  return `${testInfo.project.name}-${Date.now().toString(36)}-${testInfo.workerIndex}`.replace(/[^a-z0-9-]/gi, "");
}

function dateInputFromOffset(offsetDays: number) {
  const date = new Date(Date.UTC(2034, 0, 1));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function uniqueFutureStay(testInfo: TestInfo) {
  const projectOffset = testInfo.project.name === "mobile" ? 500 : 0;
  const runOffset = Number(Date.now().toString().slice(-5)) % 300;
  const checkIn = dateInputFromOffset(projectOffset + runOffset);
  const checkOut = dateInputFromOffset(projectOffset + runOffset + 2);

  return { checkIn, checkOut };
}

test("front office can create a guest and confirmed reservation", async ({ context, page, request }, testInfo) => {
  await loginViaApi(request, context);

  const suffix = uniqueSuffix(testInfo);
  const guestName = `QA Guest ${suffix}`;
  const { checkIn, checkOut } = uniqueFutureStay(testInfo);

  await page.goto("/guests/new");
  await page.getByLabel("Nama lengkap").fill(guestName);
  await page.getByLabel("Guest type").fill("QA Repeat Guest");
  await page.getByLabel("Phone / WhatsApp").fill("+628123450000");
  await page.getByLabel("Email").fill(`${suffix}@guest.test`);
  await page.getByLabel("Country").fill("Indonesia");
  await page.getByLabel("City").fill("Denpasar");
  await page.getByLabel("Preferences").fill("Quiet corner and late breakfast");
  await page.getByRole("button", { name: "Simpan Guest" }).click();

  await page.waitForURL(/\/guests\/[^/?]+\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: `Guest ${guestName} berhasil dibuat.` })).toBeVisible();
  await expect(page.getByRole("heading", { name: guestName })).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto(`/reservations/new?checkIn=${checkIn}&checkOut=${checkOut}`);
  const guestOptionValue = await page.locator('select[name="guestId"] option', { hasText: guestName }).first().getAttribute("value");
  expect(guestOptionValue).toBeTruthy();

  await page.locator('select[name="guestId"]').selectOption(guestOptionValue!);
  await page.getByLabel("Payment status").selectOption("PARTIAL");
  await page.getByLabel("Room rate").fill("1750000");
  await expect(page.getByLabel("Room rate")).toHaveValue("1.750.000");
  await page.getByLabel("Amount paid / deposit").fill("500000");
  await expect(page.getByLabel("Amount paid / deposit")).toHaveValue("500.000");
  await page.getByLabel("Internal notes").fill(`Reservation workflow smoke ${suffix}`);
  await page.getByRole("button", { name: "Confirm Booking" }).click();

  await page.waitForURL(/\/reservations\/[^/?]+\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: "berhasil dibuat." })).toBeVisible();
  await expect(page.getByText(guestName, { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await expect(page.getByText("Partial").first()).toBeVisible();
  await expectNoPageOverflow(page);
});

test("housekeeping can create a task and move it into progress", async ({ context, page, request }, testInfo) => {
  await loginViaApi(request, context);

  const taskType = `QA Linen Refresh ${uniqueSuffix(testInfo)}`;

  await page.goto("/housekeeping");
  const createTaskForm = page.locator("form", { has: page.getByRole("button", { name: "Create Task" }) });
  await createTaskForm.getByLabel("Task Type").fill(taskType);
  await createTaskForm.getByLabel("Priority").selectOption("HIGH");
  await createTaskForm.getByLabel("Notes").fill("Created by operational workflow regression");
  await createTaskForm.getByRole("button", { name: "Create Task" }).click();

  await page.waitForURL(/\/housekeeping\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: `Task ${taskType}` })).toBeVisible();
  const taskCard = page.locator("article", { hasText: taskType }).first();
  await expect(taskCard).toBeVisible();
  await expectNoPageOverflow(page);

  await taskCard.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/\/housekeeping\?actionStatus=success/);
  const progressedTaskCard = page.locator("article", { hasText: taskType }).first();
  await expect(progressedTaskCard.locator('select[name="status"]')).toHaveValue("IN_PROGRESS");
});

test("service team can create and assign a guest request", async ({ context, page, request }, testInfo) => {
  await loginViaApi(request, context);

  const requestTitle = `QA Sunrise Picnic ${uniqueSuffix(testInfo)}`;

  await page.goto("/service-requests");
  const createRequestForm = page.locator("form", { has: page.getByRole("button", { name: "Create Request" }) });
  await createRequestForm.getByLabel("Type").selectOption("ACTIVITY");
  await createRequestForm.getByLabel("Title").fill(requestTitle);
  await createRequestForm.getByLabel("Priority").selectOption("HIGH");
  await createRequestForm.getByLabel("Description").fill("Guest wants a guided sunrise picnic setup");
  await createRequestForm.getByLabel("Internal Notes").fill("Coordinate with activity team");
  await createRequestForm.getByRole("button", { name: "Create Request" }).click();

  await page.waitForURL(/\/service-requests\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: "berhasil dibuat." })).toBeVisible();
  const requestCard = page.locator("article", { hasText: requestTitle }).first();
  await expect(requestCard).toBeVisible();
  await expectNoPageOverflow(page);

  await requestCard.getByRole("button", { name: "Assign" }).click();
  await page.waitForURL(/\/service-requests\?actionStatus=success/);
  const assignedRequestCard = page.locator("article", { hasText: requestTitle }).first();
  await expect(assignedRequestCard.locator('select[name="status"]')).toHaveValue("ASSIGNED");
});

test("messages can create an active WhatsApp template", async ({ context, page, request }, testInfo) => {
  await loginViaApi(request, context);

  const templateName = `QA Welcome ${uniqueSuffix(testInfo)}`;

  await page.goto("/messages");
  const createTemplateForm = page.locator("form", { has: page.getByRole("button", { name: "Create Template" }) });
  await createTemplateForm.getByLabel("Template Name").fill(templateName);
  await createTemplateForm.getByLabel("Category").selectOption("WELCOME_MESSAGE");
  await createTemplateForm.getByLabel("Message Body").fill("Halo {{guest_name}}, selamat datang di {{property_name}}. Booking {{booking_code}} sudah kami siapkan.");
  await createTemplateForm.getByRole("button", { name: "Create Template" }).click();

  await page.waitForURL(/\/messages\?actionStatus=success/);
  await expect(page.getByRole("status").filter({ hasText: `Template ${templateName} berhasil dibuat.` })).toBeVisible();
  await expect(page.locator("form", { hasText: templateName }).first()).toBeVisible();
  await expectNoPageOverflow(page);
});
