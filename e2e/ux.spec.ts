import { devices, expect, test } from "@playwright/test";

const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 13"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

test("map-first home does not get in the way of menu, seats and order tracking", async ({ page }) => {
  await page.goto("/app?t=12:20");
  const map = page.getByTestId("commons-map").first();
  await expect(map).toBeVisible();
  // swipes starting on the map scroll the page while the map is not zoomed
  await expect(map).toHaveCSS("touch-action", "pan-y");

  // seats: one tap, both 4-seat and single-seat units are reported
  await page.getByRole("tab", { name: "좌석" }).click();
  await expect(page.getByText("4인 테이블이 비어 보여요")).toBeVisible();
  await expect(page.getByText("1인석이 비어 보여요")).toBeVisible();

  // menu: one tap to a searchable list with prep times
  await page.getByRole("link", { name: "메뉴" }).click();
  await page.getByRole("searchbox").fill("찌개");
  await expect(page.getByRole("link", { name: /순두부찌개/ }).first()).toBeVisible();

  // kiosk list is reachable and in sync with the map selection
  await page.getByRole("link", { name: "지금" }).click();
  await page.getByRole("tab", { name: "대기열" }).click();
  await page.getByRole("button", { name: /^오른쪽 가운데,/ }).click();
  await expect(page.getByText(/한 건에 평균/)).toBeVisible();

  // zoom controls exist for people who cannot pinch
  await page.getByRole("button", { name: "지도 확대" }).click();
  await expect(page.getByRole("button", { name: "처음 보기로" })).toBeVisible();
});
