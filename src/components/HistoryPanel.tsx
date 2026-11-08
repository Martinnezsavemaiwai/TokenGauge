import { useEffect, useState } from "react";
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
 * tab is opened. A day of silence draws as the zero it was.
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
      <div className="well meta" role="status">
        {t(language, "historyLoading")}
      </div>
    );
  }

  // A failed read is not an empty week.
  if (load.kind === "failed") {
    return <EmptyState icon={<ChartGlyph />} title={t(language, "emptyHistoryTitle")} note={t(language, "historyError")} />;
  }

  const { days } = load;
  const peak = Math.max(0, ...days.map((day) => day.credits));
  const total = days.reduce((sum, day) => sum + day.credits, 0);

  if (peak <= 0) {
    return <EmptyState icon={<ChartGlyph />} title={t(language, "emptyHistoryTitle")} note={t(language, "noUsageWeek")} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="meta">{t(language, "historyHeading")}</span>
        <span className="num font-medium text-[0.8125rem] shrink-0" title={formatNumber(total)}>
          {formatCompact(total)}
        </span>
      </div>

      <div
        className="flex items-stretch gap-2"
        style={{ height: "18rem" }}
        role="img"
        aria-label={days.map((day) => `${dayLabel(day.date, language, "long")} ${formatNumber(day.credits)}`).join(", ")}
      >
        {days.map((day, index) => {
          const isToday = index === days.length - 1;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col justify-end items-center gap-1 min-w-0"
              title={`${dayLabel(day.date, language, "long")} · ${formatNumber(day.credits)}`}
            >
              <span className="meta num truncate-line w-full text-center">
                {day.credits > 0 ? formatCompact(day.credits) : "–"}
              </span>
              <div
                className="w-full"
                style={{
                  height: `${Math.max((day.credits / peak) * 72, 4)}%`,
                  borderRadius: "0.5rem 0.5rem 0.1875rem 0.1875rem",
                  background: day.credits <= 0 ? "var(--plate-strong)" : isToday ? "var(--select)" : "var(--bar)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 meta">
        {days.map((day, index) => (
          <span key={day.date} className="flex-1 text-center truncate-line">
            {index === days.length - 1 ? t(language, "today") : dayLabel(day.date, language, "short")}
          </span>
        ))}
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
