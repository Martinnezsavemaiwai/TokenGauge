import type { DayUsage, Provider, UsageSnapshot } from "../types/provider";

export type MockScene = "normal" | "weekly" | "stale" | "local" | "error" | "no_access";

/** Controllable snapshots for the dev harness. Never bundled into a release. */
export class MockProvider implements Provider {
  id = "mock";
  name = "Claude";
  icon = "claude";

  constructor(private percent = 75, private scene: MockScene = "normal") {}

  async getHistory(): Promise<DayUsage[]> {
    const today = new Date();
    return Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - offset));
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const wave = offset === 2 ? 0 : Math.sin(offset) * 0.5 + 0.5;
      return { date, credits: Math.round(wave * this.percent * 2_400_000) };
    });
  }

  async getUsage(): Promise<UsageSnapshot> {
    if (this.scene === "error") throw new Error("mock failure");
    if (this.scene === "no_access") {
      const err = new Error("Usage data file not found");
      err.name = "FileNotFoundError";
      throw err;
    }

    const now = new Date();
    const session = new Date(now.getTime() + 134 * 60_000);
    const weekly = new Date(now.getTime() + (5 * 24 + 13) * 3600_000);
    const history = Array.from({ length: 24 }, (_, hour) =>
      hour < 8 ? 0 : Math.round((Math.sin(hour / 2.4) * 0.5 + 0.6) * 900_000),
    );
    const local = this.scene === "local";

    return {
      usedPercent: local ? 0 : this.percent,
      remainingPercent: local ? 100 : 100 - this.percent,
      used: 6_240_000,
      sessionUsed: 3_900_000,
      resetAt: session,
      account: "mock-account",
      accountLabel: "Mai Work Account",
      plan: "max_20x",
      limits: local
        ? []
        : [
            { kind: "session", percent: this.scene === "weekly" ? 20 : this.percent, resetAt: session },
            { kind: "weekly", percent: this.scene === "weekly" ? 92 : Math.min(100, this.percent * 0.55), resetAt: weekly },
            { kind: "weekly_opus", percent: this.scene === "weekly" ? 66 : Math.min(100, this.percent * 0.24), resetAt: weekly },
          ],
      models: [
        { model: "claude-opus-5-20260401", credits: 41_000_000 },
        { model: "claude-sonnet-5-20260219", credits: 13_600_000 },
        { model: "claude-haiku-4-5-20251001", credits: 2_100_000 },
      ],
      stale: this.scene === "stale",
      syncAgeSec: this.scene === "stale" ? 840 : undefined,
      source: local ? "local-file" : "mock",
      updatedAt: now,
      history,
    };
  }
}
