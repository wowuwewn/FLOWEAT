/**
 * Composes the cafeteria "world" at a moment: simulated observations + model outputs.
 * Pure function of (dateKey, scenario, t, extra live orders) → identical on all devices.
 */
import { brands, menusOf, type CookType } from "./catalog";
import { KIOSKS, ZONES } from "./layout";
import type { OrderItem, PrepEstimate } from "./orders/types";
import { estimateWait, fitEtaPrior, fitServiceStats, similarToFastest, waitLevel, type EtaPrior, type WaitLevel } from "./predict/eta";
import { fitForecast, forecastAt, type ForecastModel, type ForecastPoint, type Series } from "./predict/forecast";
import { estimatePrep, fitPrepModel, type PrepModel } from "./predict/prep";
import { hashSeed, median } from "./sim/rng";
import { DAY_END, DAY_START, SCENARIOS, SNAP_SEC, simulateDay, snapIndex, tableStatesAt, type ScenarioId, type SimResult } from "./sim/simulator";
import { COOK_BASE_SEC } from "./sim/simulator";

export type DataMode = "simulated" | "recorded_inference" | "staged_live" | "live";

export const DATA_MODE_LABEL: Record<DataMode, string> = {
  simulated: "시뮬레이션",
  recorded_inference: "테스트 영상 AI 분석 재생",
  staged_live: "연출 영상 실시간 분석",
  live: "실제 현장 연동",
};

export const HISTORY_DAYS = 6;

// ---------------------------------------------------------------- clock
const KST_OFFSET = 9 * 3600 * 1000;
const LOOP_START = 11 * 3600 + 35 * 60;
const LOOP_LEN = 100 * 60;

export interface DemoClock {
  dateKey: string;
  tSec: number;
  /** true when the real KST time is inside lunch service and is used directly */
  realTime: boolean;
}

export function demoClock(nowMs: number): DemoClock {
  const kst = new Date(nowMs + KST_OFFSET);
  const dateKey = kst.toISOString().slice(0, 10);
  const secOfDay = kst.getUTCHours() * 3600 + kst.getUTCMinutes() * 60 + kst.getUTCSeconds();
  if (secOfDay >= 11 * 3600 && secOfDay < 13 * 3600 + 50 * 60) return { dateKey, tSec: secOfDay, realTime: true };
  const loop = Math.floor(nowMs / 1000) % LOOP_LEN;
  return { dateKey, tSec: LOOP_START + loop, realTime: false };
}

export function formatClock(tSec: number): string {
  const h = Math.floor(tSec / 3600);
  const m = Math.floor((tSec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- engine
export interface Engine {
  dateKey: string;
  scenario: ScenarioId;
  today: SimResult;
  history: SimResult[];
  etaPrior: EtaPrior;
  prep: PrepModel;
  linesForecast: ForecastModel;
  tablesForecast: ForecastModel;
  todayLines: Series;
  todayTables: Series;
  buildMs: number;
}

const engines = new Map<string, Engine>();

function seriesOf(sim: SimResult, pick: (i: number) => number): Series {
  const values = new Float64Array(sim.snapTimes.length);
  for (let i = 0; i < values.length; i++) values[i] = pick(i);
  return { t0: DAY_START, step: SNAP_SEC, values };
}

const observedZoneIdx = ZONES.map((z, i) => (z.observed ? i : -1)).filter((i) => i >= 0);
const observedTables = observedZoneIdx.reduce((s, i) => s + ZONES[i].tables, 0);

export function linesSeries(sim: SimResult): Series {
  return seriesOf(sim, (i) => sim.queuePeople.reduce((s, a) => s + a[i], 0));
}
export function tablesSeries(sim: SimResult): Series {
  return seriesOf(sim, (i) => observedZoneIdx.reduce((s, z) => s + sim.zoneBusy[z][i], 0) / observedTables);
}

export function getEngine(dateKey: string, scenario: ScenarioId = "peak"): Engine {
  const k = `${dateKey}|${scenario}`;
  const cached = engines.get(k);
  if (cached) return cached;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const today = simulateDay(dateKey, scenario);
  // history uses the same scenario family with different day seeds
  const history = Array.from({ length: HISTORY_DAYS }, (_, i) => simulateDay(`${dateKey}#h${i + 1}`, scenario));
  const etaPrior = fitEtaPrior(history);
  const prep = fitPrepModel(history.flatMap((h) => h.orders), brands.length);
  const linesForecast = fitForecast(history.map(linesSeries));
  const tablesForecast = fitForecast(history.map(tablesSeries), undefined, [0, 1]);
  const engine: Engine = {
    dateKey, scenario, today, history, etaPrior, prep, linesForecast, tablesForecast,
    todayLines: linesSeries(today), todayTables: tablesSeries(today),
    buildMs: (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
  };
  if (engines.size > 6) engines.delete(engines.keys().next().value!);
  engines.set(k, engine);
  return engine;
}

// ---------------------------------------------------------------- world
export type TableLevel = "free" | "normal" | "busy" | "full";

export interface KioskView {
  id: string;
  label: string;
  side: "left" | "right";
  depth: number;
  people: number;
  inService: boolean;
  p20: number;
  p50: number;
  p80: number;
  baselineSec: number;
  meanServiceSec: number;
  samples: number;
  level: WaitLevel;
  isFastest: boolean;
  similar: boolean;
  source: DataMode;
}

export interface ZoneView {
  id: string;
  name: string;
  description: string;
  tables: number;
  observed: boolean;
  occupied: number;
  uncertain: number;
  apparentlyEmpty: number;
  /** occupied / tables, and (occupied + uncertain) / tables */
  rateLow: number;
  rateHigh: number;
  level: TableLevel;
  source: DataMode;
}

export interface BrandView {
  id: string;
  name: string;
  cuisine: string;
  backlog: number;
  liveOrders: number;
  p20: number;
  p50: number;
  p80: number;
}

export interface World {
  clock: DemoClock;
  scenario: ScenarioId;
  scenarioName: string;
  kiosks: KioskView[];
  zones: ZoneView[];
  brands: BrandView[];
  overall: {
    fastestP20: number;
    fastestP80: number;
    slowestP50: number;
    linePeople: number;
    tableRateLow: number;
    tableRateHigh: number;
    tableLevel: TableLevel;
    observedTables: number;
    unobservedTables: number;
  };
  forecast: { lines: ForecastPoint[] | null; tables: ForecastPoint[] | null };
  trend: { t: number[]; lines: number[]; tables: number[] };
}

export function tableLevel(rate: number): TableLevel {
  if (rate < 0.6) return "free";
  if (rate < 0.8) return "normal";
  if (rate < 0.93) return "busy";
  return "full";
}

/** Camera-model of a table's observed status from its simulated true status. */
export function observeTable(tableIdx: number, trueState: number): "occupied" | "apparently_empty" | "uncertain" {
  const h = hashSeed(`table-${tableIdx}`);
  if (h % 13 === 0) return "uncertain"; // blind spot / occluded by a pillar
  if (trueState === 0) return "apparently_empty";
  if (trueState === 1) return h % 10 < 6 ? "uncertain" : "occupied"; // bag only
  return "occupied";
}

export interface WorldOptions {
  /** live demo orders waiting per brand (accepted, not ready) */
  liveBacklog?: Record<string, number>;
  /** per-kiosk observation override, e.g. from video inference replay */
  kioskOverride?: Partial<Record<string, { people: number; inServiceElapsed: number | null; source: DataMode }>>;
  /** per-zone table observation override (first N tables of a zone) */
  zoneOverride?: Partial<Record<string, { states: ("occupied" | "apparently_empty" | "uncertain")[]; source: DataMode }>>;
}

export function worldAt(engine: Engine, clock: DemoClock, opts: WorldOptions = {}): World {
  const sim = engine.today;
  const t = Math.max(DAY_START, Math.min(DAY_END, clock.tSec));
  const i = snapIndex(sim, t);
  const stats = fitServiceStats(sim.txs, KIOSKS.length, t, engine.etaPrior);

  const raw = KIOSKS.map((k, ki) => {
    const ov = opts.kioskOverride?.[k.id];
    const people = ov ? ov.people : sim.queuePeople[ki][i];
    const since = sim.serviceSince[ki][i];
    const inServiceElapsed = ov ? ov.inServiceElapsed : since >= 0 ? Math.max(0, t - since) : null;
    const e = estimateWait({ kiosk: ki, people, inServiceElapsed, t }, stats, engine.etaPrior, 400, engine.dateKey);
    return { k, people, inService: inServiceElapsed !== null, e, source: ov?.source ?? ("simulated" as DataMode) };
  });
  const p50s = raw.map((r) => r.e.p50);
  const similar = similarToFastest(p50s);
  const fastestIdx = p50s.indexOf(Math.min(...p50s));
  const kiosks: KioskView[] = raw.map((r, ki) => ({
    id: r.k.id, label: r.k.label, side: r.k.side, depth: r.k.depth, people: r.people, inService: r.inService,
    p20: r.e.p20, p50: r.e.p50, p80: r.e.p80, baselineSec: r.e.baselineSec, meanServiceSec: r.e.meanServiceSec,
    samples: r.e.samples, level: waitLevel(r.e.p50), isFastest: ki === fastestIdx, similar: similar[ki], source: r.source,
  }));

  // tables
  const states = tableStatesAt(sim, t);
  const zones: ZoneView[] = ZONES.map((z, zi) => {
    let occupied = 0;
    let uncertain = 0;
    let empty = 0;
    const ov = opts.zoneOverride?.[z.id];
    let n = 0;
    sim.tables.forEach((tb, ti) => {
      if (tb.zone !== zi) return;
      const st = ov && n < ov.states.length ? ov.states[n] : observeTable(ti, states[ti]);
      n++;
      if (st === "occupied") occupied++;
      else if (st === "uncertain") uncertain++;
      else empty++;
    });
    const rateLow = occupied / z.tables;
    const rateHigh = (occupied + uncertain) / z.tables;
    return {
      id: z.id, name: z.name, description: z.description, tables: z.tables, observed: z.observed,
      occupied, uncertain, apparentlyEmpty: empty, rateLow, rateHigh, level: tableLevel((rateLow + rateHigh) / 2),
      source: ov?.source ?? "simulated",
    };
  });
  const obs = zones.filter((z) => z.observed);
  const obsTables = obs.reduce((s, z) => s + z.tables, 0);
  const tableRateLow = obs.reduce((s, z) => s + z.occupied, 0) / obsTables;
  const tableRateHigh = obs.reduce((s, z) => s + z.occupied + z.uncertain, 0) / obsTables;

  // brands
  const brandViews: BrandView[] = brands.map((b, bi) => {
    const live = opts.liveBacklog?.[b.id] ?? 0;
    const backlog = sim.brandBacklog[bi][i] + live;
    const mains = menusOf(b.id).filter((m) => !m.isSide);
    const ests = mains.map((m) => estimatePrep(engine.prep, bi, m.cookType, 1, backlog)).filter((e) => Number.isFinite(e.p50));
    return {
      id: b.id, name: b.name, cuisine: b.cuisine, backlog, liveOrders: live,
      p20: median(ests.map((e) => e.p20)), p50: median(ests.map((e) => e.p50)), p80: median(ests.map((e) => e.p80)),
    };
  });

  // trend: last 45 min at 1-min resolution
  const trendT: number[] = [];
  const trendL: number[] = [];
  const trendTb: number[] = [];
  for (let s = t - 45 * 60; s <= t; s += 60) {
    if (s < DAY_START) continue;
    const j = snapIndex(sim, s);
    trendT.push(s);
    trendL.push(engine.todayLines.values[j]);
    trendTb.push(engine.todayTables.values[j]);
  }

  const fastest = kiosks[fastestIdx];
  return {
    clock,
    scenario: engine.scenario,
    scenarioName: SCENARIOS[engine.scenario].name,
    kiosks,
    zones,
    brands: brandViews,
    overall: {
      fastestP20: fastest.p20,
      fastestP80: fastest.p80,
      slowestP50: Math.max(...p50s),
      linePeople: kiosks.reduce((s, k) => s + k.people, 0),
      tableRateLow,
      tableRateHigh,
      tableLevel: tableLevel((tableRateLow + tableRateHigh) / 2),
      observedTables: obsTables,
      unobservedTables: zones.filter((z) => !z.observed).reduce((s, z) => s + z.tables, 0),
    },
    forecast: {
      lines: forecastAt(engine.linesForecast, engine.todayLines, t),
      tables: forecastAt(engine.tablesForecast, engine.todayTables, t),
    },
    trend: { t: trendT, lines: trendL, tables: trendTb },
  };
}

/** Prep estimate for a concrete order (used by kiosks when issuing tickets). */
export function prepForOrder(engine: Engine, clock: DemoClock, brandId: string, items: OrderItem[], liveAhead: number): PrepEstimate | null {
  const bi = brands.findIndex((b) => b.id === brandId);
  if (bi < 0) return null;
  const menus = menusOf(brandId);
  let main: CookType = "side";
  let count = 0;
  for (const it of items) {
    const m = menus.find((x) => x.id === it.menuId);
    if (!m) continue;
    count += it.qty;
    if (COOK_BASE_SEC[m.cookType] > COOK_BASE_SEC[main]) main = m.cookType;
  }
  const i = snapIndex(engine.today, clock.tSec);
  const ahead = engine.today.brandBacklog[bi][i] + liveAhead;
  const e = estimatePrep(engine.prep, bi, main, count, ahead);
  if (!Number.isFinite(e.p50)) return null;
  return { p50: Math.round(e.p50), p80: Math.round(e.p80), method: "menu-base+backlog-slope", dataMode: "simulated" };
}

/** Per-menu estimate at the current backlog (menu list + kiosk one-liner). */
export function prepForMenu(engine: Engine, clock: DemoClock, menuId: string, liveAhead = 0) {
  const brandId = menuId.split("-")[0];
  const bi = brands.findIndex((b) => b.id === brandId);
  const m = menusOf(brandId).find((x) => x.id === menuId);
  if (bi < 0 || !m) return null;
  const i = snapIndex(engine.today, clock.tSec);
  return estimatePrep(engine.prep, bi, m.cookType, 1, engine.today.brandBacklog[bi][i] + liveAhead);
}
