import path from "node:path";
import { expect, test, devices, type Page } from "@playwright/test";

const JSQR = path.join(process.cwd(), "node_modules/jsqr/dist/jsQR.js");

/** Decodes every ticket QR on the kiosk screen in-browser (proves they are scannable). */
async function decodeTicketQrs(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: JSQR });
  return page.evaluate(async () => {
    const out: string[] = [];
    const nodes = Array.from(document.querySelectorAll('[data-testid="ticket"] [role="img"] svg'));
    for (const svg of nodes) {
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      const data = ctx.getImageData(0, 0, 400, 400);
      // @ts-expect-error injected global
      const code = window.jsQR(data.data, 400, 400);
      out.push(code?.data ?? "");
    }
    return out;
  });
}

async function orderTwoBrands(kiosk: Page) {
  await kiosk.getByRole("button", { name: "화면을 눌러 주문하세요" }).click();
  await kiosk.getByRole("button", { name: /^비비고고/ }).click();
  await kiosk.getByRole("button", { name: /오색비빔밥/ }).first().click();
  await kiosk.getByRole("button", { name: /^값찌개/ }).click();
  await kiosk.getByRole("button", { name: /순두부찌개\(밥포함\)/ }).first().click();
  await expect(kiosk.getByText("번호표가 2장 나와요")).toBeVisible();
  await kiosk.getByRole("button", { name: /결제하기/ }).click();
  await kiosk.getByRole("button", { name: "모의 결제 완료" }).click();
  await expect(kiosk.getByTestId("ticket")).toHaveCount(2);
}

test("cross-device loop: kiosk → QR → phone → staff → monitor + phone", async ({ browser }) => {
  const session = `E${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const kioskCtx = await browser.newContext({ viewport: { width: 900, height: 1300 } });
  const phoneCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const staffCtx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const monitorCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });

  const kiosk = await kioskCtx.newPage();
  await kiosk.goto(`/kiosk?s=${session}&k=R2&mode=auto`);
  await orderTwoBrands(kiosk);

  const urls = await decodeTicketQrs(kiosk);
  expect(urls).toHaveLength(2);
  for (const u of urls) expect(u).toMatch(/\/o\/[A-Za-z0-9_-]{22}$/);
  const numbers = await kiosk.getByTestId("ticket-number").allTextContents();

  // phone scans both tickets (different device = separate browser context)
  const phone = await phoneCtx.newPage();
  await phone.goto(`/?s=${session}`);
  for (const u of urls) {
    await phone.goto(new URL(u).pathname);
    await expect(phone.getByText(/이 휴대폰에 주문을 연결했어요/)).toBeVisible();
  }
  // re-scan does not duplicate
  await phone.goto(new URL(urls[0]).pathname);
  await expect(phone.getByText("이미 연결된 주문이에요.")).toBeVisible();
  await phone.goto("/orders");
  await expect(phone.getByTestId("order-card")).toHaveCount(2);

  // monitor & staff
  const monitor = await monitorCtx.newPage();
  await monitor.goto(`/monitor?s=${session}`);
  await expect(monitor.getByTestId("monitor-number")).toHaveCount(0);

  const staff = await staffCtx.newPage();
  await staff.goto(`/staff?s=${session}&b=bibigogo`);
  await expect(staff.getByTestId("staff-order")).toHaveCount(1);
  const t0 = Date.now();
  await staff.getByRole("button", { name: /번 완료$/ }).click();

  // only the bibigogo order flips to ready on the phone; the other stays accepted
  await expect(phone.locator('[data-testid="order-card"][data-status="ready"]')).toHaveCount(1, { timeout: 5000 });
  const latency = Date.now() - t0;
  await expect(phone.locator('[data-testid="order-card"][data-status="accepted"]')).toHaveCount(1);
  await expect(phone.getByRole("alert").filter({ hasText: "준비 완료" })).toContainText("비비고고");
  await expect(monitor.getByTestId("monitor-number")).toHaveCount(1, { timeout: 5000 });
  expect(numbers).toContain((await monitor.getByTestId("monitor-number").first().textContent())?.trim());
  console.log(`ready → phone latency ${latency} ms`);
  expect(latency).toBeLessThan(2500);

  // second brand
  await staff.goto(`/staff?s=${session}&b=gapjjigae`);
  await staff.getByRole("button", { name: /번 완료$/ }).click();
  await expect(phone.locator('[data-testid="order-card"][data-status="ready"]')).toHaveCount(2, { timeout: 5000 });
  await expect(monitor.getByTestId("monitor-number")).toHaveCount(2, { timeout: 5000 });

  // student marks received → monitor keeps the number (staff flow unchanged), phone ends tracking
  await phone.getByRole("button", { name: "받았어요" }).first().click();
  await expect(phone.locator('[data-testid="order-card"][data-status="ready"]')).toHaveCount(1, { timeout: 5000 });

  await Promise.all([kioskCtx.close(), phoneCtx.close(), staffCtx.close(), monitorCtx.close()]);
});

test("staff completion is idempotent at the API", async ({ request }) => {
  const s = "IDEM" + Math.floor(Math.random() * 9000 + 1000);
  const placed = await request.post(`/api/sessions/${s}/orders`, { data: { kioskId: "L1", lines: [{ menuId: "babi-018", qty: 1 }] } });
  expect(placed.status()).toBe(201);
  const { tickets } = await placed.json();
  const id = tickets[0].order.id;
  const a = await (await request.post(`/api/sessions/${s}/orders/${id}/ready`, { data: { idempotencyKey: "same-key" } })).json();
  const b = await (await request.post(`/api/sessions/${s}/orders/${id}/ready`, { data: { idempotencyKey: "same-key" } })).json();
  const c = await (await request.post(`/api/sessions/${s}/orders/${id}/ready`, { data: { idempotencyKey: "other-key" } })).json();
  expect([a.changed, b.changed, c.changed]).toEqual([true, false, false]);
  const wrong = await request.post(`/api/sessions/OTHER1/orders/${id}/ready`, { data: { idempotencyKey: "x-key" } });
  expect(wrong.status()).toBe(404);
  const bad = await request.post(`/api/track`, { data: { tokens: ["../../etc"] } });
  expect((await bad.json()).results[0].state).toBe("invalid");
});

test("one-device mode: kiosk, staff and order page sync inside one browser", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  const kiosk = await ctx.newPage();
  await kiosk.goto(`/kiosk?s=SOLO1&mode=device`);
  await kiosk.getByRole("button", { name: "화면을 눌러 주문하세요" }).click();
  await kiosk.getByRole("button", { name: /^바비든든/ }).click();
  await kiosk.getByRole("button", { name: /^제육덮밥/ }).first().click();
  await kiosk.getByRole("button", { name: /결제하기/ }).click();
  await kiosk.getByRole("button", { name: "모의 결제 완료" }).click();
  await expect(kiosk.getByTestId("ticket")).toHaveCount(1);
  const href = await kiosk.getByTestId("ticket-link").getAttribute("href");

  const phone = await ctx.newPage();
  await phone.goto(new URL(href!).pathname);
  await expect(phone.getByTestId("order-card")).toHaveAttribute("data-status", "accepted");

  const staff = await ctx.newPage();
  await staff.goto(`/staff?s=SOLO1&b=babi`);
  await staff.getByRole("button", { name: /번 완료$/ }).click();
  await expect(phone.getByTestId("order-card")).toHaveAttribute("data-status", "ready", { timeout: 5000 });
  await ctx.close();
});

test("bad QR shows a clear message", async ({ page }) => {
  await page.goto("/o/not-a-token");
  await expect(page.getByRole("heading", { name: "QR을 읽지 못했어요" })).toBeVisible();
  await page.goto("/o/AAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "이 주문을 찾을 수 없어요" })).toBeVisible();
});
