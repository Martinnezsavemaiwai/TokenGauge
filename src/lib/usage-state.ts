import type { UsageLimit, UsageSnapshot, UsageState } from "../types/provider";

/**
 * Whether the snapshot carries a measured percentage at all. Without a live API
 * window there is no trustworthy denominator — the local token count is real,
 * any percentage derived from it is not.
 */
export function isLive(snapshot: Pick<UsageSnapshot, "source">): boolean {
  return snapshot.source === "hybrid" || snapshot.source === "mock";
}

/** Derive the usage state from a percentage value (0–100). */
export function deriveUsageState(percent: number): UsageState {
  if (percent < 0 || Number.isNaN(percent)) return "error";
  if (percent >= 100) return "full";
  if (percent >= 90) return "critical";
  if (percent >= 60) return "warning";
  return "good";
}

/** Map a UsageState to its CSS custom property color. */
export function stateColor(state: UsageState): string {
  switch (state) {
    case "good":
      return "var(--color-status-good)";
    case "warning":
      return "var(--color-status-warning)";
    case "critical":
    case "full":
      return "var(--color-status-critical)";
    case "no_access":
    case "loading":
    case "error":
      return "var(--color-status-disabled)";
  }
}

/** Human-readable label for a usage state. */
export function stateLabel(state: UsageState): string {
  switch (state) {
    case "good":
      return "Good";
    case "warning":
      return "Warning";
    case "critical":
      return "Critical";
    case "full":
      return "Fully Used";
    case "no_access":
      return "No Access";
    case "loading":
      return "Loading…";
    case "error":
      return "Error";
  }
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
  max_5x: "Max 5×",
  max_20x: "Max 20×",
  team: "Team",
  enterprise: "Enterprise",
};

/** Display name for a subscription tier, e.g. "max_20x" → "Max 20×". */
export function planLabel(plan?: string): string | null {
  if (!plan) return null;
  const key = plan.toLowerCase();
  return PLAN_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The worst percentage across every metered window. The session ring can sit at
 * 10% while the weekly quota is nearly spent — the tray icon and notifications
 * have to track whichever limit actually bites first.
 */
export function peakPercent(limits: UsageLimit[] | undefined, fallback = 0): number {
  if (!limits || limits.length === 0) return fallback;
  return Math.max(fallback, ...limits.map((l) => l.percent));
}
