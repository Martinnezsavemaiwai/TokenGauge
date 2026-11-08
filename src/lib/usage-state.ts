import type { LimitKind, UsageLimit, UsageSnapshot, UsageState } from "../types/provider";

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
 * The worst percentage across every metered window. The session can sit at
 * 10% while the weekly quota is nearly spent — the tray icon and notifications
 * have to track whichever limit actually bites first.
 */
export function peakPercent(limits: UsageLimit[] | undefined, fallback = 0): number {
  if (!limits || limits.length === 0) return fallback;
  return Math.max(fallback, ...limits.map((l) => l.percent));
}

/**
 * Where a limit's announced mark is stored. Per account, because one shared
 * mark was overwritten on every switch and re-announced each account's
 * threshold when the user came back to it.
 */
export function markKey(account: string | undefined, kind: LimitKind): string {
  return account ? `${account}:${kind}` : kind;
}

/** Percentages that can earn a notification, highest first. */
export const NOTIFY_THRESHOLDS = [100, 90, 80, 60] as const;

export type Mood = "happy" | "worried" | "alarmed" | "spent" | "asleep";

/** How a character feels about its window. `null` means there is no reading. */
export function moodFor(percent: number | null): Mood {
  if (percent === null) return "asleep";
  const state = deriveUsageState(percent);
  if (state === "full") return "spent";
  if (state === "critical") return "alarmed";
  if (state === "warning") return "worried";
  return state === "good" ? "happy" : "asleep";
}

/** Closest to its limit first. Ties keep the provider's own order. */
export function rankLimits(limits: UsageLimit[] | undefined): UsageLimit[] {
  return [...(limits ?? [])].sort((a, b) => b.percent - a.percent);
}

/** Whole percent that never claims 100 before the limit is actually spent. */
export function displayPercent(percent: number): number {
  const rounded = Math.round(Math.max(0, percent));
  return percent < 100 ? Math.min(99, rounded) : rounded;
}

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
  thresholds: readonly number[] = NOTIFY_THRESHOLDS,
): number | null {
  const carried = sameWindow(previous?.window, window) ? previous!.mark : 0;
  // Re-arm on a reading that dropped, only for providers with no reset clock.
  // With a clock, the window says when to re-arm, and a dip is not a new crossing.
  const mark = window === "" && percent < carried - 5 ? 0 : carried;
  const crossed = thresholds.find((threshold) => percent >= threshold) ?? 0;
  return crossed > mark ? crossed : null;
}

/**
 * Whether a window that was spent has come back. Decided from the reset clock
 * the spent window announced, so a failed API call can never read as a refill.
 */
export function quotaReturned(
  mark: ThresholdMark | undefined,
  percent: number | undefined,
  now = Date.now(),
): boolean {
  if (mark?.mark !== 100) return false;
  const resetAt = Date.parse(mark.window);
  if (Number.isNaN(resetAt) || resetAt > now) return false;
  return percent === undefined || percent < 100;
}
