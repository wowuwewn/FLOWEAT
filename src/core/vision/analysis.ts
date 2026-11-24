/**
 * Turns per-frame detections into the aggregate signals FLOWEAT uses:
 *  - service zone: is the kiosk in use, and how long each use lasted
 *  - queue zone: people standing still (walkers passing through are excluded)
 *  - tables: occupied / apparently_empty / uncertain with hysteresis
 * Only aggregates leave this module. No identities, no faces.
 */
import { COCO, ITEM_CUES, type Detection } from "./detector";
import { inPoly, type Pt, type Scene } from "./scenes";
import { ByteTrackLite, type Track } from "./tracker";

export type TableState = "occupied" | "apparently_empty" | "uncertain";

export interface PersonOut {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  role: "service" | "queue" | "passer" | "seated" | "other";
}

export interface FrameOut {
  t: number;
  persons: PersonOut[];
  items: { x: number; y: number; w: number; h: number; cls: number }[];
  service?: { inUse: boolean; elapsed: number | null };
  queue?: { waiting: number; passing: number };
  tables?: { id: string; state: TableState; persons: number; items: number }[];
}

export interface ServiceSession {
  start: number;
  end: number;
}

interface TrackMemo {
  enter: Record<string, number>;
  path: { t: number; x: number; y: number }[];
}

interface TableMemo {
  lastPerson: number;
  lastItem: number;
  state: TableState;
}

export const ANALYSIS_PARAMS = {
  serviceDwell: 1.0,
  serviceGap: 1.5,
  minSession: 3,
  queueDwell: 2.0,
  /** normalised frame widths per second */
  queueMaxSpeed: 0.08,
  tablePersonHold: 3,
  tableGrace: 8,
  tableItemHold: 3,
  personMinScore: 0.35,
};

export class SceneAnalyzer {
  private tracker = new ByteTrackLite();
  private memo = new Map<number, TrackMemo>();
  private tables = new Map<string, TableMemo>();
  private serviceLastSeen = -Infinity;
  private serviceStart: number | null = null;
  readonly sessions: ServiceSession[] = [];

  constructor(public scene: Scene, private W: number, private H: number) {
    for (const z of scene.zones) if (z.type === "table") this.tables.set(z.id, { lastPerson: -Infinity, lastItem: -Infinity, state: "uncertain" });
  }

  private norm(x: number, y: number): Pt {
    return [x / this.W, y / this.H];
  }

  step(dets: Detection[], t: number): FrameOut {
    const people = dets.filter((d) => d.cls === COCO.person && d.score >= ANALYSIS_PARAMS.personMinScore);
    const items = dets.filter((d) => ITEM_CUES.includes(d.cls));
    const tracks = this.tracker.update(people, t);
    const out: FrameOut = { t, persons: [], items: items.map(({ x, y, w, h, cls }) => ({ x, y, w, h, cls })) };

    const service = this.scene.zones.find((z) => z.type === "service");
    const queue = this.scene.zones.find((z) => z.type === "queue");
    let inServiceNow = false;
    let waiting = 0;
    let passing = 0;

    for (const tr of tracks) {
      const m = this.memo.get(tr.id) ?? { enter: {}, path: [] };
      this.memo.set(tr.id, m);
      const foot = this.norm(tr.x + tr.w / 2, tr.y + tr.h);
      m.path.push({ t, x: foot[0], y: foot[1] });
      while (m.path.length && m.path[0].t < t - 1.2) m.path.shift();
      let role: PersonOut["role"] = "other";
      for (const z of [service, queue]) {
        if (!z) continue;
        if (inPoly(foot, z.poly)) m.enter[z.id] ??= t;
        else delete m.enter[z.id];
      }
      if (service && m.enter[service.id] !== undefined && t - m.enter[service.id] >= ANALYSIS_PARAMS.serviceDwell) {
        role = "service";
        inServiceNow = true;
      } else if (queue && m.enter[queue.id] !== undefined) {
        const speed = this.speed(m);
        if (t - m.enter[queue.id] >= ANALYSIS_PARAMS.queueDwell && speed < ANALYSIS_PARAMS.queueMaxSpeed) {
          role = "queue";
          waiting++;
        } else {
          role = "passer";
          passing++;
        }
      }
      out.persons.push({ id: tr.id, x: tr.x, y: tr.y, w: tr.w, h: tr.h, role });
    }
    // drop memory of dead tracks
    const live = new Set(tracks.map((t2) => t2.id));
    for (const id of this.memo.keys()) if (!live.has(id) && (this.memo.get(id)!.path.at(-1)?.t ?? 0) < t - 3) this.memo.delete(id);

    if (service) {
      if (inServiceNow) {
        if (this.serviceStart === null) this.serviceStart = this.earliestServiceEntry(tracks, service.id, t);
        this.serviceLastSeen = t;
      } else if (this.serviceStart !== null && t - this.serviceLastSeen > ANALYSIS_PARAMS.serviceGap) {
        if (this.serviceLastSeen - this.serviceStart >= ANALYSIS_PARAMS.minSession) this.sessions.push({ start: this.serviceStart, end: this.serviceLastSeen });
        this.serviceStart = null;
      }
      out.service = { inUse: this.serviceStart !== null, elapsed: this.serviceStart !== null ? t - this.serviceStart : null };
    }
    if (queue) out.queue = { waiting, passing };

    const tableZones = this.scene.zones.filter((z) => z.type === "table");
    if (tableZones.length) {
      out.tables = tableZones.map((z) => {
        const memo = this.tables.get(z.id)!;
        let persons = 0;
        for (const p of people) if (this.seatedAt(p, z)) persons++;
        let itemCount = 0;
        for (const it of items) {
          const c = this.norm(it.x + it.w / 2, it.y + it.h / 2);
          if ((z.desk && inPoly(c, z.desk)) || inPoly(c, z.poly)) itemCount++;
        }
        if (persons > 0) memo.lastPerson = t;
        if (itemCount > 0) memo.lastItem = t;
        const sincePerson = t - memo.lastPerson;
        const sinceItem = t - memo.lastItem;
        // occlusion: a standing/walking person covers this seat area
        const occluded = people.some((p) => !this.seatedAt(p, z) && inPoly(this.norm(p.x + p.w / 2, p.y + p.h * 0.6), z.poly));
        let next: TableState;
        if (sincePerson <= ANALYSIS_PARAMS.tablePersonHold) next = "occupied";
        else if (sinceItem <= ANALYSIS_PARAMS.tableItemHold) next = "uncertain";
        else if (sincePerson <= ANALYSIS_PARAMS.tableGrace) next = memo.state === "occupied" ? "occupied" : "uncertain";
        else next = "apparently_empty";
        if (occluded && next === "apparently_empty") next = "uncertain";
        memo.state = next;
        return { id: z.id, state: next, persons, items: itemCount };
      });
      for (const p of out.persons) {
        if (p.role === "other" && tableZones.some((z) => this.seatedAt(p, z))) p.role = "seated";
      }
    }
    return out;
  }

  /** Seated at table z: seat point inside the zone, plausible size, head below the seated line. */
  private seatedAt(p: { x: number; y: number; w: number; h: number }, z: Scene["zones"][number]): boolean {
    const seat = this.norm(p.x + p.w / 2, p.y + p.h * 0.45);
    const hFrac = p.h / this.H;
    if (!inPoly(seat, z.poly)) return false;
    if (z.personH && (hFrac < z.personH[0] || hFrac > z.personH[1])) return false;
    if (z.seatedTopMin !== undefined && p.y / this.H < z.seatedTopMin) return false;
    return true;
  }

  private speed(m: TrackMemo): number {
    if (m.path.length < 2) return 0;
    const a = m.path[0];
    const b = m.path[m.path.length - 1];
    const dt = b.t - a.t;
    return dt > 0 ? Math.hypot(b.x - a.x, b.y - a.y) / dt : 0;
  }

  private earliestServiceEntry(tracks: Track[], zoneId: string, t: number): number {
    let s = t;
    for (const tr of tracks) {
      const e = this.memo.get(tr.id)?.enter[zoneId];
      if (e !== undefined) s = Math.min(s, e);
    }
    return s;
  }

  finish(t: number) {
    if (this.serviceStart !== null && this.serviceLastSeen - this.serviceStart >= ANALYSIS_PARAMS.minSession) {
      this.sessions.push({ start: this.serviceStart, end: Math.min(t, this.serviceLastSeen) });
      this.serviceStart = null;
    }
  }
}
