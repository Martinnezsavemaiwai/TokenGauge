import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";
import { bucketHour, formatCompact } from "../lib/format";

interface UsageChartProps {
  /** 24 hourly buckets, oldest first — index 23 is the hour `endHour` names. */
  history?: number[];
  /** Clock hour the newest bucket belongs to. Defaults to now. */
  endHour?: number;
  language?: Language;
}

/** The clock the reader actually uses: 12-hour with AM/PM in English, 24-hour in Thai. */
function formatHour(hour: number, language: Language): string {
  const at = new Date();
  at.setHours(hour, 0, 0, 0);
  return at.toLocaleTimeString(language === "th" ? "th-TH" : "en-US", { hour: "numeric" });
}

/**
 * Hourly columns over the last 24 hours, cropped to the active stretch so a
 * sparse day does not render as mostly dead air. Bucket 23 is the clock hour in
 * progress and is drawn in the selection colour.
 */
export function UsageChart({ history, endHour, language = "en" }: UsageChartProps) {
  const data: number[] = history && history.length === 24 ? history : Array(24).fill(0);
  const newestHour = endHour ?? new Date().getHours();
  const hourAt = (index: number) => bucketHour(index, newestHour);

  const firstActive = data.findIndex((v) => v > 0);
  const hasActivity = firstActive !== -1;
  const startIndex = hasActivity ? Math.max(0, firstActive - 1) : 0;
  const shown = data.slice(startIndex);
  const peak = Math.max(...shown, 1);
  const range = hasActivity ? `${formatHour(hourAt(startIndex), language)} – ${formatHour(hourAt(23), language)}` : "";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="meta">{t(language, "todaysUsage")}</span>

      {hasActivity ? (
        <>
          <div className="bars" role="img" aria-label={`${t(language, "todaysUsage")} · ${range}`}>
            {shown.map((value, offset) => {
              const index = startIndex + offset;
              return (
                <i
                  key={index}
                  data-now={index === 23}
                  data-empty={value <= 0}
                  style={{ height: `${Math.max((value / peak) * 100, 6)}%` }}
                  title={`${formatHour(hourAt(index), language)} · ${formatCompact(value)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between meta">
            <span>{formatHour(hourAt(startIndex), language)}</span>
            <span>{formatHour(hourAt(23), language)}</span>
          </div>
        </>
      ) : (
        <div className="well meta">{t(language, "noUsageToday")}</div>
      )}
    </div>
  );
}
