import { invoke } from "@tauri-apps/api/core";
import type { DayUsage, ModelUsage, Provider, UsageLimit, UsageSnapshot } from "../types/provider";

interface RawUsage {
  usedPercent: number;
  remainingPercent: number;
  used: number;
  sessionUsed: number | null;
  history: number[];
  apiUsedPercent: number | null;
  apiResetAt: string | null;
  weeklyPercent: number | null;
  weeklyResetAt: string | null;
  weeklyOpusPercent: number | null;
  weeklyOpusResetAt: string | null;
  plan: string | null;
  apiStale: boolean;
  apiAgeSecs: number | null;
  models: ModelUsage[];
  accountId: string | null;
  accountLabel: string | null;
  accountsMixed: boolean;
}

/** An unparseable date would throw later, from `toISOString`, and take the window down. */
function toDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function limit(
  kind: UsageLimit["kind"],
  percent: number | null,
  resetAt: string | null,
): UsageLimit | null {
  if (percent === null || percent === undefined) return null;
  return { kind, percent, resetAt: toDate(resetAt) };
}

export class ClaudeProvider implements Provider {
  id = "claude";
  name = "Claude";
  icon = "claude";

  /** Walks the session archives, so it is only called when the History tab asks. */
  async getHistory(): Promise<DayUsage[]> {
    return invoke<DayUsage[]>("get_usage_history");
  }

  async getUsage(): Promise<UsageSnapshot> {
    try {
      const data = await invoke<RawUsage>("get_claude_usage");

      const limits = [
        limit("session", data.apiUsedPercent, data.apiResetAt),
        limit("weekly", data.weeklyPercent, data.weeklyResetAt),
        limit("weekly_opus", data.weeklyOpusPercent, data.weeklyOpusResetAt),
      ].filter((l): l is UsageLimit => l !== null);

      return {
        usedPercent: data.usedPercent,
        remainingPercent: data.remainingPercent,
        used: data.used,
        sessionUsed: data.sessionUsed ?? undefined,
        history: data.history,
        models: data.models,
        resetAt: toDate(data.apiResetAt),
        plan: data.plan ?? undefined,
        account: data.accountId ?? undefined,
        accountLabel: data.accountLabel ?? undefined,
        mixedAccounts: data.accountsMixed,
        limits,
        stale: data.apiStale,
        syncAgeSec: data.apiAgeSecs ?? undefined,
        source: data.apiUsedPercent !== null && data.apiUsedPercent !== undefined ? "hybrid" : "local-file",
        updatedAt: new Date(),
      };
    } catch (e: any) {
      if (typeof e === "string" && e.includes("directory not found")) {
        const err = new Error("Usage data file not found");
        err.name = "FileNotFoundError";
        throw err;
      }
      throw new Error(typeof e === "string" ? e : "Unknown error");
    }
  }
}
