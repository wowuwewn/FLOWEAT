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
import { OrderService, type CallOutcome, type TrackResult } from "@/core/orders/service";
import type { CartLine, PlaceOrderResult, StaffOrder } from "@/core/orders/types";
import { toStaff } from "@/core/orders/types";
import type { ScenarioId } from "@/core/sim/simulator";
import { demoClock, getEngine, prepForOrder } from "@/core/world";
import { operatorKeyStored, staffKeyFor } from "./session";

export type BackendKind = "server" | "device";

export interface SessionSnapshot {
  seq: number;
  orders: StaffOrder[];
  /** server mode: "staff" when this device's staff/operator key was accepted */
  view?: "staff" | "public";
}

export interface OrderBackend {
  kind: BackendKind;
  placeOrder(sessionId: string, kioskId: string, lines: CartLine[], scenario: ScenarioId): Promise<PlaceOrderResult>;
  setReady(sessionId: string, orderId: string, idempotencyKey: string, undo?: boolean): Promise<{ changed: boolean; order: StaffOrder }>;
  /** number-entry device: call (brand, ticket number) in this session */
  callNumber(sessionId: string, brandId: string, number: number, idempotencyKey: string): Promise<{ outcome: CallOutcome; order: StaffOrder | null }>;
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

/** small non-cryptographic digest (FNV-1a) — only used to name a local channel */
function digest(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown; auth?: Record<string, string> }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method: init?.method ?? (init?.json ? "POST" : "GET"),
      headers: { ...(init?.json ? { "content-type": "application/json" } : {}), ...(init?.auth ?? {}) },
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

// ------------------------------------------------------------------ shared long-poll
/**
 * Browsers allow ~6 concurrent HTTP/1.1 connections per host. Every tab/iframe holding its own
 * 20-second long-poll used to exhaust that pool on the laptop demo (5+ surfaces), so a staff
 * "완료" POST could queue for up to ~20 s. Now ONE tab per browser (elected with the Web Locks API)
 * runs each long-poll and fans results out to the others over BroadcastChannel; within a tab,
 * all subscribers share one loop. Followers still fetch the current state once, immediately.
 */
type Loop<T> = (emit: (v: T) => void, signal: AbortSignal) => void;
interface Shared<T> {
  subs: Set<(v: T) => void>;
  last?: T;
  stop: () => void;
}
const sharedFeeds = new Map<string, Shared<unknown>>();

export function sharedFeed<T>(key: string, loop: Loop<T>, initial: () => Promise<T>, onValue: (v: T) => void): () => void {
  let entry = sharedFeeds.get(key) as Shared<T> | undefined;
  if (!entry) {
    const e: Shared<T> = { subs: new Set(), stop: () => {} };
    entry = e;
    sharedFeeds.set(key, e as Shared<unknown>);
    const deliver = (v: T) => {
      e.last = v;
      e.subs.forEach((fn) => fn(v));
    };
    const ctl = new AbortController();
    const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`floweat-feed:${key}`) : null;
    if (bc) bc.onmessage = (m) => deliver(m.data as T);
    const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    if (locks && bc) {
      initial().then((v) => !ctl.signal.aborted && deliver(v)).catch(() => {});
      locks
        .request(`floweat-poll:${key}`, { signal: ctl.signal }, () => new Promise<void>((done) => {
          loop((v) => {
            deliver(v);
            bc.postMessage(v);
          }, ctl.signal);
          ctl.signal.addEventListener("abort", () => done());
        }))
        .catch(() => {});
    } else {
      loop(deliver, ctl.signal);
    }
    e.stop = () => {
      ctl.abort();
      bc?.close();
    };
  }
  entry.subs.add(onValue);
  if (entry.last !== undefined) onValue(entry.last);
  const en = entry;
  return () => {
    en.subs.delete(onValue);
    if (en.subs.size === 0) {
      en.stop();
      sharedFeeds.delete(key);
    }
  };
}

// ------------------------------------------------------------------ server
/** role headers from keys stored on this device (see src/server/auth.ts) */
function staffAuth(sessionId: string): Record<string, string> {
  const h: Record<string, string> = {};
  const k = staffKeyFor(sessionId);
  const op = operatorKeyStored();
  if (k) h["x-floweat-staff"] = k;
  if (op) h["x-floweat-operator"] = op;
  return h;
}

export class ServerBackend implements OrderBackend {
  kind = "server" as const;

  /** operator: get the staff key for a session (for the pairing link) */
  async issueStaffKey(sessionId: string): Promise<string> {
    const op = operatorKeyStored();
    if (!op) throw new BackendError("FORBIDDEN", "운영자 키가 필요해요.", 403);
    return (await call<{ staffKey: string }>(`/api/sessions/${sessionId}/staff-key`, { json: {}, auth: { "x-floweat-operator": op } })).staffKey;
  }

  placeOrder(sessionId: string, kioskId: string, lines: CartLine[], scenario: ScenarioId) {
    return call<PlaceOrderResult>(`/api/sessions/${sessionId}/orders`, { json: { kioskId, lines, scenario } });
  }
  setReady(sessionId: string, orderId: string, idempotencyKey: string, undo = false) {
    return call<{ changed: boolean; order: StaffOrder }>(`/api/sessions/${sessionId}/orders/${orderId}/ready`, { json: { idempotencyKey, undo }, auth: staffAuth(sessionId) });
  }
  callNumber(sessionId: string, brandId: string, number: number, idempotencyKey: string) {
    return call<{ outcome: CallOutcome; order: StaffOrder | null }>(`/api/sessions/${sessionId}/call`, { json: { brandId, number, idempotencyKey }, auth: staffAuth(sessionId) });
  }
  sessionOrders(sessionId: string) {
    return call<SessionSnapshot>(`/api/sessions/${sessionId}/orders`, { auth: staffAuth(sessionId) });
  }
  watchSession(sessionId: string, onChange: (s: SessionSnapshot) => void) {
    const auth = staffAuth(sessionId);
    // staff and public views are different feeds: never fan a staff view out to a public tab or vice versa
    const role = auth["x-floweat-staff"] || auth["x-floweat-operator"] ? `staff:${digest(Object.values(auth).join("|"))}` : "public";
    const loop: Loop<SessionSnapshot> = (emit, signal) => {
      (async () => {
        let seq = -1;
        let backoff = 1000;
        while (!signal.aborted) {
          try {
            const s = await call<SessionSnapshot>(`/api/sessions/${sessionId}/orders?since=${seq}&wait=20000`, { signal, auth });
            backoff = 1000;
            if (s.seq !== seq) {
              seq = s.seq;
              emit(s);
            }
          } catch {
            if (signal.aborted) return;
            await sleep(backoff, signal);
            backoff = Math.min(8000, backoff * 2);
          }
        }
      })();
    };
    let lastSeq = -2;
    return sharedFeed(`session:${sessionId}:${role}`, loop, () => this.sessionOrders(sessionId), (s) => {
      if (s.seq === lastSeq) return;
      lastSeq = s.seq;
      onChange(s);
    });
  }
  async track(tokens: string[]) {
    return (await call<{ results: TrackResult[] }>(`/api/track`, { json: { tokens } })).results;
  }
  watchTokens(tokens: string[], onChange: (r: TrackResult[]) => void) {
    if (tokens.length === 0) return () => {};
    const loop: Loop<TrackResult[]> = (emit, signal) => {
      (async () => {
        let versions: Record<string, number> | undefined;
        let backoff = 1000;
        while (!signal.aborted) {
          try {
            const { results } = await call<{ results: TrackResult[] }>(`/api/track`, {
              json: { tokens, versions, wait: versions ? 20000 : 0 },
              signal,
            });
            backoff = 1000;
            versions = Object.fromEntries(results.map((r) => [r.token, r.order?.version ?? -1]));
            emit(results);
          } catch {
            if (signal.aborted) return;
            await sleep(backoff, signal);
            backoff = Math.min(8000, backoff * 2);
          }
        }
      })();
    };
    // tokens are bearer secrets: the channel/lock name uses a short non-reversible digest, not the tokens
    const key = `track:${digest([...tokens].sort().join(","))}`;
    return sharedFeed(key, loop, () => this.track(tokens), onChange);
  }
  close(token: string) {
    return call<TrackResult>(`/api/track/close`, { json: { token } });
  }
  async reset(sessionId: string) {
    const op = operatorKeyStored();
    await call(`/api/sessions/${sessionId}/reset`, { json: {}, auth: op ? { "x-floweat-operator": op } : {} });
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
  async callNumber(sessionId: string, brandId: string, number: number, idempotencyKey: string) {
    const r = await this.service().callNumber(sessionId, brandId, number, idempotencyKey);
    return { outcome: r.outcome, order: r.order ? toStaff(r.order) : null };
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
