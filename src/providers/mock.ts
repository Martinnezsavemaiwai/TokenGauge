import type { DayUsage, Provider, UsageSnapshot } from "../types/provider";

/**
 * MockProvider — returns controllable UsageSnapshot data for UI development.
 *
 * Does NOT invent a credit system. Returns percentage-based snapshots.
 * The `used` and `limit` fields are only populated when `withAbsoluteNumbers`
 * is true, to test both UI branches.
 */
export class MockProvider implements Provider {
  id = "mock";
  name = "Claude";
  icon = "claude";

  private percent: number;
  private withAbsoluteNumbers: boolean;

  constructor(percent = 42, withAbsoluteNumbers = false) {
    this.percent = percent;
    this.withAbsoluteNumbers = withAbsoluteNumbers;
  }

  setPercent(value: number) {
    this.percent = Math.max(0, Math.min(100, value));
  }

  async getHistory(): Promise<DayUsage[]> {
    const today = new Date();
    return Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - offset));
      const wave = Math.sin(offset) * 0.5 + 0.5;
      return {
        date: day.toISOString().slice(0, 10),
        credits: Math.round(wave * this.percent * 24_000),
      };
    });
  }

  async getUsage(): Promise<UsageSnapshot> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000);

    const currentHour = now.getHours();
    const history = Array.from({ length: 24 }, (_, hour) => {
      if (hour > currentHour) return 0;
      // Deterministic per-hour wave so the dev chart shows realistic-looking bars
      const wave = Math.sin(hour / 3) * 0.5 + 0.5;
      return Math.round(wave * this.percent);
    });

    const snapshot: UsageSnapshot = {
      usedPercent: this.percent,
      used: Math.round(this.percent * 13_000),
      remainingPercent: 100 - this.percent,
      resetAt,
      currentModel: "Claude Sonnet",
      account: "user@example.com",
      plan: "max_20x",
      limits: [
        { kind: "session", percent: this.percent, resetAt: new Date(now.getTime() + 32 * 60 * 1000) },
        { kind: "weekly", percent: Math.min(100, this.percent * 0.8), resetAt },
        { kind: "weekly_opus", percent: Math.min(100, this.percent * 0.45), resetAt },
      ],
      models: [
        { model: "claude-opus-5-20260401", credits: Math.round(this.percent * 9_400) },
        { model: "claude-sonnet-5-20260219", credits: Math.round(this.percent * 3_100) },
        { model: "claude-haiku-4-5-20251001", credits: Math.round(this.percent * 480) },
      ],
      source: "mock",
      updatedAt: now,
      history,
    };

    // Only add absolute numbers if the mock is configured to test that path
    if (this.withAbsoluteNumbers) {
      const limit = 10000;
      snapshot.limit = limit;
      snapshot.used = Math.round((this.percent / 100) * limit);
    }

    return snapshot;
  }
}
