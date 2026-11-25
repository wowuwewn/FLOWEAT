import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("roles on the laptop demo server", async () => {
  process.env.FLOWEAT_SECRET = "test-secret";
  process.env.FLOWEAT_OPERATOR_KEY = "op-key-123";
  const auth = await import("./auth");
  const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });

  it("a session code alone grants nothing", () => {
    expect(auth.isStaff(req({}), "DEMO")).toBe(false);
    expect(auth.isOperator(req({}))).toBe(false);
  });
  it("staff keys are per session", () => {
    const k = auth.staffKey("DEMO");
    expect(auth.isStaff(req({ [auth.STAFF_HEADER]: k }), "DEMO")).toBe(true);
    expect(auth.isStaff(req({ [auth.STAFF_HEADER]: k }), "OTHER")).toBe(false);
    expect(auth.isOperator(req({ [auth.STAFF_HEADER]: k }))).toBe(false);
  });
  it("the operator may act as staff in any session", () => {
    expect(auth.isOperator(req({ [auth.OPERATOR_HEADER]: "op-key-123" }))).toBe(true);
    expect(auth.isStaff(req({ [auth.OPERATOR_HEADER]: "op-key-123" }), "ANY1")).toBe(true);
    expect(auth.isOperator(req({ [auth.OPERATOR_HEADER]: "op-key-12" }))).toBe(false);
  });
});

describe("rate limits cannot be bypassed by forging X-Forwarded-For", async () => {
  const orders = await import("./orders");
  it("rotating the claimed IP still hits the server-wide bucket", () => {
    orders.resetRateLimits();
    let blocked = 0;
    for (let i = 0; i < orders.LIMITS.global + 50; i++) {
      if (orders.rateLimited(new Request("http://x/", { headers: { "x-forwarded-for": `10.0.${i >> 8}.${i & 255}` } }))) blocked++;
    }
    expect(blocked).toBeGreaterThanOrEqual(50);
  });
  it("one session cannot be flooded even from many claimed IPs", () => {
    orders.resetRateLimits();
    let blocked = 0;
    for (let i = 0; i < orders.LIMITS.perSession + 10; i++) {
      if (orders.rateLimited(new Request("http://x/", { headers: { "x-forwarded-for": `10.1.0.${i}` } }), "DEMO")) blocked++;
    }
    expect(blocked).toBeGreaterThanOrEqual(10);
  });
});
