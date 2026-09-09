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

/** Percentages that earn a notification, highest first. */
const NOTIFY_THRESHOLDS = [100, 90, 80, 60] as const;

/** The highest threshold already announced for one limit window. */
export interface ThresholdMark {
  /** Identifies the window period — the reset timestamp, or "" if the provider reports none. */
  window: string;
  mark: number;
}

/**
 * Whether two reset timestamps name the same window period.
 *
 * The API reports `resets_at` as "now + whatever is left", so the value drifts
 * by the round-trip on every response — 02:59:59.735 one poll, 03:00:00.400 the
 * next. Comparing the raw strings made every poll look like a fresh window,
 * which re-armed every threshold and fired the same notification on a loop.
 * A minute of tolerance absorbs that drift; a real rollover moves the clock by
 * hours, so it still reads as a new window.
 */
const WINDOW_TOLERANCE_MS = 60_000;

function sameWindow(a: string | undefined, b: string): boolean {
  if (a === undefined) return false;
  if (a === b) return true;
  const at = Date.parse(a);
  const bt = Date.parse(b);
  if (Number.isNaN(at) || Number.isNaN(bt)) return false;
  return Math.abs(at - bt) < WINDOW_TOLERANCE_MS;
}

/**
 * The threshold `percent` newly crosses, or `null` when nothing new was reached.
 *
 * Announcements are keyed to the *window period*, not to process lifetime: a
 * mark carried over from a previous reset (or from a previous launch) would
 * otherwise either re-fire every poll or silence the next period entirely.
 */
export function crossedThreshold(
  percent: number,
  previous: ThresholdMark | undefined,
  window: string,
): number | null {
  const carried = sameWindow(previous?.window, window) ? previous!.mark : 0;
  // Re-arm on a reading that dropped: covers providers that report no reset clock.
  const mark = percent < carried - 5 ? 0 : carried;
  const crossed = NOTIFY_THRESHOLDS.find((threshold) => percent >= threshold) ?? 0;
  return crossed > mark ? crossed : null;
}
