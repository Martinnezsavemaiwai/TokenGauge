import { motion } from "framer-motion";
import type { UsageState } from "../types/provider";
import { stateColor } from "../lib/usage-state";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";

interface ProgressRingProps {
  percent: number;
  state: UsageState;
  /** Diameter in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  language?: Language;
}

/**
 * SVG circular progress ring.
 * Fills clockwise from the top as usage increases.
 */
export function ProgressRing({
  percent,
  state,
  size = 120,
  strokeWidth = 8,
  language = "en",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(100, Math.max(0, percent));
  const offset = circumference - (filled / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
        role="img"
        aria-label={`Usage progress: ${Math.round(filled)}%`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ring-track)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stateColor(state)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display text-2xl font-bold leading-none tabular-nums"
          style={{ color: stateColor(state) }}
        >
          {state === "no_access" || state === "error" ? "—" : `${Math.round(filled)}%`}
        </span>
        <span className="text-[0.6875rem] mt-1" style={{ color: "var(--color-text-muted)" }}>
          {state === "no_access" ? t(language, "noData") : state === "error" ? t(language, "error") : t(language, "used")}
        </span>
      </div>
    </div>
  );
}
