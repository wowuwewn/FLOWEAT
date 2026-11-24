import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/queue", "/dining", "/menu", "/menu/bibigogo", "/orders", "/about", "/kiosk", "/staff?b=babi", "/monitor", "/demo"];

for (const path of PAGES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(1500);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length) console.log(path, JSON.stringify(serious.map((v) => ({ id: v.id, n: v.nodes.length, t: v.nodes[0]?.target, s: v.nodes[0]?.failureSummary?.slice(0, 160) })), null, 1));
    expect(serious).toEqual([]);
  });
}
