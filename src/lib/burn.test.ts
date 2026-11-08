import { describe, it, expect } from "vitest";
import { burnRate } from "./burn";
import type { UsageSnapshot } from "../types/provider";

const NOW = new Date("2026-09-02T12:30:00Z");

/** 12k tokens in the last 1.5h at 50% used / 12k tokens in 5h → 33.3%/hr. */
function snapshot(over: Partial<UsageSnapshot> = {}): UsageSnapshot {
  const history = Array(24).fill(0);
  history[22] = 8000;
  history[23] = 4000;
  return {
    usedPercent: 50,
    remainingPercent: 50,
    used: 12_000,
    history,
    updatedAt: NOW,
    limits: [{ kind: "session", percent: 50, resetAt: new Date(NOW.getTime() + 4 * 3600_000) }],
    ...over,
  };
}

describe("burnRate", () => {
  it("projects the time left at the recent pace", () => {
    const burn = burnRate(snapshot(), NOW);
    expect(burn?.kind).toBe("eta");
    if (burn?.kind !== "eta") throw new Error("expected an eta");
    expect(burn.percentPerHour).toBeCloseTo(100 / 3, 5); // (12000 / 1.5) * (50 / 12000)
    expect(burn.minutesToLimit).toBeCloseTo(90, 0); // 50 remaining at 33.3% per hour
  });

  it("measures against the tokens of the current window when it knows them", () => {
    // Half the rolling 5 hours belonged to the previous window.
    const burn = burnRate(snapshot({ used: 24_000, sessionUsed: 12_000 }), NOW);
    if (burn?.kind !== "eta") throw new Error("expected an eta");
    expect(burn.percentPerHour).toBeCloseTo(100 / 3, 5);
  });

  it("says safe when the window resets before the limit is reached", () => {
    const burn = burnRate(snapshot({ limits: [{ kind: "session", percent: 50, resetAt: new Date(NOW.getTime() + 60_000) }] }), NOW);
    expect(burn?.kind).toBe("safe");
  });

  it("reports idle when nothing was spent recently", () => {
    expect(burnRate(snapshot({ history: Array(24).fill(0) }), NOW)).toEqual({ kind: "idle" });
  });

  it("refuses to guess without a session window or a local token count", () => {
    expect(burnRate(snapshot({ limits: [] }), NOW)).toBeNull();
    expect(burnRate(snapshot({ used: 0 }), NOW)).toBeNull();
  });

  it("says nothing once the limit is already spent", () => {
    expect(burnRate(snapshot({ limits: [{ kind: "session", percent: 100 }] }), NOW)).toBeNull();
  });
});
