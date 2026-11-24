/**
 * Lightweight ByteTrack-style multi-object tracker for people.
 * Two-stage association (high-score, then low-score detections) by IoU after a
 * constant-velocity prediction. IDs are short-lived and never linked to identity.
 */
import { iou, type Detection } from "./detector";

export interface Track {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  score: number;
  hits: number;
  misses: number;
  firstT: number;
  lastT: number;
  confirmed: boolean;
}

export interface TrackerOptions {
  high?: number;
  low?: number;
  iouThr?: number;
  maxMisses?: number;
}

export class ByteTrackLite {
  private tracks: Track[] = [];
  private nextId = 1;
  constructor(private o: Required<TrackerOptions> = { high: 0.5, low: 0.25, iouThr: 0.25, maxMisses: 8 }) {}

  update(dets: Detection[], t: number): Track[] {
    for (const tr of this.tracks) {
      tr.x += tr.vx;
      tr.y += tr.vy;
    }
    const high = dets.filter((d) => d.score >= this.o.high);
    const low = dets.filter((d) => d.score >= this.o.low && d.score < this.o.high);
    const unmatched = new Set(this.tracks);
    const assign = (pool: Detection[], createNew: boolean) => {
      const pairs: { tr: Track; d: Detection; v: number }[] = [];
      for (const tr of unmatched) for (const d of pool) {
        const v = iou(tr, d);
        if (v >= this.o.iouThr) pairs.push({ tr, d, v });
      }
      pairs.sort((a, b) => b.v - a.v);
      const usedD = new Set<Detection>();
      for (const p of pairs) {
        if (!unmatched.has(p.tr) || usedD.has(p.d)) continue;
        unmatched.delete(p.tr);
        usedD.add(p.d);
        const tr = p.tr;
        const nvx = p.d.x - (tr.x - tr.vx);
        const nvy = p.d.y - (tr.y - tr.vy);
        tr.vx = 0.6 * tr.vx + 0.4 * nvx;
        tr.vy = 0.6 * tr.vy + 0.4 * nvy;
        tr.x = p.d.x;
        tr.y = p.d.y;
        tr.w = 0.7 * tr.w + 0.3 * p.d.w;
        tr.h = 0.7 * tr.h + 0.3 * p.d.h;
        tr.score = p.d.score;
        tr.hits++;
        tr.misses = 0;
        tr.lastT = t;
        if (tr.hits >= 2) tr.confirmed = true;
      }
      if (createNew) {
        for (const d of pool) {
          if (usedD.has(d)) continue;
          this.tracks.push({ id: this.nextId++, x: d.x, y: d.y, w: d.w, h: d.h, vx: 0, vy: 0, score: d.score, hits: 1, misses: 0, firstT: t, lastT: t, confirmed: false });
        }
      }
    };
    assign(high, true);
    assign(low, false);
    for (const tr of unmatched) {
      tr.misses++;
      tr.vx *= 0.7;
      tr.vy *= 0.7;
    }
    this.tracks = this.tracks.filter((tr) => tr.misses <= this.o.maxMisses);
    return this.tracks.filter((tr) => tr.confirmed && tr.misses === 0);
  }
}
