"use client";
/**
 * One interface, two transports:
 *  - "server": shared order store on the Next.js server (local / laptop LAN demo).
 *              Changes arrive by long-polling.
 *  - "device": everything lives in this browser (localStorage) and syncs between
 *              tabs/windows with BroadcastChannel. Used on Vercel until a shared
 *              store is approved. Same domain logic (OrderService) runs here.
 */
import { emptyState, MapRepository, type OrderState } from "@/core/orders/memory-repo";
import type { ChangeFeed } from "@/core/orders/ports";
import { OrderService, type TrackResult } from "@/core/orders/service";
import type { CartLine, PlaceOrderResult, StaffOrder } from "@/core/orders/types";
import { toStaff } from "@/core/orders/types";
import type { ScenarioId } from "@/core/sim/simulator";
import { demoClock, getEngine, prepForOrder } from "@/core/world";

export type BackendKind = "server" | "device";

export interface SessionSnapshot {
  seq: number;
  orders: StaffOrder[];
}

export interface OrderBackend {
  kind: BackendKind;
  placeOrder(sessionId: string, kioskId: string, lines: CartLine[], scenario: ScenarioId): Promise<PlaceOrderResult>;
  setReady(sessionId: string, orderId: string, idempotencyKey: string, undo?: boolean): Promise<{ changed: boolean; order: StaffOrder }>;
  sessionOrders(sessionId: string): Promise<SessionSnapshot>;
  watchSession(sessionId: string, onChange: (s: SessionSnapshot) => void): () => void;
  track(tokens: string[]): Promise<TrackResult[]>;
  watchTokens(tokens: string[], onChange: (r: TrackResult[]) => void): () => void;
  close(token: string): Promise<TrackResult>;
  reset(sessionId: string): Promise<void>;
}

export class BackendError extends Error {
  constructor(public code: string, message: string, public status = 0) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method: init?.method ?? (init?.json ? "POST" : "GET"),
      headers: init?.json ? { "content-type": "application/json" } : undefined,
      body: init?.json ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new BackendError("NETWORK", "서버에 연결하지 못했어요. 네트워크를 확인하세요.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BackendError(data.error ?? "HTTP", data.message ?? "요청을 처리하지 못했어요.", res.status);
  return data as T;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((r) => {
    const t = setTimeout(r, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      r();
    });
  });

// ------------------------------------------------------------------ server
export class ServerBackend implements OrderBackend {
  kind = "server" as const;

  placeOrder(sessionId: string, kioskId: string, lines: CartLine[], scenario: ScenarioId) {
    return call<PlaceOrderResult>(`/api/sessions/${sessionId}/orders`, { json: { kioskId, lines, scenario } });
  }
  setReady(sessionId: string, orderId: string, idempotencyKey: string, undo = false) {
    return call<{ changed: boolean; order: StaffOrder }>(`/api/sessions/${sessionId}/orders/${orderId}/ready`, { json: { idempotencyKey, undo } });
  }
  sessionOrders(sessionId: string) {
    return call<SessionSnapshot>(`/api/sessions/${sessionId}/orders`);
  }
  watchSession(sessionId: string, onChange: (s: SessionSnapshot) => void) {
    const ctl = new AbortController();
    (async () => {
      let seq = -1;
      let backoff = 1000;
      while (!ctl.signal.aborted) {
        try {
          const s = await call<SessionSnapshot>(`/api/sessions/${sessionId}/orders?since=${seq}&wait=20000`, { signal: ctl.signal });
          backoff = 1000;
          if (s.seq !== seq) {
            seq = s.seq;
            onChange(s);
          }
        } catch {
          if (ctl.signal.aborted) return;
          await sleep(backoff, ctl.signal);
          backoff = Math.min(8000, backoff * 2);
        }
      }
    })();
    return () => ctl.abort();
  }
  async track(tokens: string[]) {
    return (await call<{ results: TrackResult[] }>(`/api/track`, { json: { tokens } })).results;
  }
  watchTokens(tokens: string[], onChange: (r: TrackResult[]) => void) {
    const ctl = new AbortController();
    if (tokens.length === 0) return () => ctl.abort();
    (async () => {
      let versions: Record<string, number> | undefined;
      let backoff = 1000;
      while (!ctl.signal.aborted) {
        try {
          const { results } = await call<{ results: TrackResult[] }>(`/api/track`, {
            json: { tokens, versions, wait: versions ? 20000 : 0 },
            signal: ctl.signal,
          });
          backoff = 1000;
          versions = Object.fromEntries(results.map((r) => [r.token, r.order?.version ?? -1]));
          onChange(results);
        } catch {
          if (ctl.signal.aborted) return;
          await sleep(backoff, ctl.signal);
          backoff = Math.min(8000, backoff * 2);
        }
      }
    })();
    return () => ctl.abort();
  }
  close(token: string) {
    return call<TrackResult>(`/api/track/close`, { json: { token } });
  }
  async reset(sessionId: string) {
    await call(`/api/sessions/${sessionId}/reset`, { json: {} });
  }
}

// ------------------------------------------------------------------ device
const STORAGE_KEY = "floweat.device-orders.v1";
const CHANNEL = "floweat-orders";

function readState(): OrderState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OrderState) : emptyState();
  } catch {
    return emptyState();
  }
}

class DeviceFeed implements ChangeFeed {
  private channel: BroadcastChannel | null = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
  private listeners = new Set<() => void>();
  constructor() {
    this.channel?.addEventListener("message", () => this.emitLocal());
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) this.emitLocal();
      });
    }
  }
  private emitLocal() {
    this.listeners.forEach((fn) => fn());
  }
  publish() {
    this.channel?.postMessage({ t: Date.now() });
    // same-tab listeners
    queueMicrotask(() => this.emitLocal());
  }
  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  waitForChange(_s: string, _q: number, timeoutMs: number) {
    return new Promise<void>((resolve) => {
      const off = this.onChange(() => {
        off();
        resolve();
      });
      setTimeout(() => {
        off();
        resolve();
      }, timeoutMs);
    });
  }
}

export class DeviceBackend implements OrderBackend {
  kind = "device" as const;
  private feed = new DeviceFeed();
  private repo = new MapRepository({
    read: readState,
    write: (s) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        /* storage full or blocked: state stays in memory for this call only */
      }
    },
  });

  private service(scenario: ScenarioId = "peak") {
    return new OrderService(this.repo, this.feed, { now: () => Date.now() }, (brandId, items, at, extra) => {
      const clock = demoClock(at);
      return prepForOrder(getEngine(clock.dateKey, scenario), clock, brandId, items, extra);
    });
  }

  async placeOrder(sessionId: string, kioskId: string, lines: CartLine[], scenario: ScenarioId) {
    return this.service(scenario).placeOrder({ sessionId, kioskId, lines });
  }
  async setReady(sessionId: string, orderId: string, idempotencyKey: string, undo = false) {
    const svc = this.service();
    const r = undo ? await svc.undoReady(sessionId, orderId, idempotencyKey) : await svc.markReady(sessionId, orderId, idempotencyKey);
    return { changed: r.changed, order: toStaff(r.order) };
  }
  async sessionOrders(sessionId: string) {
    const r = await this.service().sessionOrders(sessionId);
    return { seq: r.seq, orders: r.orders.map(toStaff) };
  }
  watchSession(sessionId: string, onChange: (s: SessionSnapshot) => void) {
    let alive = true;
    const push = () => this.sessionOrders(sessionId).then((s) => alive && onChange(s));
    push();
    const off = this.feed.onChange(push);
    return () => {
      alive = false;
      off();
    };
  }
  track(tokens: string[]) {
    return this.service().track(tokens);
  }
  watchTokens(tokens: string[], onChange: (r: TrackResult[]) => void) {
    let alive = true;
    const push = () => this.track(tokens).then((r) => alive && onChange(r));
    push();
    const off = this.feed.onChange(push);
    // expiry is time-based: re-check periodically
    const timer = setInterval(push, 20_000);
    return () => {
      alive = false;
      off();
      clearInterval(timer);
    };
  }
  close(token: string) {
    return this.service().closeByToken(token);
  }
  async reset(sessionId: string) {
    await this.repo.resetSession(sessionId);
    this.feed.publish();
  }
}

// ------------------------------------------------------------------ selection
const MODE_KEY = "floweat.backend";
let chosen: Promise<OrderBackend> | null = null;

export interface BackendInfo {
  kind: BackendKind;
  reason: "server_shared" | "no_shared_store" | "server_unreachable" | "forced";
}

let info: BackendInfo | null = null;
export function backendInfo(): BackendInfo | null {
  return info;
}

/** ?mode=device / ?mode=server forces a transport (remembered for this browser). */
export function getBackend(): Promise<OrderBackend> {
  if (chosen) return chosen;
  chosen = (async () => {
    let forced: string | null = null;
    try {
      const q = new URLSearchParams(location.search).get("mode");
      if (q === "device" || q === "server" || q === "auto") {
        if (q === "auto") localStorage.removeItem(MODE_KEY);
        else localStorage.setItem(MODE_KEY, q);
      }
      forced = localStorage.getItem(MODE_KEY);
    } catch {
      /* storage blocked */
    }
    if (forced === "device") {
      info = { kind: "device", reason: "forced" };
      return new DeviceBackend();
    }
    try {
      const h = await call<{ sharedAcrossDevices: boolean }>("/api/health");
      if (h.sharedAcrossDevices) {
        info = { kind: "server", reason: forced === "server" ? "forced" : "server_shared" };
        return new ServerBackend();
      }
      info = { kind: "device", reason: "no_shared_store" };
    } catch {
      info = { kind: "device", reason: "server_unreachable" };
    }
    return new DeviceBackend();
  })();
  return chosen;
}
