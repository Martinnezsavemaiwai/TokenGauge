/**
 * Format a duration from now until a target date as a compact string.
 * e.g. "5d 14h", "2h 30m", "< 1m"
 */
export function formatTimeUntil(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "now";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return "< 1m";
}

export type TimeAgo = { kind: "now" } | { kind: "seconds" | "minutes" | "hours"; value: number };

/**
 * Compute a relative time from a past date as a unit + value, so callers
 * can render the "ago" phrasing in whichever language is active.
 */
export function timeAgo(date: Date): TimeAgo {
  const ms = Date.now() - date.getTime();
  if (ms < 0) return { kind: "now" };

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return { kind: "hours", value: hours };
  if (minutes > 0) return { kind: "minutes", value: minutes };
  if (seconds < 5) return { kind: "now" };
  return { kind: "seconds", value: seconds };
}

/**
 * Format a number with locale-aware thousands separators.
 * e.g. 6800 → "6,800"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Clock hour a rolling-window bucket belongs to.
 *
 * `history` is 24 hourly buckets, oldest first, where index 23 is the hour the
 * snapshot was taken. Reading the index itself as an hour pinned the chart's
 * right edge to "11 PM" no matter the actual time.
 */
export function bucketHour(index: number, endHour: number): number {
  return (endHour - (23 - index) + 24) % 24;
}
