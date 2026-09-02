/** A metered rate-limit window reported by the provider. */
export type LimitKind = "session" | "weekly" | "weekly_opus";

export interface UsageLimit {
  kind: LimitKind;
  /** 0–100 */
  percent: number;
  resetAt?: Date;
}

/** One model's tokens over the rolling 24 hours. No per-model limit exists. */
export interface ModelUsage {
  model: string;
  credits: number;
}

/** One local calendar day's tokens, from the provider's own local records. */
export interface DayUsage {
  /** ISO `YYYY-MM-DD`, local time. */
  date: string;
  credits: number;
}

export interface UsageSnapshot {
  usedPercent: number;
  remainingPercent: number;

  /** Absolute usage count — only if the data source provides it */
  used?: number;
  /** Usage quota/limit — only if the data source provides it */
  limit?: number;

  resetAt?: Date;
  currentModel?: string;
  account?: string;

  /** Subscription tier, e.g. "pro" / "max" */
  plan?: string;
  /** Every metered window the plan exposes (session, weekly, …) */
  limits?: UsageLimit[];
  /** Live sync is failing — these are the last known good numbers */
  stale?: boolean;
  /** Seconds since the provider's API last answered — how old `stale` numbers are */
  syncAgeSec?: number;

  /** Where this data came from (for debugging) */
  source?: "local-file" | "cli" | "api" | "mock" | "hybrid";
  /** When this snapshot was captured */
  updatedAt?: Date;

  history?: number[]; // 24 hourly buckets
  /** Per-model tokens over those same 24 hours, biggest first */
  models?: ModelUsage[];
  apiUsedPercent?: number;
}

export type UsageState =
  | "good" // 0–60%
  | "warning" // 60–90%
  | "critical" // 90–99%
  | "full" // 100%
  | "no_access" // Provider not logged in / no credentials
  | "loading" // Fetching data
  | "error"; // Data source unreadable

export interface Provider {
  id: string;
  name: string;
  icon: string;
  getUsage(): Promise<UsageSnapshot>;
  /** Tokens per day, oldest first — only providers that keep local records have it. */
  getHistory?(): Promise<DayUsage[]>;
}
