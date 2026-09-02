import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { DayUsage, Provider } from "../types/provider";
import { formatCompact, formatNumber } from "../lib/format";
import { EmptyState, ChartGlyph } from "./EmptyState";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";

interface HistoryPanelProps {
  provider: Provider;
  language?: Language;
}

type Load = { kind: "loading" } | { kind: "ready"; days: DayUsage[] } | { kind: "failed" };

/**
 * Tokens per day for the last week, read from the local session files when the
 * tab is opened.
 *
 * Columns, not the meters this tab used to borrow: these are counted tokens
 * against no limit, and a day of silence has to draw as the zero it was rather
 * than as a line sloping through it.
 */
export function HistoryPanel({ provider, language = "en" }: HistoryPanelProps) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    if (!provider.getHistory) {
      setLoad({ kind: "ready", days: [] });
      return;
    }
    setLoad({ kind: "loading" });
    provider
      .getHistory()
      .then((days) => alive && setLoad({ kind: "ready", days }))
      .catch(() => alive && setLoad({ kind: "failed" }));
    return () => {
      alive = false;
    };
  }, [provider]);

  // Walking the session archives takes long enough to see, and a blank tab in
  // the meantime reads as "nothing here" — the one thing it must not say.
  if (load.kind === "loading") {
    return (
      <div
        className="flex items-center justify-center rounded-lg px-4 py-8 h-full text-xs"
        style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
        role="status"
      >
        {t(language, "historyLoading")}
      </div>
    );
  }

  // A failed read is not an empty week. Saying "no usage" here would be the
  // invented number this product refuses to print.
  if (load.kind === "failed") {
    return (
      <EmptyState
        icon={<ChartGlyph />}
        title={t(language, "emptyHistoryTitle")}
        note={t(language, "historyError")}
      />
    );
  }

  const { days } = load;
  const peak = Math.max(0, ...days.map((day) => day.credits));
  const total = days.reduce((sum, day) => sum + day.credits, 0);

  if (peak <= 0) {
    return (
      <EmptyState
        icon={<ChartGlyph />}
        title={t(language, "emptyHistoryTitle")}
        note={t(language, "noUsageWeek")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {t(language, "historyHeading")}
        </span>
        <span
          className="text-xs font-semibold tabular-nums shrink-0"
          style={{ color: "var(--color-text-primary)" }}
          title={formatNumber(total)}
        >
          {formatCompact(total)}
        </span>
      </div>

      {/* Columns and axis share one block with no gap: the hairline under the
          columns is the baseline they stand on, not a divider below a chart. */}
      <div>
        <div
          className="flex items-end gap-2 h-24"
          role="img"
          aria-label={days
            .map((day) => `${dayLabel(day.date, language, "long")} ${formatNumber(day.credits)}`)
            .join(", ")}
        >
          {days.map((day) => (
            <div
              key={day.date}
              className="flex-1 flex flex-col justify-end items-center gap-1 min-w-0 h-full"
              title={`${dayLabel(day.date, language, "long")} · ${formatNumber(day.credits)}`}
            >
              {/* The value rides on top of its own column — a label parked at a
                  fixed height reads as a second row, not as this day's number. */}
              <span
                className="text-[0.6875rem] tabular-nums truncate w-full text-center"
                style={{ color: "var(--color-text-muted)" }}
              >
                {day.credits > 0 ? formatCompact(day.credits) : "–"}
              </span>

              <motion.div
                className="w-full rounded-t-[2px] shrink-0"
                style={{
                  background: "var(--color-accent)",
                  // A quiet day keeps a visible stub: zero is a reading, not a gap.
                  opacity: day.credits > 0 ? 1 : 0.25,
                }}
                initial={{ height: 0 }}
                animate={{ height: Math.max((day.credits / peak) * 76, 2) }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          ))}
        </div>

        <div
          className="flex gap-2 text-[0.6875rem] pt-1.5"
          style={{ color: "var(--color-text-muted)", borderTop: "1px solid var(--color-border-subtle)" }}
        >
          {days.map((day, index) => (
            <span key={day.date} className="flex-1 text-center truncate min-w-0">
              {index === days.length - 1 ? t(language, "today") : dayLabel(day.date, language, "short")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "2026-09-02" to "Wed" under the column, "Wed, Sep 2" in its tooltip. */
function dayLabel(date: string, language: Language, form: "short" | "long"): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const locale = language === "th" ? "th-TH" : "en-US";
  return form === "short"
    ? parsed.toLocaleDateString(locale, { weekday: "short" })
    : parsed.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}
