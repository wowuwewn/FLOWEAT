import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  "/", "/app", "/app?layer=seats", "/app?layer=pickup", "/app/menu", "/app/menu/bibigogo", "/app/orders", "/app/about",
  "/kiosk", "/staff?b=babi", "/monitor", "/ops", "/demo/split", "/o/AAAAAAAAAAAAAAAAAAAAAA", "/this-page-does-not-exist",
];

async function audit(page: Page, label: string) {
  await page.waitForTimeout(1200);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) console.log(label, JSON.stringify(serious.map((v) => ({ id: v.id, n: v.nodes.length, t: v.nodes[0]?.target, s: v.nodes[0]?.failureSummary?.slice(0, 160) })), null, 1));
  expect(serious).toEqual([]);
}

for (const path of PAGES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await audit(page, path);
  });
}

test.describe("a11y on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const path of ["/", "/app", "/app/menu", "/demo/split", "/kiosk"]) {
    test(`a11y mobile: ${path}`, async ({ page }) => {
      await page.goto(path);
      await audit(page, `mobile ${path}`);
    });
  }
});

test("a11y: kiosk menu, cart and payment steps", async ({ page }) => {
  await page.goto("/kiosk?s=AXE01");
  await page.getByRole("button", { name: "화면을 눌러 주문하세요" }).click();
  await page.getByRole("button", { name: /^바비든든/ }).click();
  await page.getByRole("button", { name: /^제육덮밥/ }).first().click();
  await audit(page, "kiosk menu");
  await page.getByRole("button", { name: /결제하기/ }).click();
  await audit(page, "kiosk pay");
});
