/**
 * Turns per-frame detections into the aggregates FLOWEAT uses (v2, multi-lane).
 *
 * Per kiosk lane (independently):
 *   ordering   — the person standing at the kiosk (longest dwell in the service zone)
 *   companion  — someone standing next to the person ordering, not in the line
 *   waiting    — standing still in the line behind the person ordering
 *   passer     — walking through, approaching or leaving (never counted as waiting)
 *   → in-use state, elapsed time, completed use sessions, line count, observed waits
 * Per table unit (4-seat table or single seat):
 *   occupied / apparently_empty / uncertain, with item cues (bag → held seat,
 *   tableware only → uncertain), short grace for brief absence and occlusion handling.
 * Only aggregates leave this module. No identities, faces or images.
 */
import { COCO, ITEM_CUES, type Detection } from "./detector";
import { inPoly, polyBounds, type Pt, type Scene, type TableSpec } from "./scenes";
import { ByteTrackLite } from "./tracker";

export type TableState = "occupied" | "apparently_empty" | "uncertain";
export type Role = "other" | "ordering" | "waiting" | "passer" | "seated" | "companion";
export const ROLES: Role[] = ["other", "ordering", "waiting", "passer", "seated", "companion"];

export interface PersonOut {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  role: Role;
  lane: number;
}

export interface LaneOut {
  kioskId: string;
  inUse: boolean;
  elapsed: number | null;
  waiting: number;
  companions: number;
  passing: number;
}

export interface TableOut {
  id: string;
  state: TableState;
  persons: number;
  items: number;
  reason: "person" | "bag_hold" | "brief_absence" | "tableware" | "occluded" | "empty" | "warming_up";
}

export interface FrameOut {
  t: number;
  persons: PersonOut[];
  items: { x: number; y: number; w: number; h: number; cls: number }[];
  lanes: LaneOut[];
  tables: TableOut[];
}

export interface ServiceSession {
  lane: number;
  start: number;
  end: number;
}

export interface ObservedWait {
  lane: number;
  join: number;
  start: number;
}

export const ANALYSIS_PARAMS = {
  /** seconds inside the service zone before counting as ordering */
  serviceDwell: 1.0,
  /** seconds the zone must stay empty before a use session ends */
  serviceGap: 1.5,
  minSession: 4.5,
  /** seconds standing in the line zone before counting as waiting */
  queueDwell: 1.2,
  /** body heights per second; perspective-independent speed */
  standSpeed: 0.22,
  walkSpeed: 0.45,
  tablePersonHold: 2.5,
  /** brief absence with no item left behind */
  tableGrace: 3.5,
  /** bag/backpack seen for this long with nobody → seat counted as held */
  bagHold: 3,
  tableItemHold: 3,
  /** max seconds to keep the previous state while the table is hidden */
  occlusionHold: 6,
  /** share of the table zone that must be covered to count as occlusion */
  occlusionCover: 0.35,
  personMinScore: 0.35,
};

const BAGS = new Set<number>([COCO.backpack, COCO.handbag, COCO.suitcase]);

interface TrackMemo {
  enter: Record<string, number>;
  path: { t: number; x: number; y: number; h: number }[];
  role: Role;
  lane: number;
  queueSince: number | null;
  queueLane: number;
}

interface TableMemo {
  lastPerson: number;
  lastBag: number;
  lastItem: number;
  bagSince: number | null;
  state: TableState;
  reason: TableOut["reason"];
  occludedSince: number | null;
}

interface LaneMemo {
  start: number | null;
  lastSeen: number;
  orderer: number | null;
}

export class SceneAnalyzer {
  private tracker = new ByteTrackLite();
  private memo = new Map<number, TrackMemo>();
  private tableMemo = new Map<string, TableMemo>();
  private laneMemo: LaneMemo[];
  readonly sessions: ServiceSession[] = [];
  readonly waits: ObservedWait[] = [];

  constructor(public scene: Scene, private W: number, private H: number) {
    for (const t of scene.tables) this.tableMemo.set(t.id, { lastPerson: -Infinity, lastBag: -Infinity, lastItem: -Infinity, bagSince: null, state: "uncertain", reason: "warming_up", occludedSince: null });
    this.laneMemo = scene.lanes.map(() => ({ start: null, lastSeen: -Infinity, orderer: null }));
  }

  private norm(x: number, y: number): Pt {
    return [x / this.W, y / this.H];
  }

  private anchor(b: { x: number; y: number; w: number; h: number }): Pt {
    const y = this.scene.anchor === "bottom" ? b.y + b.h : this.scene.anchor === "top" ? b.y : b.y + b.h / 2;
    return this.norm(b.x + b.w / 2, y);
  }

  step(dets: Detection[], t: number): FrameOut {
    const people = dets.filter((d) => d.cls === COCO.person && d.score >= ANALYSIS_PARAMS.personMinScore);
    const items = dets.filter((d) => ITEM_CUES.includes(d.cls));
    const tracks = this.tracker.update(people, t);
    const lanes = this.scene.lanes;
    const laneOut: LaneOut[] = lanes.map((l) => ({ kioskId: l.kioskId, inUse: false, elapsed: null, waiting: 0, companions: 0, passing: 0 }));
    const persons: PersonOut[] = [];

    // 1) zone membership + speed for each confirmed track
    const inService: { tr: (typeof tracks)[number]; m: TrackMemo; lane: number; dwell: number }[] = [];
    for (const tr of tracks) {
      const m = this.memo.get(tr.id) ?? { enter: {}, path: [], role: "other" as Role, lane: -1, queueSince: null, queueLane: -1 };
      this.memo.set(tr.id, m);
      const a = this.anchor(tr);
      m.path.push({ t, x: a[0] * this.W, y: a[1] * this.H, h: tr.h });
      while (m.path.length && m.path[0].t < t - 1.2) m.path.shift();
      lanes.forEach((l, i) => {
        for (const [key, poly] of [[`s${i}`, l.service], [`q${i}`, l.queue]] as const) {
          if (inPoly(a, poly)) m.enter[key] ??= t;
          else delete m.enter[key];
        }
      });
      const sLane = lanes.findIndex((_, i) => m.enter[`s${i}`] !== undefined);
      if (sLane >= 0 && t - m.enter[`s${sLane}`] >= ANALYSIS_PARAMS.serviceDwell && this.speed(m) < ANALYSIS_PARAMS.walkSpeed) {
        inService.push({ tr, m, lane: sLane, dwell: t - m.enter[`s${sLane}`] });
      }
    }

    // 2) per lane: the longest-dwelling person in the service zone is ordering, others are companions
    const assigned = new Map<number, { role: Role; lane: number }>();
    lanes.forEach((_, i) => {
      const here = inService.filter((s) => s.lane === i).sort((a, b) => b.dwell - a.dwell);
      here.forEach((s, k) => assigned.set(s.tr.id, { role: k === 0 ? "ordering" : "companion", lane: i }));
    });

    for (const tr of tracks) {
      const m = this.memo.get(tr.id)!;
      let role: Role = "other";
      let lane = -1;
      const as = assigned.get(tr.id);
      const speed = this.speed(m);
      if (as) {
        role = as.role;
        lane = as.lane;
        if (role === "ordering" && m.queueSince !== null && m.queueLane === lane) {
          this.waits.push({ lane, join: m.queueSince, start: m.enter[`s${lane}`] ?? t });
          m.queueSince = null;
        }
      } else {
        const qLane = lanes.findIndex((_, i) => m.enter[`q${i}`] !== undefined);
        if (qLane >= 0) {
          const dwell = t - m.enter[`q${qLane}`];
          const wasWaiting = m.role === "waiting" && m.lane === qLane;
          // sticky: a waiting person shuffling forward stays waiting unless clearly walking
          if ((dwell >= ANALYSIS_PARAMS.queueDwell && speed < ANALYSIS_PARAMS.standSpeed) || (wasWaiting && speed < ANALYSIS_PARAMS.walkSpeed)) {
            role = "waiting";
            lane = qLane;
            if (m.queueSince === null || m.queueLane !== qLane) {
              m.queueSince = m.enter[`q${qLane}`];
              m.queueLane = qLane;
            }
          } else {
            role = "passer";
            lane = qLane;
          }
        } else if (speed >= ANALYSIS_PARAMS.standSpeed) {
          role = "passer";
        }
      }
      m.role = role;
      m.lane = lane;
      if (lane >= 0) {
        const lo = laneOut[lane];
        if (role === "waiting") lo.waiting++;
        else if (role === "companion") lo.companions++;
        else if (role === "passer") lo.passing++;
      }
      persons.push({ id: tr.id, x: tr.x, y: tr.y, w: tr.w, h: tr.h, role, lane });
    }

    // 3) lane use sessions
    lanes.forEach((_, i) => {
      const lm = this.laneMemo[i];
      const ordering = persons.find((p) => p.role === "ordering" && p.lane === i);
      if (ordering && lm.start !== null && lm.orderer !== null && lm.orderer !== ordering.id) {
        // a different person stepped up: close the previous use
        if (lm.lastSeen - lm.start >= ANALYSIS_PARAMS.minSession) this.sessions.push({ lane: i, start: lm.start, end: lm.lastSeen });
        lm.start = null;
      }
      if (ordering) {
        if (lm.start === null) lm.start = this.memo.get(ordering.id)?.enter[`s${i}`] ?? t;
        lm.orderer = ordering.id;
        lm.lastSeen = t;
      } else if (lm.start !== null && t - lm.lastSeen > ANALYSIS_PARAMS.serviceGap) {
        if (lm.lastSeen - lm.start >= ANALYSIS_PARAMS.minSession) this.sessions.push({ lane: i, start: lm.start, end: lm.lastSeen });
        lm.start = null;
      }
      laneOut[i].inUse = lm.start !== null;
      laneOut[i].elapsed = lm.start !== null ? t - lm.start : null;
    });

    // garbage-collect memories of lost tracks
    const live = new Set(tracks.map((x) => x.id));
    for (const [id, m] of this.memo) if (!live.has(id) && (m.path.at(-1)?.t ?? 0) < t - 3) this.memo.delete(id);

    // 4) tables
    const tables = this.scene.tables.map((z) => this.table(z, people, items, t));
    for (const p of persons) if (p.role === "other" && this.scene.tables.some((z) => this.seatedAt(p, z))) p.role = "seated";

    return { t, persons, items: items.map(({ x, y, w, h, cls }) => ({ x, y, w, h, cls })), lanes: laneOut, tables };
  }

  private table(z: TableSpec, people: Detection[], items: Detection[], t: number): TableOut {
    const memo = this.tableMemo.get(z.id)!;
    const seated = Math.min(z.seats, people.filter((p) => this.seatedAt(p, z)).length);
    let bags = 0;
    let ware = 0;
    for (const it of items) {
      const c = this.norm(it.x + it.w / 2, it.y + it.h / 2);
      if ((z.desk && inPoly(c, z.desk)) || inPoly(c, z.poly)) BAGS.has(it.cls) ? bags++ : ware++;
    }
    if (seated > 0) memo.lastPerson = t;
    if (bags > 0) {
      memo.lastBag = t;
      memo.bagSince ??= t;
    } else if (t - memo.lastBag > ANALYSIS_PARAMS.tableItemHold) memo.bagSince = null;
    if (ware > 0) memo.lastItem = t;

    // occlusion: a non-seated person covers a large part of the table zone
    const b = polyBounds(z.poly);
    const zoneArea = (b.x1 - b.x0) * (b.y1 - b.y0);
    const covered = people.some((p) => {
      if (this.seatedAt(p, z)) return false;
      const x0 = Math.max(b.x0, p.x / this.W);
      const y0 = Math.max(b.y0, p.y / this.H);
      const x1 = Math.min(b.x1, (p.x + p.w) / this.W);
      const y1 = Math.min(b.y1, (p.y + p.h) / this.H);
      return Math.max(0, x1 - x0) * Math.max(0, y1 - y0) >= ANALYSIS_PARAMS.occlusionCover * zoneArea;
    });

    let state: TableState;
    let reason: TableOut["reason"];
    if (t - memo.lastPerson <= ANALYSIS_PARAMS.tablePersonHold) [state, reason] = ["occupied", "person"];
    else if (memo.bagSince !== null && t - memo.bagSince >= ANALYSIS_PARAMS.bagHold) [state, reason] = ["occupied", "bag_hold"];
    else if (t - memo.lastPerson <= ANALYSIS_PARAMS.tableGrace) [state, reason] = ["occupied", "brief_absence"];
    else if (t - memo.lastItem <= ANALYSIS_PARAMS.tableItemHold || bags > 0) [state, reason] = ["uncertain", "tableware"];
    else [state, reason] = ["apparently_empty", "empty"];

    if (covered && state === "apparently_empty") {
      memo.occludedSince ??= t;
      if (t - memo.occludedSince <= ANALYSIS_PARAMS.occlusionHold && memo.state !== "apparently_empty") [state, reason] = [memo.state, "occluded"];
      else if (t - memo.occludedSince > ANALYSIS_PARAMS.occlusionHold) [state, reason] = ["uncertain", "occluded"];
    } else if (!covered) memo.occludedSince = null;

    memo.state = state;
    memo.reason = reason;
    return { id: z.id, state, persons: seated, items: bags + ware, reason };
  }

  /** Seated at table z: seat point inside the zone, plausible size, head below the seated line. */
  private seatedAt(p: { x: number; y: number; w: number; h: number }, z: TableSpec): boolean {
    const seat = this.norm(p.x + p.w / 2, p.y + p.h * 0.45);
    const hFrac = p.h / this.H;
    if (!inPoly(seat, z.poly)) return false;
    if (z.personH && (hFrac < z.personH[0] || hFrac > z.personH[1])) return false;
    if (z.seatedTopMin !== undefined && p.y / this.H < z.seatedTopMin) return false;
    return true;
  }

  /** anchor speed in body heights per second (perspective independent) */
  private speed(m: TrackMemo): number {
    if (m.path.length < 2) return 0;
    const a = m.path[0];
    const b = m.path[m.path.length - 1];
    const dt = b.t - a.t;
    const h = (a.h + b.h) / 2;
    return dt > 0 && h > 0 ? Math.hypot(b.x - a.x, b.y - a.y) / h / dt : 0;
  }

  finish(t: number) {
    this.laneMemo.forEach((lm, i) => {
      if (lm.start !== null && lm.lastSeen - lm.start >= ANALYSIS_PARAMS.minSession) this.sessions.push({ lane: i, start: lm.start, end: Math.min(t, lm.lastSeen) });
      lm.start = null;
    });
  }
}
