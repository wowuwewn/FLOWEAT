/**
 * Deterministic discrete-time simulation of a lunch service at 1947 COMMONS.
 *
 * Purpose: the safe default demo data source (data mode "simulated") and the training
 * history for the prediction models. It is NOT real cafeteria data. Every parameter
 * below is a modelling assumption documented in docs/ai/prediction.md.
 *
 * Same (seed, scenario) → identical result on every device, so all screens agree
 * without a shared database.
 */
import { brands, menusOf, type CookType, type Menu } from "../catalog";
import { KIOSKS, ZONES } from "../layout";
import { lognormal, normal, pickWeighted, poisson, rngFrom, type Rng } from "./rng";
import calibrationJson from "../data/calibration.json";

/** All simulation assumptions live in src/core/data/calibration.json (replace with field data). */
export const CALIBRATION = calibrationJson;
const C = calibrationJson;
const hhmm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export const DAY_START = 10 * 3600 + 50 * 60; // 10:50 (seconds since midnight)
export const DAY_END = 14 * 3600 + 10 * 60; // 14:10
export const SNAP_SEC = 15;

export type ScenarioId = "peak" | "calm" | "skew";

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  arrivalScale: number;
  leftBias: number;
  /** chance a person switches sides after glancing at the other side's lines */
  switchProb: number;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  peak: { id: "peak", name: "점심 피크", description: "12시 전후로 몰리는 평일 점심", arrivalScale: 1, leftBias: 0.5, switchProb: 0.55 },
  calm: { id: "calm", name: "한산한 날", description: "시험 기간처럼 방문이 적은 날", arrivalScale: 0.45, leftBias: 0.5, switchProb: 0.55 },
  skew: { id: "skew", name: "왼쪽 쏠림", description: "입구 왼쪽 줄로 사람이 몰리는 날", arrivalScale: 1, leftBias: 0.68, switchProb: 0.12 },
};

/** Hidden per-kiosk speed factors. The prediction model must discover them from logs. */
export const KIOSK_SPEED: Record<string, number> = C.kiosk.speed;

/** Ground-truth median cook seconds per cooking type (simulation assumption). */
export const COOK_BASE_SEC: Record<CookType, number> = C.kitchen.cookBaseSec;

/** cooks = parallel cooking slots (pots, fryers, burners) — assumption */
interface BrandKitchen { cooks: number; eff: number; popularity: number }
export const KITCHENS: Record<string, BrandKitchen> = C.kitchen.brands;

export interface TxRecord { kiosk: number; start: number; end: number; group: number; persons: number }
export interface GroupRecord {
  id: number; size: number; arrive: number; kiosk: number; queueJoin: number; peopleAheadAtJoin: number;
  serviceStart: number; serviceEnd: number; txCount: number; holds: boolean; seatedAt: number; leaveAt: number;
}
export interface BrandOrderRecord {
  brand: number; menuIds: string[]; mainType: CookType; items: number; accept: number; ready: number; backlogAhead: number;
}
export type TableKind = 1 | 2 | 3; // 1 held by bag only, 2 held with a person, 3 occupied while eating
export interface TableInterval { table: number; start: number; end: number; kind: TableKind }
export interface TableSpec { zone: number; seats: number; observed: boolean; idxInZone: number }

export interface SimResult {
  seed: string;
  scenario: ScenarioId;
  snapTimes: Float64Array;
  /** [kiosk][snap] people waiting in line (excluding the group at the kiosk) */
  queuePeople: Int16Array[];
  /** [kiosk][snap] transactions waiting in line */
  queueTx: Int16Array[];
  /** [kiosk][snap] start time of the transaction currently in progress, or -1 */
  serviceSince: Float64Array[];
  /** [brand][snap] unfinished orders */
  brandBacklog: Int16Array[];
  /** [zone][snap] tables with any activity (held or occupied) */
  zoneBusy: Int16Array[];
  /** [zone][snap] tables held by a bag with nobody present */
  zoneBagOnly: Int16Array[];
  peopleInHall: Int16Array;
  tables: TableSpec[];
  tableIntervals: TableInterval[];
  groups: GroupRecord[];
  txs: TxRecord[];
  orders: BrandOrderRecord[];
}

interface LiveGroup extends GroupRecord {
  txLeft: number;
  pendingOrders: number;
  lastReady: number;
  table: number;
  tableKindStart: number;
  waitingSeat: boolean;
}

interface Cooking { rec: BrandOrderRecord; groupId: number; remaining: number }

const GROUP_SIZES = C.groups.sizes;
const GROUP_WEIGHTS = C.groups.weights;

function arrivalRatePerMin(tSec: number, scale: number, peakShiftMin: number, amp: number): number {
  const m = tSec / 60;
  const a = C.arrivals;
  const peak1 = hhmm(a.peak1Center) + peakShiftMin;
  const peak2 = hhmm(a.peak2Center) + peakShiftMin * 0.5;
  const r = a.basePerMin + a.peak1PerMin * amp * Math.exp(-((m - peak1) ** 2) / (2 * a.peak1SigmaMin ** 2)) + a.peak2PerMin * amp * Math.exp(-((m - peak2) ** 2) / (2 * a.peak2SigmaMin ** 2));
  // taper at the very end of service
  const tail = m > 13 * 60 + 50 ? Math.max(0, 1 - (m - (13 * 60 + 50)) / 20) : 1;
  return r * scale * tail;
}

export function simulateDay(seed: string, scenarioId: ScenarioId = "peak"): SimResult {
  const sc = SCENARIOS[scenarioId];
  const rng: Rng = rngFrom(`${seed}|${scenarioId}`);
  const dayRng: Rng = rngFrom(`${seed}|day`);
  const amp = C.arrivals.dayAmplitude[0] + (C.arrivals.dayAmplitude[1] - C.arrivals.dayAmplitude[0]) * dayRng();
  const peakShift = (dayRng() - 0.5) * 2 * C.arrivals.dayShiftMin;

  const K = KIOSKS.length;
  const B = brands.length;
  const brandIdx = new Map(brands.map((b, i) => [b.id, i]));
  const brandMains: Menu[][] = brands.map((b) => menusOf(b.id).filter((m) => !m.isSide));
  const brandSides: Menu[][] = brands.map((b) => menusOf(b.id).filter((m) => m.isSide));
  const popularity = brands.map((b) => KITCHENS[b.id]?.popularity ?? 1);

  // tables
  const tables: TableSpec[] = [];
  ZONES.forEach((z, zi) => {
    for (let i = 0; i < z.tables; i++) tables.push({ zone: zi, seats: z.seatsPerTable, observed: z.observed, idxInZone: i });
  });
  const tableState = new Int8Array(tables.length); // 0 free, 1 bag, 2 held+person, 3 eating
  const freeSingles: number[] = [];
  const freeQuads: number[] = [];
  tables.forEach((t, i) => (t.seats === 1 ? freeSingles : freeQuads).push(i));
  const tableIntervals: TableInterval[] = [];

  const takeTable = (size: number): number => {
    const pool = size === 1 && freeSingles.length > 0 && rng() < 0.75 ? freeSingles : freeQuads.length > 0 ? freeQuads : size === 1 ? freeSingles : null;
    if (!pool || pool.length === 0) return -1;
    const j = Math.floor(rng() * pool.length);
    const id = pool[j];
    pool[j] = pool[pool.length - 1];
    pool.pop();
    return id;
  };
  const releaseTable = (id: number) => (tables[id].seats === 1 ? freeSingles : freeQuads).push(id);

  // kiosks
  const queues: number[][] = Array.from({ length: K }, () => []);
  const atKiosk: (LiveGroup | null)[] = new Array(K).fill(null);
  const txRemaining = new Float64Array(K);
  const txStart = new Float64Array(K).fill(-1);
  const txPersons = new Int8Array(K);

  // kitchens
  const kitchenQueue: Cooking[][] = Array.from({ length: B }, () => []);
  const cooking: Cooking[][] = Array.from({ length: B }, () => []);

  const groups: LiveGroup[] = [];
  const txs: TxRecord[] = [];
  const orders: BrandOrderRecord[] = [];
  const seatWaiters: LiveGroup[] = [];
  const eating: LiveGroup[] = [];

  const nSnaps = Math.floor((DAY_END - DAY_START) / SNAP_SEC) + 1;
  const snapTimes = new Float64Array(nSnaps);
  const queuePeople = Array.from({ length: K }, () => new Int16Array(nSnaps));
  const queueTx = Array.from({ length: K }, () => new Int16Array(nSnaps));
  const serviceSince = Array.from({ length: K }, () => new Float64Array(nSnaps));
  const brandBacklog = Array.from({ length: B }, () => new Int16Array(nSnaps));
  const zoneBusy = ZONES.map(() => new Int16Array(nSnaps));
  const zoneBagOnly = ZONES.map(() => new Int16Array(nSnaps));
  const peopleInHall = new Int16Array(nSnaps);

  const visiblePeople = (k: number) => queues[k].reduce((s, gid) => s + groups[gid].size, 0);
  const visibleTx = (k: number) => queues[k].reduce((s, gid) => s + groups[gid].txLeft, 0);

  const startTx = (k: number, g: LiveGroup, t: number) => {
    const persons = g.txCount === 1 ? g.size : 1;
    const hesitant = rng() < C.kiosk.hesitantShare ? C.kiosk.hesitantFactor : 1;
    const dur = lognormal(rng, C.kiosk.txMedianSec * KIOSK_SPEED[KIOSKS[k].id] * (1 + C.kiosk.perExtraPerson * (persons - 1)), C.kiosk.logSd) * hesitant;
    txRemaining[k] = Math.max(12, dur);
    txStart[k] = t;
    txPersons[k] = persons;
  };

  const placeOrders = (g: LiveGroup, persons: number, t: number) => {
    const perBrand = new Map<number, Menu[]>();
    let prevBrand = -1;
    for (let p = 0; p < persons; p++) {
      const b = prevBrand >= 0 && rng() < 0.45 ? prevBrand : pickWeighted(rng, brands.map((_, i) => i), popularity);
      prevBrand = b;
      const mains = brandMains[b];
      const list = perBrand.get(b) ?? [];
      list.push(mains[Math.floor(rng() * mains.length)]);
      if (brandSides[b].length > 0 && rng() < 0.12) list.push(brandSides[b][Math.floor(rng() * brandSides[b].length)]);
      perBrand.set(b, list);
    }
    for (const [b, items] of perBrand) {
      const main = items.reduce((a, m) => (COOK_BASE_SEC[m.cookType] > COOK_BASE_SEC[a.cookType] ? m : a), items[0]);
      const k = KITCHENS[brands[b].id];
      const backlogAhead = kitchenQueue[b].length + cooking[b].length;
      const rec: BrandOrderRecord = {
        brand: b, menuIds: items.map((m) => m.id), mainType: main.cookType, items: items.length, accept: t, ready: -1, backlogAhead,
      };
      orders.push(rec);
      const work = lognormal(rng, COOK_BASE_SEC[main.cookType] * k.eff, C.kitchen.cookLogSd) + C.kitchen.perExtraItemSec * (items.length - 1);
      kitchenQueue[b].push({ rec, groupId: g.id, remaining: work });
      g.pendingOrders++;
    }
  };

  const seat = (g: LiveGroup, t: number): boolean => {
    let table = g.table;
    if (table >= 0) {
      // close the hold interval
      tableIntervals.push({ table, start: g.tableKindStart, end: t, kind: tableState[table] as TableKind });
    } else {
      table = takeTable(g.size);
      if (table < 0) return false;
      g.table = table;
    }
    tableState[table] = 3;
    g.tableKindStart = t;
    g.seatedAt = t;
    const dwell = lognormal(rng, g.size === 1 ? 15 * 60 : 21 * 60, 0.24);
    g.leaveAt = t + dwell;
    eating.push(g);
    return true;
  };

  let snap = 0;
  for (let t = DAY_START; t <= DAY_END; t++) {
    // 1. arrivals
    const n = poisson(rng, arrivalRatePerMin(t, sc.arrivalScale, peakShift, amp) / 60);
    for (let a = 0; a < n; a++) {
      const size = pickWeighted(rng, GROUP_SIZES, GROUP_WEIGHTS);
      let side: "left" | "right" = rng() < sc.leftBias ? "left" : "right";
      const shortest = (sd: string) =>
        Math.min(...KIOSKS.map((kk, k) => (kk.side === sd ? visiblePeople(k) + (atKiosk[k] ? 1 : 0) : Infinity)));
      const other = side === "left" ? "right" : "left";
      if (shortest(side) - shortest(other) >= 4 && rng() < sc.switchProb) side = other;
      let best = -1;
      let bestScore = Infinity;
      KIOSKS.forEach((kk, k) => {
        if (kk.side !== side) return;
        const busy = atKiosk[k] ? 1 : 0;
        const score = visiblePeople(k) + busy + (kk.depth - 1) * 0.7 + normal(rng) * 0.9;
        if (score < bestScore) {
          bestScore = score;
          best = k;
        }
      });
      const txCount = size === 1 ? 1 : rng() < C.groups.payTogether ? 1 : size;
      const g: LiveGroup = {
        id: groups.length, size, arrive: t, kiosk: best, queueJoin: t, peopleAheadAtJoin: visiblePeople(best),
        serviceStart: -1, serviceEnd: -1, txCount, holds: false, seatedAt: -1, leaveAt: -1,
        txLeft: txCount, pendingOrders: 0, lastReady: -1, table: -1, tableKindStart: t, waitingSeat: false,
      };
      if (rng() < (size >= 2 ? 0.4 : 0.22)) {
        const table = takeTable(size);
        if (table >= 0) {
          g.holds = true;
          g.table = table;
          tableState[table] = size >= 2 && rng() < 0.5 ? 2 : 1;
          g.tableKindStart = t;
        }
      }
      groups.push(g);
      queues[best].push(g.id);
    }

    // 2. kiosks
    for (let k = 0; k < K; k++) {
      const g = atKiosk[k];
      if (g) {
        txRemaining[k] -= 1;
        if (txRemaining[k] <= 0) {
          txs.push({ kiosk: k, start: txStart[k], end: t, group: g.id, persons: txPersons[k] });
          placeOrders(g, txPersons[k], t);
          g.txLeft--;
          if (g.txLeft > 0) startTx(k, g, t);
          else {
            g.serviceEnd = t;
            atKiosk[k] = null;
            txStart[k] = -1;
          }
        }
      }
      if (!atKiosk[k] && queues[k].length > 0) {
        const next = groups[queues[k].shift()!];
        next.serviceStart = t;
        atKiosk[k] = next;
        startTx(k, next, t);
      }
    }

    // 3. kitchens
    for (let b = 0; b < B; b++) {
      const cooks = KITCHENS[brands[b].id]?.cooks ?? 1;
      while (cooking[b].length < cooks && kitchenQueue[b].length > 0) cooking[b].push(kitchenQueue[b].shift()!);
      for (let i = cooking[b].length - 1; i >= 0; i--) {
        const c = cooking[b][i];
        c.remaining -= 1;
        if (c.remaining <= 0) {
          c.rec.ready = t;
          cooking[b].splice(i, 1);
          const g = groups[c.groupId];
          g.pendingOrders--;
          g.lastReady = t;
          if (g.pendingOrders === 0 && g.txLeft === 0) {
            g.waitingSeat = true;
            g.lastReady = t + 30 + Math.floor(rng() * 60); // walk to counter and pick up
            seatWaiters.push(g);
          }
        }
      }
    }

    // 4. seating
    if (seatWaiters.length > 0) {
      for (let i = seatWaiters.length - 1; i >= 0; i--) {
        const g = seatWaiters[i];
        if (t < g.lastReady) continue;
        if ((t - g.lastReady) % 10 !== 0 && g.table < 0 && t - g.lastReady > 0) continue;
        if (seat(g, t)) seatWaiters.splice(i, 1);
      }
    }
    for (let i = eating.length - 1; i >= 0; i--) {
      const g = eating[i];
      if (t >= g.leaveAt) {
        tableIntervals.push({ table: g.table, start: g.tableKindStart, end: t, kind: 3 });
        tableState[g.table] = 0;
        releaseTable(g.table);
        eating.splice(i, 1);
      }
    }

    // 5. snapshot
    if ((t - DAY_START) % SNAP_SEC === 0) {
      snapTimes[snap] = t;
      for (let k = 0; k < K; k++) {
        queuePeople[k][snap] = visiblePeople(k);
        queueTx[k][snap] = visibleTx(k);
        serviceSince[k][snap] = txStart[k];
      }
      for (let b = 0; b < B; b++) brandBacklog[b][snap] = kitchenQueue[b].length + cooking[b].length;
      const busy = new Int16Array(ZONES.length);
      const bag = new Int16Array(ZONES.length);
      for (let i = 0; i < tables.length; i++) {
        if (tableState[i] !== 0) busy[tables[i].zone]++;
        if (tableState[i] === 1) bag[tables[i].zone]++;
      }
      for (let z = 0; z < ZONES.length; z++) {
        zoneBusy[z][snap] = busy[z];
        zoneBagOnly[z][snap] = bag[z];
      }
      let inHall = 0;
      for (const g of eating) inHall += g.size;
      for (const g of seatWaiters) inHall += g.size;
      peopleInHall[snap] = inHall;
      snap++;
    }
  }
  // close open intervals at day end
  for (const g of eating) tableIntervals.push({ table: g.table, start: g.tableKindStart, end: DAY_END + 3600, kind: 3 });
  groups.forEach((g) => {
    if (g.table >= 0 && g.seatedAt < 0) tableIntervals.push({ table: g.table, start: g.tableKindStart, end: DAY_END + 3600, kind: tableState[g.table] as TableKind });
  });
  tableIntervals.sort((a, b) => a.table - b.table || a.start - b.start);

  return {
    seed, scenario: scenarioId, snapTimes, queuePeople, queueTx, serviceSince, brandBacklog, zoneBusy, zoneBagOnly, peopleInHall,
    tables, tableIntervals,
    groups: groups.map((g) => ({
      id: g.id, size: g.size, arrive: g.arrive, kiosk: g.kiosk, queueJoin: g.queueJoin, peopleAheadAtJoin: g.peopleAheadAtJoin,
      serviceStart: g.serviceStart, serviceEnd: g.serviceEnd, txCount: g.txCount, holds: g.holds, seatedAt: g.seatedAt, leaveAt: g.leaveAt,
    })),
    txs,
    orders,
  };
}

/** Index of the last snapshot at or before t. */
export function snapIndex(sim: SimResult, t: number): number {
  const i = Math.floor((t - DAY_START) / SNAP_SEC);
  return Math.max(0, Math.min(sim.snapTimes.length - 1, i));
}

/** Table state at time t: 0 free, 1 bag only, 2 held with person, 3 eating. */
export function tableStatesAt(sim: SimResult, t: number): Int8Array {
  const out = new Int8Array(sim.tables.length);
  for (const iv of sim.tableIntervals) if (iv.start <= t && t < iv.end) out[iv.table] = iv.kind;
  return out;
}

export function brandIndex(id: string): number {
  return brands.findIndex((b) => b.id === id);
}
