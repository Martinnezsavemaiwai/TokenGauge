import { describe, it, expect } from "vitest";
import { deriveUsageState, peakPercent, planLabel } from "./usage-state";
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
