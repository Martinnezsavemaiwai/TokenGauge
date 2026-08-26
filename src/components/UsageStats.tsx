import type { ReactNode } from "react";
import type { UsageSnapshot } from "../types/provider";
import { formatNumber, formatTimeUntil } from "../lib/format";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";
import { isLive } from "../lib/usage-state";

interface UsageStatsProps {
  snapshot: UsageSnapshot;
  language?: Language;
}

/**
 * The block that sits beside the ring: headline number, then one meta line per
 * fact worth knowing (when the session resets, what is being metered, whether
 * the numbers are live). Owning all three lines here keeps the hover popup and
 * the flyout reading identically.
 *
 * Without live API data there is no trustworthy denominator, so the headline
 * falls back to the raw local token count — never an invented percentage.
 */
export function UsageStats({ snapshot, language = "en" }: UsageStatsProps) {
  const live = isLive(snapshot);
  const hasLocal = snapshot.used != null;
  // no_access / error: the ring already says "—", so say nothing here.
  if (!live && !hasLocal) return null;

  const sessionReset = snapshot.limits?.find((limit) => limit.kind === "session")?.resetAt ?? snapshot.resetAt;

  return (
    <div className="flex flex-col gap-2 min-w-0 flex-1">
      <div
        className="text-base font-semibold truncate tabular-nums leading-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {live ? (
          <>
            {snapshot.usedPercent.toFixed(1)}%{" "}
            <span className="text-xs font-normal" style={{ color: "var(--color-text-secondary)" }}>
              {t(language, "usedPercentAllModels")}
            </span>
          </>
        ) : (
          <>
            {formatNumber(snapshot.used ?? 0)}{" "}
            <span className="text-xs font-normal" style={{ color: "var(--color-text-secondary)" }}>
              {t(language, "tokensLast5h")}
            </span>
          </>
        )}
      </div>

      {live && sessionReset && (
        <MetaLine
          icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        >
          {t(language, "limitSession")} · {t(language, "resetsIn")} {formatTimeUntil(sessionReset)}
        </MetaLine>
      )}

      {snapshot.currentModel && (
        <MetaLine
          color={snapshot.stale ? "var(--color-status-warning)" : undefined}
          icon={
            <span
              className="block w-1.5 h-1.5 rounded-full"
              style={{ background: snapshot.stale ? "var(--color-status-warning)" : "var(--color-accent)" }}
            />
          }
        >
          {snapshot.currentModel}
          {live && ` · ${t(language, snapshot.stale ? "syncStale" : "liveApiSyncActive")}`}
        </MetaLine>
      )}
    </div>
  );
}

function MetaLine({ icon, children, color }: { icon: ReactNode; children: ReactNode; color?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 text-xs min-w-0"
      style={{ color: color ?? "var(--color-text-secondary)" }}
    >
      <span className="shrink-0 flex items-center justify-center w-3">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}
