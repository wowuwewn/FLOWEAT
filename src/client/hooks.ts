"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackResult } from "@/core/orders/service";
import type { StaffOrder } from "@/core/orders/types";
import type { ScenarioId } from "@/core/sim/simulator";
import { demoClock, getEngine, worldAt, type Engine, type World, type WorldOptions } from "@/core/world";
import { backendInfo, getBackend, type BackendInfo, type OrderBackend } from "./backend";
import { currentScenario, currentSession } from "./session";
import { setDemoTimeOverride, setRealTimeClock } from "@/core/world";

/**
 * ?t=12:20 pins the demo clock for this tab (recordings, screenshots). ?t=live clears it.
 * ?clock=real (remembered on this device) follows the real KST time during lunch; ?clock=loop returns
 * to the default peak replay.
 */
export function applyTimeOverride() {
  try {
    const c = new URLSearchParams(location.search).get("clock");
    if (c === "real" || c === "loop") localStorage.setItem("floweat.clock", c);
    setRealTimeClock(localStorage.getItem("floweat.clock") === "real");
  } catch {
    /* ignore */
  }
  try {
    const q = new URLSearchParams(location.search).get("t");
    if (q === "live") sessionStorage.removeItem("floweat.t");
    else if (q && /^\d{1,2}:\d{2}$/.test(q)) sessionStorage.setItem("floweat.t", q);
    const v = sessionStorage.getItem("floweat.t");
    if (v) {
      const [h, m] = v.split(":").map(Number);
      setDemoTimeOverride(h * 3600 + m * 60);
    }
  } catch {
    /* ignore */
  }
}

export function useBackend(): { backend: OrderBackend | null; info: BackendInfo | null } {
  const [backend, setBackend] = useState<OrderBackend | null>(null);
  useEffect(() => {
    let alive = true;
    getBackend().then((b) => alive && setBackend(b));
    return () => {
      alive = false;
    };
  }, []);
  return { backend, info: backend ? backendInfo() : null };
}

/** Session code + scenario, read on the client after mount. */
export function useDemoContext() {
  const [ctx, setCtx] = useState<{ session: string; scenario: ScenarioId } | null>(null);
  useEffect(() => {
    applyTimeOverride();
    const update = () => setCtx({ session: currentSession(), scenario: currentScenario() });
    update();
    window.addEventListener("floweat:scenario", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("floweat:scenario", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return ctx;
}

export function useSessionOrders(backend: OrderBackend | null, session: string | undefined) {
  const [state, setState] = useState<{ orders: StaffOrder[]; seq: number; loaded: boolean }>({ orders: [], seq: -1, loaded: false });
  useEffect(() => {
    if (!backend || !session) return;
    return backend.watchSession(session, (s) => setState({ orders: s.orders, seq: s.seq, loaded: true }));
  }, [backend, session]);
  return state;
}

export function useTracked(backend: OrderBackend | null, tokens: string[]) {
  const key = tokens.join(",");
  const [results, setResults] = useState<TrackResult[] | null>(null);
  useEffect(() => {
    if (!backend) return;
    if (!key) {
      setResults([]);
      return;
    }
    return backend.watchTokens(key.split(","), setResults);
  }, [backend, key]);
  return results;
}

/** Ticks every `ms`, aligned so all devices update on the same boundary. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, ms - (Date.now() % ms));
    };
    timer = setTimeout(tick, ms - (Date.now() % ms));
    return () => clearTimeout(timer);
  }, [ms]);
  return now;
}

/** Cafeteria world, recomputed every 15 s (the snapshot interval). */
export function useWorld(scenario: ScenarioId | undefined, opts?: WorldOptions): { world: World | null; engine: Engine | null } {
  const now = useNow(5000);
  const [engine, setEngine] = useState<Engine | null>(null);
  useEffect(() => {
    if (!scenario) return;
    applyTimeOverride();
    // build after first paint so the shell renders immediately
    const id = setTimeout(() => setEngine(getEngine(demoClock(Date.now()).dateKey, scenario)), 0);
    return () => clearTimeout(id);
  }, [scenario]);
  const optsKey = JSON.stringify(opts ?? {});
  const bucket = Math.floor(now / 15000);
  const world = useMemo(() => {
    if (!engine) return null;
    return worldAt(engine, demoClock(bucket * 15000), opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, bucket, optsKey]);
  return { world, engine };
}

/** Accepted demo orders per brand, so live orders raise the brand's prep estimate. */
export function liveBacklogOf(orders: StaffOrder[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of orders) if (o.status === "accepted") out[o.brandId] = (out[o.brandId] ?? 0) + 1;
  return out;
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
