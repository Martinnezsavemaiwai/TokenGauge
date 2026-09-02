import { motion } from "framer-motion";
import type { ModelUsage } from "../types/provider";
import { formatCompact, formatNumber, modelLabel } from "../lib/format";
import { EmptyState, StackGlyph } from "./EmptyState";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";

interface ModelBreakdownProps {
  models: ModelUsage[];
  language?: Language;
}

/**
 * Tints for the share rail, biggest share first. One hue, stepped by tone —
 * the palette has exactly one accent, and a second hue here would read as a
 * status color the data does not have.
 */
const TINTS = [1, 0.7, 0.52, 0.4, 0.32];
const FAINTEST = 0.28;

/**
 * Which models spent the rolling 24 hours.
 *
 * Drawn as one rail split by model rather than a meter per model: a meter in
 * this system means "percent of a metered window", and these are shares of a
 * token count with no limit behind them. One rail cannot be misread as four
 * quotas, and the split is the fact the tab exists to show.
 */
export function ModelBreakdown({ models, language = "en" }: ModelBreakdownProps) {
  const total = models.reduce((sum, model) => sum + model.credits, 0);

  if (total <= 0) {
    return (
      <EmptyState
        icon={<StackGlyph />}
        title={t(language, "emptyModelsTitle")}
        note={t(language, "noUsageToday")}
      />
    );
  }

  const rows = models.map((model, index) => ({
    ...model,
    label: modelLabel(model.model),
    share: (model.credits / total) * 100,
    tint: TINTS[index] ?? FAINTEST,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {t(language, "modelsHeading")}
        </span>
        <span
          className="text-xs font-semibold tabular-nums shrink-0"
          style={{ color: "var(--color-text-primary)" }}
          title={formatNumber(total)}
        >
          {formatCompact(total)}
        </span>
      </div>

      <div
        className="flex gap-[2px] h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--color-ring-track)" }}
        role="img"
        aria-label={rows.map((row) => `${row.label} ${Math.round(row.share)}%`).join(", ")}
      >
        {rows.map((row) => (
          <motion.div
            key={row.model}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: "var(--color-accent)", opacity: row.tint, minWidth: 2 }}
            initial={{ width: 0 }}
            animate={{ width: `${row.share}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.model} className="flex items-center gap-2 text-xs" title={formatNumber(row.credits)}>
            <span
              className="w-2 h-2 rounded-[2px] shrink-0"
              style={{ background: "var(--color-accent)", opacity: row.tint }}
            />
            <span className="truncate" style={{ color: "var(--color-text-primary)" }}>
              {row.label}
            </span>
            <span className="flex-1" />
            <span className="tabular-nums shrink-0" style={{ color: "var(--color-text-muted)" }}>
              {formatCompact(row.credits)}
            </span>
            <span
              className="tabular-nums shrink-0 text-right"
              style={{ color: "var(--color-text-secondary)", width: "2.75rem" }}
            >
              {row.share.toFixed(row.share < 10 ? 1 : 0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
