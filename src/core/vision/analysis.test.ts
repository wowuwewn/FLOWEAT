import { describe, expect, it } from "vitest";
import { SceneAnalyzer, type FrameOut } from "./analysis";
import { COCO, type Detection } from "./detector";
import type { Scene } from "./scenes";

const W = 1000;
const H = 1000;
const box = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** test scene in normalised coords: one lane (service x .40–.60, line above it), a 4-seat table, a single seat */
const scene: Scene = {
  id: "unit", title: "unit", file: "", kind: "semi_synthetic", standsFor: "", camera: "", mapsTo: {}, attribution: "", license: "CC BY 4.0", sourceUrl: "",
  anchor: "bottom",
  lanes: [{ kioskId: "L1", label: "t", service: box(0.4, 0.8, 0.6, 0.95), queue: box(0.4, 0.3, 0.6, 0.8) }],
  tables: [
    { id: "Q", label: "quad", kind: "quad", seats: 4, poly: box(0.0, 0.2, 0.3, 0.5), desk: box(0.0, 0.45, 0.3, 0.6), personH: [0.08, 0.2] },
    { id: "S", label: "single", kind: "single", seats: 1, poly: box(0.75, 0.2, 0.95, 0.5), personH: [0.08, 0.2] },
  ],
};

const person = (cx: number, footY: number, h = 200, score = 0.9, w = 80): Detection => ({ x: cx * W - w / 2, y: footY * H - h, w, h, score, cls: COCO.person });
const seatedAt = (cx: number, cy: number): Detection => ({ x: cx * W - 50, y: cy * H - 60, w: 100, h: 130, score: 0.9, cls: COCO.person });
const item = (cls: number, cx: number, cy: number): Detection => ({ x: cx * W - 15, y: cy * H - 15, w: 30, h: 30, score: 0.6, cls });

function run(seconds: number, fps: number, frame: (t: number) => Detection[], a = new SceneAnalyzer(scene, W, H)): { a: SceneAnalyzer; out: FrameOut[] } {
  const out: FrameOut[] = [];
  for (let i = 0; i <= seconds * fps; i++) out.push(a.step(frame(i / fps), i / fps));
  return { a, out };
}
const at = (out: FrameOut[], t: number) => out.reduce((p, c) => (Math.abs(c.t - t) < Math.abs(p.t - t) ? c : p));

describe("lanes", () => {
  it("separates ordering, waiting, companion and passer per lane", () => {
    const { out } = run(8, 5, (t) => [
      person(0.5, 0.9), // ordering
      person(0.58, 0.88), // companion beside the person ordering
      person(0.5, 0.7, 170), // waiting
      person(0.5, 0.5, 140), // waiting further back
      person(0.05 + t * 0.15, 0.75, 180), // walker crossing through the line zone
    ]);
    const f = at(out, 7);
    expect(f.lanes[0].inUse).toBe(true);
    expect(f.lanes[0].waiting).toBe(2);
    expect(f.lanes[0].companions).toBe(1);
    const walker = f.persons.find((p) => p.x > 0.7 * W && p.y > 0.5 * H);
    expect(walker?.role).not.toBe("waiting");
  });

  it("records a service session and the observed wait of the next person", () => {
    // A orders 0–6 s then leaves; B waits from 0 s and steps up at 6.5 s
    const { a } = run(14, 5, (t) => {
      const d: Detection[] = [];
      if (t < 6) d.push(person(0.5, 0.9));
      // B walks up over ~1 s once A has gone
      const f = Math.min(1, Math.max(0, (t - 6.5) / 1));
      d.push(person(0.5, 0.72 + 0.18 * f, 180 + 20 * f));
      return d;
    });
    a.finish(14);
    expect(a.sessions.length).toBeGreaterThanOrEqual(1);
    expect(a.sessions[0].end - a.sessions[0].start).toBeGreaterThan(4);
    expect(a.waits.length).toBe(1);
    expect(a.waits[0].start - a.waits[0].join).toBeGreaterThan(5);
  });
});

describe("tables", () => {
  it("a genuinely vacated table becomes apparently_empty within ~4 s", () => {
    const { out } = run(12, 5, (t) => (t < 4 ? [seatedAt(0.15, 0.4)] : []));
    expect(at(out, 3).tables[0].state).toBe("occupied");
    expect(at(out, 6).tables[0].state).toBe("occupied"); // short grace for brief absence
    expect(at(out, 8.5).tables[0].state).toBe("apparently_empty");
  });

  it("a bag left on the table holds the seat", () => {
    const { out } = run(15, 5, (t) => (t < 3 ? [seatedAt(0.15, 0.4), item(COCO.backpack, 0.2, 0.5)] : [item(COCO.backpack, 0.2, 0.5)]));
    expect(at(out, 14).tables[0].state).toBe("occupied");
    expect(at(out, 14).tables[0].reason).toBe("bag_hold");
  });

  it("only a cup left behind is uncertain, then empty after it is cleared", () => {
    const { out } = run(20, 5, (t) => (t < 3 ? [seatedAt(0.15, 0.4)] : t < 12 ? [item(COCO.cup, 0.2, 0.5)] : []));
    expect(at(out, 9).tables[0].state).toBe("uncertain");
    expect(at(out, 19).tables[0].state).toBe("apparently_empty");
  });

  it("a passer briefly covering an empty table does not flip it", () => {
    const { out } = run(20, 5, (t) => (t >= 10 && t < 13 ? [person(0.15, 0.62, 520, 0.9, 220)] : []));
    expect(at(out, 9).tables[0].state).toBe("apparently_empty");
    expect(at(out, 12).tables[0].state).toBe("apparently_empty");
  });

  it("long occlusion becomes uncertain instead of guessing", () => {
    const { out } = run(20, 5, (t) => (t < 3 ? [seatedAt(0.15, 0.4)] : t < 20 ? [person(0.15, 0.62, 520, 0.9, 220)] : []));
    expect(at(out, 18).tables[0].state).toBe("uncertain");
  });

  it("single seats are tracked as their own unit", () => {
    const { out } = run(6, 5, () => [seatedAt(0.85, 0.4)]);
    const f = at(out, 5);
    expect(f.tables.find((x) => x.id === "S")?.state).toBe("occupied");
    expect(f.tables.find((x) => x.id === "Q")?.state).toBe("apparently_empty");
  });
});
