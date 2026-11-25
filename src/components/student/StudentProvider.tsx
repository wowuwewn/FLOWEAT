"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getBrand } from "@/core/catalog";
import type { TrackResult } from "@/core/orders/service";
import type { ScenarioId } from "@/core/sim/simulator";
import type { Engine, World } from "@/core/world";
import type { BackendInfo, OrderBackend } from "@/client/backend";
import { liveBacklogOf, useBackend, useDemoContext, useNow, useSessionOrders, useTracked, useWorld } from "@/client/hooks";
import { loadReplay, useVisionLinked, visionOverrides, type Replay } from "@/client/vision";
import { useMyOrders, type MyOrderRef } from "@/client/my-orders";

export interface ReadyAlert {
  token: string;
  brandName: string;
  displayNumber: number;
  at: number;
}

interface Ctx {
  backend: OrderBackend | null;
  info: BackendInfo | null;
  session: string | null;
  scenario: ScenarioId | null;
  world: World | null;
  engine: Engine | null;
  refs: MyOrderRef[];
  tracked: TrackResult[] | null;
  active: TrackResult[];
  alert: ReadyAlert | null;
  dismissAlert: () => void;
}

const StudentCtx = createContext<Ctx | null>(null);

export function useStudent(): Ctx {
  const c = useContext(StudentCtx);
  if (!c) throw new Error("useStudent outside provider");
  return c;
}

function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const play = (f: number, t: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.55);
    };
    play(880, 0);
    play(1318.5, 0.16);
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio blocked until user gesture — vibration/banner still work */
  }
}

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const refs = useMyOrders();
  const tokens = useMemo(() => refs.map((r) => r.token), [refs]);
  const tracked = useTracked(backend, tokens);
  const sessionOrders = useSessionOrders(backend, demo?.session);
  const liveBacklog = useMemo(() => liveBacklogOf(sessionOrders.orders), [sessionOrders.orders]);
  const linked = useVisionLinked();
  const [replays, setReplays] = useState<{ lanes: Replay; tables: Replay } | null>(null);
  useEffect(() => {
    if (!linked || replays) return;
    Promise.all([loadReplay("bank_oblique"), loadReplay("tables")]).then(([lanes, tables]) => setReplays({ lanes, tables })).catch(() => {});
  }, [linked, replays]);
  const tick = useNow(linked ? 2000 : 60_000);
  const overrides = linked && replays ? visionOverrides(replays.lanes, replays.tables, tick) : {};
  const { world, engine } = useWorld(demo?.scenario, { liveBacklog, ...overrides });

  const [alert, setAlert] = useState<ReadyAlert | null>(null);
  const seen = useRef<Map<string, string>>(new Map());
  const titleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tracked) return;
    for (const r of tracked) {
      const prev = seen.current.get(r.token);
      const cur = r.order?.status ?? r.state;
      seen.current.set(r.token, cur);
      if (prev === "accepted" && cur === "ready" && r.order) {
        const brandName = getBrand(r.order.brandId)?.name ?? "";
        setAlert({ token: r.token, brandName, displayNumber: r.order.displayNumber, at: Date.now() });
        try {
          navigator.vibrate?.([140, 70, 140]);
        } catch {
          /* unsupported */
        }
        chime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden") {
          try {
            new Notification(`${brandName} ${r.order.displayNumber}번 준비됐어요`, { body: "매장 카운터에서 받아 가세요.", tag: r.token });
          } catch {
            /* some mobile browsers only allow notifications from a service worker */
          }
        }
        // flash the tab title while the page is in the background
        const original = document.title;
        let on = false;
        if (titleTimer.current) clearInterval(titleTimer.current);
        titleTimer.current = setInterval(() => {
          if (document.visibilityState === "visible") {
            document.title = original;
            if (titleTimer.current) clearInterval(titleTimer.current);
            return;
          }
          on = !on;
          document.title = on ? `🔔 ${r.order!.displayNumber}번 준비 완료` : original;
        }, 1000);
      }
    }
  }, [tracked]);

  const dismissAlert = useCallback(() => setAlert(null), []);
  const active = useMemo(
    () => (tracked ?? []).filter((r) => r.state === "ok" && r.order && (r.order.status === "accepted" || r.order.status === "ready")),
    [tracked],
  );

  const value: Ctx = {
    backend, info, session: demo?.session ?? null, scenario: demo?.scenario ?? null, world, engine, refs, tracked, active, alert, dismissAlert,
  };
  return <StudentCtx.Provider value={value}>{children}</StudentCtx.Provider>;
}
