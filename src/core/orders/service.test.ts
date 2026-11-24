import { describe, expect, it } from "vitest";
import { menus } from "../catalog";
import { emptyState, MapRepository, type OrderState } from "./memory-repo";
import type { ChangeFeed } from "./ports";
import { monitorOrders, OrderService, ORDER_POLICY } from "./service";
import { sha256HexSync, hashToken } from "./token";

function setup(start = 1_800_000_000_000) {
  let state: OrderState = emptyState();
  let now = start;
  const published: number[] = [];
  const repo = new MapRepository({ read: () => state, write: (s) => (state = s) });
  const feed: ChangeFeed = { publish: (_s, seq) => published.push(seq), waitForChange: async () => {} };
  const svc = new OrderService(repo, feed, { now: () => now }, () => ({ p50: 300, p80: 420, method: "test", dataMode: "simulated" }));
  return { svc, repo, published, tick: (ms: number) => (now += ms), get now() { return now; } };
}

const bibim = menus.find((m) => m.name === "오색비빔밥")!;
const jjigae = menus.find((m) => m.name === "순두부찌개(밥포함)")!;

describe("OrderService", () => {
  it("splits one payment into brand-wise orders with distinct tokens", async () => {
    const { svc } = setup();
    const r = await svc.placeOrder({ sessionId: "TEST1", kioskId: "L2", lines: [{ menuId: bibim.id, qty: 1 }, { menuId: jjigae.id, qty: 2 }] });
    expect(r.tickets).toHaveLength(2);
    expect(new Set(r.tickets.map((t) => t.token)).size).toBe(2);
    expect(r.batch.totalKrw).toBe(6500 + 6000 * 2);
    const brandsInTickets = r.tickets.map((t) => t.order.brandId).sort();
    expect(brandsInTickets).toEqual(["bibigogo", "gapjjigae"]);
  });

  it("completing one order leaves the other accepted, and is idempotent", async () => {
    const { svc, published } = setup();
    const r = await svc.placeOrder({ sessionId: "TEST1", kioskId: "R1", lines: [{ menuId: bibim.id, qty: 1 }, { menuId: jjigae.id, qty: 1 }] });
    const [a, b] = r.tickets;
    const first = await svc.markReady("TEST1", a.order.id, "k1");
    const again = await svc.markReady("TEST1", a.order.id, "k1");
    const other = await svc.markReady("TEST1", a.order.id, "k2");
    expect(first.changed).toBe(true);
    expect(again.changed).toBe(false);
    expect(other.changed).toBe(false);
    const tracked = await svc.track([a.token, b.token]);
    expect(tracked.find((t) => t.token === a.token)!.order!.status).toBe("ready");
    expect(tracked.find((t) => t.token === b.token)!.order!.status).toBe("accepted");
    expect(published.length).toBe(2);
  });

  it("brand display numbers increase per brand within a session", async () => {
    const { svc } = setup();
    const a = await svc.placeOrder({ sessionId: "TEST1", kioskId: "L1", lines: [{ menuId: bibim.id, qty: 1 }] });
    const b = await svc.placeOrder({ sessionId: "TEST1", kioskId: "L1", lines: [{ menuId: bibim.id, qty: 1 }] });
    expect(b.tickets[0].order.displayNumber).toBe(a.tickets[0].order.displayNumber + 1);
  });

  it("rejects malformed, unknown and cross-session access", async () => {
    const { svc } = setup();
    const r = await svc.placeOrder({ sessionId: "TEST1", kioskId: "L1", lines: [{ menuId: bibim.id, qty: 1 }] });
    expect((await svc.track(["nope"]))[0].state).toBe("invalid");
    expect((await svc.track(["A".repeat(22)]))[0].state).toBe("not_found");
    await expect(svc.markReady("OTHER", r.tickets[0].order.id, "x")).rejects.toThrow();
    await expect(svc.placeOrder({ sessionId: "TEST1", kioskId: "X9", lines: [{ menuId: bibim.id, qty: 1 }] })).rejects.toThrow();
    await expect(svc.placeOrder({ sessionId: "TEST1", kioskId: "L1", lines: [{ menuId: bibim.id, qty: 99 }] })).rejects.toThrow();
  });

  it("expires links and never reports ready before staff completion", async () => {
    const env = setup();
    const r = await env.svc.placeOrder({ sessionId: "TEST1", kioskId: "L1", lines: [{ menuId: bibim.id, qty: 1 }] });
    env.tick(30 * 60 * 1000); // well past the predicted time
    expect((await env.svc.track([r.tickets[0].token]))[0].order!.status).toBe("accepted");
    env.tick(ORDER_POLICY.tokenTtlMs);
    expect((await env.svc.track([r.tickets[0].token]))[0].state).toBe("expired");
  });

  it("user close ends tracking; monitor shows only recent ready orders", async () => {
    const env = setup();
    const r = await env.svc.placeOrder({ sessionId: "TEST1", kioskId: "L1", lines: [{ menuId: bibim.id, qty: 1 }] });
    await env.svc.markReady("TEST1", r.tickets[0].order.id, "k");
    const { orders } = await env.svc.sessionOrders("TEST1");
    expect(monitorOrders(orders, env.now)).toHaveLength(1);
    expect(monitorOrders(orders, env.now + ORDER_POLICY.monitorWindowMs + 1)).toHaveLength(0);
    const closed = await env.svc.closeByToken(r.tickets[0].token);
    expect(closed.order!.status).toBe("closed");
  });

  it("undo is only possible within 10 seconds", async () => {
    const env = setup();
    const r = await env.svc.placeOrder({ sessionId: "TEST1", kioskId: "L1", lines: [{ menuId: bibim.id, qty: 1 }] });
    await env.svc.markReady("TEST1", r.tickets[0].order.id, "k");
    env.tick(3000);
    expect((await env.svc.undoReady("TEST1", r.tickets[0].order.id, "u1")).changed).toBe(true);
    await env.svc.markReady("TEST1", r.tickets[0].order.id, "k2");
    env.tick(11_000);
    expect((await env.svc.undoReady("TEST1", r.tickets[0].order.id, "u2")).changed).toBe(false);
  });
});

describe("token hashing", () => {
  it("pure-JS SHA-256 matches WebCrypto", async () => {
    for (const s of ["", "abc", "floweat-token-한글", "x".repeat(200)]) {
      expect(sha256HexSync(s)).toBe(await hashToken(s));
    }
    expect(sha256HexSync("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
