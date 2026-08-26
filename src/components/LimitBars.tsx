import { motion } from "framer-motion";
import type { UsageLimit } from "../types/provider";
import { deriveUsageState, planLabel, stateColor } from "../lib/usage-state";
import { formatTimeUntil } from "../lib/format";
import type { Language } from "../hooks/useSettings";
import { t, type StringKey } from "../lib/i18n";

const LABEL_KEYS: Record<UsageLimit["kind"], StringKey> = {
  session: "limitSession",
  weekly: "limitWeekly",
  weekly_opus: "limitWeeklyOpus",
};

interface LimitBarsProps {
  limits?: UsageLimit[];
  language?: Language;
}

/**
 * Plan rate-limit meters — one two-line meter per window: label, reset clock and
 * percentage on the first line, the bar on the second. Each bar carries its own
 * severity color, so a nearly-spent weekly quota reads red while the current
 * session is still green.
 */
export function LimitBars({ limits, language = "en" }: LimitBarsProps) {
  if (!limits || limits.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {limits.map((limit) => (
        <LimitRow key={limit.kind} limit={limit} language={language} />
      ))}
    </div>
  );
}

/** Subscription tier pill — "Pro" in the hover popup, "Pro Plan" in the flyout. */
export function PlanBadge({
  plan,
  language = "en",
  full = false,
}: {
  plan?: string;
  language?: Language;
  full?: boolean;
}) {
  const label = planLabel(plan);
  if (!label) return null;

  return (
    <span
      className="text-[0.6875rem] leading-none px-2 py-1 rounded-full font-medium shrink-0 whitespace-nowrap"
      style={{
        background: "var(--color-bg-elevated)",
        color: "var(--color-accent)",
      }}
    >
      {full ? t(language, "planBadge").replace("{plan}", label) : label}
    </span>
  );
}

function LimitRow({ limit, language }: { limit: UsageLimit; language: Language }) {
  const color = stateColor(deriveUsageState(limit.percent));
  const filled = Math.min(100, Math.max(0, limit.percent));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate" style={{ color: "var(--color-text-secondary)" }}>
          {t(language, LABEL_KEYS[limit.kind])}
        </span>
        <span className="flex items-baseline gap-2 shrink-0">
          {limit.resetAt && (
            <span style={{ color: "var(--color-text-muted)" }}>
              {t(language, "resetsIn")} {formatTimeUntil(limit.resetAt)}
            </span>
          )}
          <span className="font-semibold tabular-nums" style={{ color }}>
            {Math.round(limit.percent)}%
          </span>
        </span>
      </div>

      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--color-ring-track)" }}
        role="meter"
        aria-valuenow={Math.round(filled)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(language, LABEL_KEYS[limit.kind])}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${filled}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
