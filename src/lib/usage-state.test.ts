import { describe, it, expect } from "vitest";
import { crossedThreshold, deriveUsageState, isLive, peakPercent, planLabel } from "./usage-state";
import type { UsageLimit } from "../types/provider";

describe("deriveUsageState", () => {
  it.each([
    [-1, "error"],
    [NaN, "error"],
    [0, "good"],
    [59.9, "good"],
    [60, "warning"],
    [89.9, "warning"],
    [90, "critical"],
    [99.9, "critical"],
    [100, "full"],
    [150, "full"],
  ] as const)("%s%% -> %s", (percent, expected) => {
    expect(deriveUsageState(percent)).toBe(expected);
  });
});

describe("peakPercent", () => {
  const limits: UsageLimit[] = [
    { kind: "session", percent: 12 },
    { kind: "weekly", percent: 94 },
    { kind: "weekly_opus", percent: 40 },
  ];

  it("tracks the limit that bites first, not the session", () => {
    expect(peakPercent(limits, 12)).toBe(94);
    expect(deriveUsageState(peakPercent(limits, 12))).toBe("critical");
  });

  it("falls back to the session percent when no windows are reported", () => {
    expect(peakPercent(undefined, 38)).toBe(38);
    expect(peakPercent([], 38)).toBe(38);
  });
});

describe("planLabel", () => {
  it.each([
    ["pro", "Pro"],
    ["max", "Max"],
    ["max_20x", "Max 20×"],
    ["some_new_tier", "Some New Tier"],
  ])("%s -> %s", (plan, expected) => {
    expect(planLabel(plan)).toBe(expected);
  });

  it("renders nothing without a plan", () => {
    expect(planLabel(undefined)).toBeNull();
  });
});

describe("isLive", () => {
  it.each([
    ["hybrid", true],
    ["mock", true],
    ["local-file", false],
    [undefined, false],
  ] as const)("%s -> %s", (source, expected) => {
    expect(isLive({ source })).toBe(expected);
  });
});

describe("crossedThreshold", () => {
  const week = "2026-09-01T00:00:00Z";

  it("announces a threshold once, not on every poll after it", () => {
    expect(crossedThreshold(66, undefined, week)).toBe(60);
    expect(crossedThreshold(67, { window: week, mark: 60 }, week)).toBeNull();
    expect(crossedThreshold(79, { window: week, mark: 60 }, week)).toBeNull();
    expect(crossedThreshold(80, { window: week, mark: 60 }, week)).toBe(80);
  });

  it("stays silent below the lowest threshold", () => {
    expect(crossedThreshold(59, undefined, week)).toBeNull();
    expect(crossedThreshold(0, undefined, week)).toBeNull();
  });

  it("re-arms when the window rolls over to a new reset time", () => {
    const next = "2026-09-08T00:00:00Z";
    expect(crossedThreshold(62, { window: week, mark: 100 }, next)).toBe(60);
  });

  it("re-arms when the reading drops and there is no reset clock", () => {
    expect(crossedThreshold(61, { window: "", mark: 100 }, "")).toBe(60);
    expect(crossedThreshold(97, { window: "", mark: 100 }, "")).toBeNull();
  });
});
