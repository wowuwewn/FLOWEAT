import { expect, test } from "@playwright/test";

/**
 * Browser-engine checks for the parts most likely to differ between Chromium and Safari's WebKit:
 * map gestures, the 3D preview (WebGL), the QR camera, video + in-browser AI, notifications and the
 * iPhone viewport/safe-area setup. Runs in both projects (see playwright.config.ts).
 * Playwright's WebKit on Linux is the Safari ENGINE, not iOS Safari: no real multi-touch, no camera,
 * no iOS toolbars. What it cannot prove is listed in docs/qa/webkit.md.
 */
test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

test("viewport is set up for notched iPhones and bars respect the safe area", async ({ page }) => {
  await page.goto("/app?t=12:20");
  const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(meta).toContain("viewport-fit=cover");
  // bottom tab bar keeps at least 12 px (or the home-indicator inset) below its buttons
  const nav = page.getByRole("navigation", { name: "주요 화면" });
  await expect(nav).toBeVisible();
  const pb = await nav.evaluate((el) => {
    const inner = el.querySelector(".safe-bottom") ?? el;
    return parseFloat(getComputedStyle(inner).paddingBottom);
  });
  expect(pb).toBeGreaterThanOrEqual(12);
  // the map uses small-viewport units, so it never grows under Safari's toolbars
  const mapBox = await page.getByTestId("commons-map").first().boundingBox();
  expect(mapBox!.height).toBeLessThanOrEqual(664 * 0.4 + 2);
});

test("two-finger pinch on the map zooms it (pointer events)", async ({ page }) => {
  await page.goto("/app?t=12:20");
  const svg = page.getByTestId("commons-map").first().locator("svg").first();
  await expect(svg).toBeVisible();
  await expect(page.getByRole("button", { name: "처음 보기로" })).toHaveCount(0);
  // the map re-lays itself out once data and size arrive; pinch only after that
  await expect(page.getByRole("button", { name: /^왼쪽 정문 쪽,/ })).toBeVisible();
  await page.waitForTimeout(800);
  // synthesize a pinch-out with two pointers (Playwright cannot drive real iOS multi-touch)
  await expect(async () => {
    await svg.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const fire = (type: string, id: number, x: number, y: number) =>
        el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: id === 1, buttons: type === "pointerup" ? 0 : 1 }));
      fire("pointerdown", 1, cx - 20, cy);
      fire("pointerdown", 2, cx + 20, cy);
      for (let i = 1; i <= 10; i++) {
        fire("pointermove", 1, cx - 20 - i * 8, cy);
        fire("pointermove", 2, cx + 20 + i * 8, cy);
      }
      fire("pointerup", 1, cx - 100, cy);
      fire("pointerup", 2, cx + 100, cy);
    });
    await expect(page.getByRole("button", { name: "처음 보기로" })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "처음 보기로" })).toBeVisible();
});

test("360° preview renders with WebGL and turns when dragged", async ({ page }) => {
  await page.goto("/app?t=12:20");
  await page.getByRole("button", { name: "360° 둘러보기" }).click();
  const dialog = page.getByRole("dialog", { name: "식당 미리보기 VR" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("3D 화면을 열 수 없어요")).toHaveCount(0);
  const canvas = dialog.locator("canvas");
  await expect(canvas).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(800);
  const before = await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await canvas.screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(dialog).toBeHidden();
});

test("QR scanner explains what to do when there is no camera, and pasting a link still works", async ({ page }) => {
  await page.goto("/app/scan");
  // headless browsers have no camera: the page must leave the "starting" state with a clear message
  await expect(page.getByText(/카메라를 찾지 못했어요|카메라 권한이 없어요|카메라를 쓸 수 없어요|QR을 네모 안에/).first()).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("QR 주소 붙여넣기").fill("https://example.com/nope");
  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.getByText("영수증의 FLOWEAT QR이 아니에요")).toBeVisible();
});

test("notifications degrade to in-page alerts where the API is missing (iOS Safari tabs)", async ({ page }) => {
  await page.goto("/app/orders");
  const hasApi = await page.evaluate(() => typeof Notification !== "undefined");
  if (hasApi) {
    await expect(page.getByText(/알려 드려요|알림/).first()).toBeVisible();
  } else {
    await expect(page.getByText("이 화면을 열어 두면 알려 드려요")).toBeVisible();
  }
});

test("video AI: the recorded analysis plays and feeds the pipeline", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ops");
  const video = page.locator("video").first();
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 }).toBeGreaterThan(0.5);
  // step 2 ("사람 검출") shows a live count once frames arrive
  await expect(page.getByRole("list", { name: "처리 단계" }).getByText(/^\d+명$/).first()).toBeVisible({ timeout: 20_000 });
});

test("video AI: in-browser inference starts (WebGPU or WASM) or says why not", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ops");
  await page.getByRole("radio", { name: "이 브라우저에서 실시간 추론" }).click();
  const status = page.locator("p[aria-live=polite]").filter({ hasText: "실시간" });
  await expect(status).toContainText(/준비됨|ms\/프레임|시작하지 못했어요/, { timeout: 100_000 });
  console.log(`[${test.info().project.name}] live inference: ${(await status.textContent())?.slice(0, 140)}`);
});
