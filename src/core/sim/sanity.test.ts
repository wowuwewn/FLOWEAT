import { describe, expect, it } from "vitest";
import { sanity } from "../../../scripts/sim-sanity";

// Guards against the "26–47 min prep / 132 people in line" class of implausible demo values.
describe("simulation plausibility (calibration.json limits)", () => {
  it("default peak scenario stays within the declared limits", () => {
    const s = sanity("peak", 5);
    expect(s.maxPeoplePerLine).toBeLessThanOrEqual(s.limits.maxPeoplePerLine);
    expect(s.maxPeopleAllLines).toBeLessThanOrEqual(s.limits.maxPeopleAllLines);
    for (const v of Object.values(s.prepP80Min)) expect(v).toBeLessThanOrEqual(s.limits.maxPrepP80Min);
  });
});
