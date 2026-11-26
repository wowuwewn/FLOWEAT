import { describe, expect, it } from "vitest";
import { brands } from "./catalog";
import { MONITOR_GROUPS, MONITOR_PAGE_MS, monitorPage } from "./monitor";

describe("shared call monitor", () => {
  it("covers every brand exactly once in five-column groups", () => {
    const all = MONITOR_GROUPS.flat();
    expect(MONITOR_GROUPS.every((g) => g.length === 5)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(brands.map((b) => b.id).sort());
  });

  it("two screens with the same data show the same page at any moment", () => {
    const ready = [
      { brandId: "kaohsiung", readyAt: 1_000_000 },
      { brandId: "jang51", readyAt: 1_005_000 },
    ];
    for (let t = 990_000; t < 1_100_000; t += 1_700) expect(monitorPage(ready, t)).toBe(monitorPage([...ready], t));
  });

  it("jumps to the group of the newest call, then alternates on the clock", () => {
    const ready = [{ brandId: "jang51", readyAt: 1_000_000 }];
    expect(monitorPage(ready, 1_000_500)).toBe(1);
    expect(monitorPage([{ brandId: "popo420", readyAt: 1_000_000 }], 1_000_500)).toBe(0);
    // after 30 s the page follows the wall clock
    const late = 1_000_000 + 40_000;
    expect(monitorPage(ready, late)).toBe(Math.floor(late / MONITOR_PAGE_MS) % 2);
    // an undone call is no longer in the list → nothing to jump to
    expect(monitorPage([], 1_000_500)).toBe(Math.floor(1_000_500 / MONITOR_PAGE_MS) % 2);
  });
});
