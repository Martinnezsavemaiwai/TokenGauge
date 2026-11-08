import type { UsageSnapshot } from "../types/provider";

/**
 * How fast the session window is being spent, and what that pace implies.
 *
 * - `eta`   — at this pace the session limit is reached before it resets.
 * - `safe`  — burning, but the window resets first.
 * - `idle`  — nothing spent in the last hour or so; no pace to project.
 *
 * `null` means the reading cannot be made honestly: no live session window, or
 * nothing local to measure the pace against.
 */
export type Burn =
  | { kind: "idle" }
  | { kind: "safe"; percentPerHour: number }
  | { kind: "eta"; percentPerHour: number; minutesToLimit: number };

/** How long the session window is, used as the horizon when no reset clock is known. */
const SESSION_HOURS = 5;

/**
 * Project the session window forward from the recent token pace.
 *
 * The API reports percent, the session files report tokens, and nothing reports
 * the plan's token ceiling — so the two are bridged by the window they share:
 * the tokens spent since the session window opened are what the percentage
 * measures, which makes `percent / used` this plan's percent-per-token.
 *
 * ponytail: straight-line projection — it ignores tokens ageing out of the
 * rolling window, so it errs early (says "40m" when the true answer is a bit
 * more). Fine for a warning; model the window falling off if it ever has to
 * carry a promise instead.
 */
export function burnRate(snapshot: UsageSnapshot, now = new Date()): Burn | null {
  const session = snapshot.limits?.find((limit) => limit.kind === "session");
  const history = snapshot.history;
  const used = snapshot.sessionUsed ?? snapshot.used;

  if (!session || !history || history.length < 2) return null;
  if (!used || used <= 0 || session.percent <= 0) return null;

  const remaining = 100 - session.percent;
  if (remaining <= 0) return null; // already spent — the ring says so

  // The newest bucket is the hour in progress, so it covers only the minutes
  // elapsed in it; pairing it with the full hour before keeps a fresh hour from
  // reading as a collapse in pace.
  const minutesIntoHour = (snapshot.updatedAt ?? now).getMinutes();
  const hours = 1 + minutesIntoHour / 60;
  const recentTokens = history[history.length - 1] + history[history.length - 2];
  const percentPerHour = (recentTokens / hours) * (session.percent / used);

  if (percentPerHour <= 0) return { kind: "idle" };

  const minutesToLimit = (remaining / percentPerHour) * 60;
  const minutesToReset = session.resetAt
    ? (session.resetAt.getTime() - now.getTime()) / 60_000
    : SESSION_HOURS * 60;

  return minutesToLimit < minutesToReset
    ? { kind: "eta", percentPerHour, minutesToLimit }
    : { kind: "safe", percentPerHour };
}
