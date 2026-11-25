import { expect, test, type Page } from "@playwright/test";

/**
 * Laptop-server mode under load: many tabs + iframes in one browser, a second browser context, and the
 * staff undo path. Before the shared long-poll, 6+ surfaces exhausted the browser's HTTP/1.1 connection
 * pool and a staff "완료" could wait ~20 s.
 */
test("many tabs and contexts: completion reaches every student tab fast; undo withdraws the banner; re-complete alerts once", async ({ browser }) => {
  test.setTimeout(120_000);
  const session = `C${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem("floweat.operatorKey", "e2e-operator"));

  // order two brands at the kiosk
  const kiosk = await ctx.newPage();
  await kiosk.goto(`/kiosk?s=${session}&k=L1`);
  await kiosk.getByRole("button", { name: "주문하기" }).click();
  await kiosk.getByRole("tab", { name: /^바비든든/ }).click();
  await kiosk.getByRole("button", { name: /^제육덮밥/ }).first().click();
  await kiosk.getByRole("tab", { name: /^포포420/ }).click();
  await kiosk.getByRole("button", { name: /^우삼겹쌀국수/ }).first().click();
  await kiosk.getByRole("button", { name: /결제하기/ }).click();
  await kiosk.getByRole("button", { name: "모의 결제 완료" }).click();
  await expect(kiosk.getByTestId("ticket")).toHaveCount(2);
  const links = await kiosk.getByTestId("ticket-link").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));

  // link both tickets on this device, then open lots of surfaces at once
  const linker = await ctx.newPage();
  for (const u of links) {
    await linker.goto(u);
    await expect(linker.getByText("주문을 연결했어요")).toBeVisible();
  }
  const students: Page[] = [];
  for (let i = 0; i < 3; i++) {
    const p = await ctx.newPage();
    await p.goto(`/app/orders?s=${session}`);
    students.push(p);
  }
  const monitor = await ctx.newPage();
  await monitor.goto(`/monitor?s=${session}`);
  const split = await ctx.newPage();
  await split.goto(`/demo/split?s=${session}`);
  const staff = await ctx.newPage();
  await staff.goto(`/staff/board?s=${session}&b=babi`);
  await expect(staff.getByTestId("staff-order")).toHaveCount(1);

  // a different browser (another phone) following its own order in the same session
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const otherKiosk = await other.newPage();
  await otherKiosk.goto(`/kiosk?s=${session}&k=R2`);
  await otherKiosk.getByRole("button", { name: "주문하기" }).click();
  await otherKiosk.getByRole("tab", { name: /^광뚝/ }).click();
  await otherKiosk.locator('section[aria-label$="메뉴"] li button').first().click();
  await otherKiosk.getByRole("button", { name: /결제하기/ }).click();
  await otherKiosk.getByRole("button", { name: "모의 결제 완료" }).click();
  const otherLink = await otherKiosk.getByTestId("ticket-link").first().getAttribute("href");
  const otherPhone = await other.newPage();
  await otherPhone.goto(otherLink!);
  await expect(otherPhone.getByText("주문을 연결했어요")).toBeVisible();
  await otherPhone.goto(`/app/orders?s=${session}`);
  await expect(otherPhone.getByTestId("order-card")).toHaveCount(1);

  // --- complete: the POST must not queue behind long-polls
  const t0 = Date.now();
  const [res] = await Promise.all([staff.waitForResponse((r) => r.url().includes("/ready")), staff.getByRole("button", { name: /번 완료$/ }).click()]);
  const postMs = Date.now() - t0;
  expect(res.status()).toBe(200);
  for (const p of students) await expect(p.locator('[data-testid="order-card"][data-status="ready"]')).toHaveCount(1, { timeout: 2500 });
  const reachMs = Date.now() - t0;
  await expect(monitor.getByTestId("monitor-number")).toHaveCount(1, { timeout: 2500 });
  // the other browser's order is untouched
  await expect(otherPhone.locator('[data-testid="order-card"][data-status="ready"]')).toHaveCount(0);
  console.log(`staff POST ${postMs} ms, all 3 student tabs ready within ${reachMs} ms`);
  expect(postMs).toBeLessThan(1500);

  // --- undo within 10 s: banner withdrawn, notice shown, monitor number removed
  const banner = (p: Page) => p.getByRole("alert").filter({ hasText: "준비 완료" });
  await expect(banner(students[0])).toHaveCount(1);
  await staff.getByRole("button", { name: /되돌리기/ }).click();
  for (const p of students) {
    await expect(banner(p)).toHaveCount(0, { timeout: 2500 });
    await expect(p.locator('[data-testid="order-card"][data-status="ready"]')).toHaveCount(0, { timeout: 2500 });
  }
  await expect(students[0].getByText("매장이 완료를 취소했어요")).toBeVisible();
  await expect(monitor.getByTestId("monitor-number")).toHaveCount(0, { timeout: 2500 });

  // --- complete again: exactly one banner per tab (no stacking / duplicate alerts)
  await staff.getByRole("button", { name: /번 완료$/ }).click();
  for (const p of students) await expect(banner(p)).toHaveCount(1, { timeout: 2500 });
  await expect(students[0].getByText(/외 \d+건/)).toHaveCount(0);

  await Promise.all([ctx.close(), other.close()]);
});
