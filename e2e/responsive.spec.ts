import { expect, test, type Page } from "@playwright/test";

// the e2e server is the laptop-demo server: the operator key lets the split demo pair its staff pane
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("floweat.operatorKey", "e2e-operator"));
});

/** Clicks through the whole loop inside /demo/split and returns the monitor frame + page. */
async function runSplitLoop(page: Page, prefix: string) {
  const session = `${prefix}${Date.now().toString(36).slice(-4).toUpperCase()}`.slice(0, 8);
  await page.goto(`/demo/split?s=${session}&sc=peak`);
  const tab = async (name: RegExp) => {
    const t = page.getByRole("tab", { name }).filter({ visible: true }).first();
    if (await t.isVisible().catch(() => false)) await t.click();
  };
  const kiosk = page.frameLocator('iframe[title="모의 키오스크"]');
  const staff = page.frameLocator('iframe[title="직원 화면"]');
  const student = page.frameLocator('iframe[title="학생 화면"]');
  const monitor = page.frameLocator('iframe[title="호출 모니터"]');

  await tab(/키오스크/);
  await kiosk.getByRole("button", { name: "화면을 눌러 주문하세요" }).click();
  await kiosk.getByRole("button", { name: /^광뚝/ }).click();
  await kiosk.locator('section[aria-label$="메뉴"] li button').first().click();
  await kiosk.getByRole("button", { name: /^포포420/ }).click();
  await kiosk.getByRole("button", { name: /^우삼겹쌀국수/ }).first().click();
  await kiosk.getByRole("button", { name: /결제하기/ }).click();
  await kiosk.getByRole("button", { name: "모의 결제 완료" }).click();
  await expect(kiosk.getByTestId("ticket")).toHaveCount(2);

  // linking a ticket brings the student surface forward (on phones it is a tab switch)
  await kiosk.getByTestId("ticket-link").first().click();
  await expect(page.locator('section[aria-label="학생 휴대폰"]')).toHaveCSS("visibility", "visible");
  await expect(student.getByTestId("order-card")).toHaveCount(1);

  await tab(/직원/);
  await staff.getByRole("button", { name: /광뚝 .*번 완료$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "완료했어요" })).toBeVisible();

  await tab(/학생/);
  await expect(student.getByText("준비 완료")).toBeVisible();
  await tab(/모니터/);
  await expect(monitor.getByTestId("monitor-number")).toHaveCount(1);
  return { monitor };
}

async function insideFrame(page: Page, frameTitle: string, testId: string) {
  const frame = page.locator(`iframe[title="${frameTitle}"]`);
  const fb = (await frame.boundingBox())!;
  const nb = (await page.frameLocator(`iframe[title="${frameTitle}"]`).getByTestId(testId).first().boundingBox())!;
  return nb.y >= fb.y && nb.y + nb.height <= fb.y + fb.height && nb.x >= fb.x && nb.x + nb.width <= fb.x + fb.width;
}

test.describe("whole-loop demo works on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("tabs switch surfaces and every step is reachable", async ({ page }) => {
    await runSplitLoop(page, "PH");
    expect(await insideFrame(page, "호출 모니터", "monitor-number")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

for (const vp of [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  test(`whole-loop demo at ${vp.width}x${vp.height}: the completed number is visible on the monitor`, async ({ page }) => {
    await page.setViewportSize(vp);
    await runSplitLoop(page, `W${String(vp.width).slice(0, 2)}`);
    expect(await insideFrame(page, "호출 모니터", "monitor-number")).toBe(true);
  });
}

test.describe("phone map controls", () => {
  test.use({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  test("zoom buttons are not covered by the sheet", async ({ page }) => {
    await page.goto("/app?t=12:20");
    const btn = page.getByRole("button", { name: "지도 확대" });
    await expect(btn).toBeVisible();
    const b = (await btn.boundingBox())!;
    const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), [b.x + b.width / 2, b.y + b.height / 2]);
    expect(top).toBe("지도 확대");
  });
});

test("unknown addresses get a Korean 404 with ways back", async ({ page }) => {
  const res = await page.goto("/this-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "이 주소에는 화면이 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "체험 홈으로" })).toBeVisible();
});

test("link previews and app icons are declared", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
});
