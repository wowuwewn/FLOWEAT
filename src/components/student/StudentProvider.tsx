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
import type { MapLayer } from "@/components/map/CommonsMap";

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
  /** most recent "ready" banner; `alertCount` = how many orders are ready and not yet dismissed */
  alert: ReadyAlert | null;
  alertCount: number;
  dismissAlert: () => void;
  /** shown briefly when staff undo a completion — the earlier banner was withdrawn */
  retracted: ReadyAlert | null;
  /** map ↔ list selection and active map layer, shared by mobile and desktop panes */
  selected: string | null;
  setSelected: (id: string | null) => void;
  layer: MapLayer;
  setLayer: (l: MapLayer) => void;
  /** pickup layer: the store whose counter the map points at */
  brandFocus: string | null;
  setBrandFocus: (id: string | null) => void;
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

  const [alerts, setAlerts] = useState<ReadyAlert[]>([]);
  const [retracted, setRetracted] = useState<ReadyAlert | null>(null);
  const seen = useRef<Map<string, string>>(new Map());
  const titleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitle = useRef<string | null>(null);
  const stopTitle = () => {
    if (titleTimer.current) clearInterval(titleTimer.current);
    titleTimer.current = null;
    if (originalTitle.current !== null) document.title = originalTitle.current;
    originalTitle.current = null;
  };

  useEffect(() => {
    if (!tracked) return;
    for (const r of tracked) {
      const prev = seen.current.get(r.token);
      const cur = r.order?.status ?? r.state;
      seen.current.set(r.token, cur);
      if (prev === cur || !r.order) continue;
      const brandName = getBrand(r.order.brandId)?.name ?? "";
      const info: ReadyAlert = { token: r.token, brandName, displayNumber: r.order.displayNumber, at: Date.now() };
      if (prev === "ready" && cur === "accepted") {
        // staff pressed "되돌리기": withdraw everything that announced this order as ready
        setAlerts((a) => a.filter((x) => x.token !== r.token));
        setRetracted(info);
        stopTitle();
        continue;
      }
      if (prev === "accepted" && cur === "ready") {
        setRetracted((x) => (x?.token === r.token ? null : x));
        // one banner per order: a repeated "ready" (after an undo) replaces, never stacks
        setAlerts((a) => [...a.filter((x) => x.token !== r.token), info]);
        try {
          navigator.vibrate?.([140, 70, 140]);
        } catch {
          /* unsupported (e.g. iPhone) — the banner is the guaranteed signal */
        }
        chime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden") {
          try {
            new Notification(`${brandName} ${r.order.displayNumber}번 준비됐어요`, { body: "영수증을 가지고 매장 카운터에서 받아 가세요.", tag: r.token });
          } catch {
            /* some mobile browsers only allow notifications from a service worker */
          }
        }
        // flash the tab title while the page is in the background
        stopTitle();
        originalTitle.current = document.title;
        let on = false;
        const n = r.order.displayNumber;
        titleTimer.current = setInterval(() => {
          if (document.visibilityState === "visible") return stopTitle();
          on = !on;
          document.title = on ? `🔔 ${n}번 준비 완료` : (originalTitle.current ?? document.title);
        }, 1000);
      }
      if (cur === "closed" || cur === "expired") setAlerts((a) => a.filter((x) => x.token !== r.token));
    }
  }, [tracked]);
  useEffect(() => {
    if (!retracted) return;
    const t = setTimeout(() => setRetracted(null), 8000);
    return () => clearTimeout(t);
  }, [retracted]);
  useEffect(() => () => stopTitle(), []);

  const alert = alerts.at(-1) ?? null;
  const dismissAlert = useCallback(() => setAlerts([]), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [layer, setLayer] = useState<MapLayer>("queue");
  const [brandFocus, setBrandFocus] = useState<string | null>(null);
  useEffect(() => {
    const l = new URLSearchParams(location.search).get("layer");
    if (l === "seats" || l === "pickup" || l === "queue") setLayer(l);
  }, []);
  const active = useMemo(
    () => (tracked ?? []).filter((r) => r.state === "ok" && r.order && (r.order.status === "accepted" || r.order.status === "ready")),
    [tracked],
  );

  const value: Ctx = {
    backend, info, session: demo?.session ?? null, scenario: demo?.scenario ?? null, world, engine, refs, tracked, active, alert, alertCount: alerts.length, dismissAlert, retracted,
    selected, setSelected, layer, setLayer, brandFocus, setBrandFocus,
  };
  return <StudentCtx.Provider value={value}>{children}</StudentCtx.Provider>;
}
