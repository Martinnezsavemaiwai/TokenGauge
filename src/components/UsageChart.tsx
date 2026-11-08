import type { UsageState } from "../types/provider";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";
import { bucketHour } from "../lib/format";

interface UsageChartProps {
  state?: UsageState;
  /** 24 rolling hourly buckets, oldest first — index 23 is the hour `endHour` names. */
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

function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

/**
 * UsageChart — smoothed sparkline over the rolling 24 hours, cropped to the
 * active stretch so a sparse day doesn't render as mostly dead air.
 *
 * The window rolls: bucket 23 is the clock hour in progress. Printing the index
 * as an hour is what used to pin the right edge of the axis to "11 PM" around
 * the clock.
 */
export function UsageChart({ state, history, endHour, language = "en" }: UsageChartProps) {
  const isNoAccess = state === "no_access" || state === "error";
  const rawData = history && history.length === 24 ? history : Array(24).fill(0);
  const newestHour = endHour ?? new Date().getHours();
  const hourAt = (index: number) => bucketHour(index, newestHour);

  const firstActive = rawData.findIndex((v) => v > 0);
  const lastActive = rawData.length - 1 - [...rawData].reverse().findIndex((v) => v > 0);
  const hasActivity = !isNoAccess && firstActive !== -1;

  const startIndex = hasActivity ? Math.max(0, firstActive - 1) : 0;
  const endIndex = hasActivity ? Math.min(23, lastActive + 1) : 23;
  const cropped = rawData.slice(startIndex, endIndex + 1);
  const maxVal = Math.max(...cropped, 1);

  const w = 300;
  const h = 64;
  const padX = 6;
  const padTop = 8;
  const padBottom = 4;
  const points: [number, number][] = cropped.map((v, i) => {
    const x = cropped.length > 1 ? padX + (i / (cropped.length - 1)) * (w - padX * 2) : w / 2;
    const y = h - padBottom - (v / maxVal) * (h - padTop - padBottom);
    return [x, y];
  });
  const linePath = smoothPath(points);
  const baseline = h - padBottom;
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1][0]},${baseline} L ${points[0][0]},${baseline} Z`
    : "";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {t(language, "todaysUsage")}
      </span>

      <div
        className="h-16"
        role="img"
        aria-label={
          hasActivity
            ? `${t(language, "todaysUsage")} · ${formatHour(hourAt(startIndex), language)} – ${formatHour(hourAt(endIndex), language)}`
            : t(language, "noUsageToday")
        }
      >
        {isNoAccess || !hasActivity ? (
          <div
            className="w-full h-full rounded-lg flex items-center justify-center text-xs"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
          >
            {isNoAccess ? t(language, "noData") : t(language, "noUsageToday")}
          </div>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="usage-chart-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#usage-chart-fade)" />
            <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {hasActivity && (
        <div className="flex justify-between text-[0.6875rem]" style={{ color: "var(--color-text-muted)" }}>
          <span>{formatHour(hourAt(startIndex), language)}</span>
          <span>{formatHour(hourAt(endIndex), language)}</span>
        </div>
      )}
    </div>
  );
}
