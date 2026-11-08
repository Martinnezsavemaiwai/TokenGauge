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
 * Opus keeps its character's colour. Other models take tones no character
 * wears, because these are shares of a total, not limits.
 */
const TONES = ["var(--butter)", "var(--sky)", "var(--cheek)", "var(--sleep)"];

function colorsFor(models: ModelUsage[]): string[] {
  let next = 0;
  return models.map((model) =>
    model.model.toLowerCase().includes("opus") ? "var(--opus)" : TONES[Math.min(next++, TONES.length - 1)],
  );
}

/** Which models spent the last 24 hours, biggest first, in tokens and share. */
export function ModelBreakdown({ models, language = "en" }: ModelBreakdownProps) {
  const total = models.reduce((sum, model) => sum + model.credits, 0);

  if (total <= 0) {
    return <EmptyState icon={<StackGlyph />} title={t(language, "emptyModelsTitle")} note={t(language, "noUsageToday")} />;
  }

  const colors = colorsFor(models);
  const rows = models.map((model, index) => ({
    ...model,
    label: modelLabel(model.model),
    share: (model.credits / total) * 100,
    color: colors[index],
  }));

  const [top, ...others] = rows;

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="meta">{t(language, "modelsHeading")}</span>
        <span className="num font-medium text-[0.8125rem] shrink-0" title={formatNumber(total)}>
          {formatCompact(total)}
        </span>
      </div>

      <div className="share" role="img" aria-label={rows.map((row) => `${row.label} ${Math.round(row.share)}%`).join(", ")}>
        {rows.map((row) => (
          <i key={row.model} style={{ width: `${row.share}%`, background: row.color }} />
        ))}
      </div>

      {/* The model that spent the most gets the cell a roster's first place gets. */}
      <div className="flex items-center gap-4 rounded-2xl px-5 py-5 flex-1" style={{ background: "var(--plate)" }} title={formatNumber(top.credits)}>
        <span
          className="num flex items-center justify-center rounded-full font-semibold shrink-0"
          style={{ width: "3.25rem", height: "3.25rem", fontSize: "1.5rem", background: top.color, color: "var(--on-ribbon)" }}
        >
          1
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="truncate-line font-medium" style={{ fontSize: "1.0625rem" }}>{top.label}</span>
          <span className="meta num">{formatCompact(top.credits)}</span>
        </div>
        <span className="pct shrink-0" style={{ fontSize: "2.5rem" }}>
          {top.share.toFixed(top.share < 10 ? 1 : 0)}
          <small>%</small>
        </span>
      </div>

      {others.length > 0 && (
        <ol className="flex flex-col gap-1.5" start={2}>
          {others.map((row, index) => (
            <li
              key={row.model}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[0.8125rem]"
              style={{ background: "var(--plate)" }}
              title={formatNumber(row.credits)}
            >
              <span
                className="num flex items-center justify-center rounded-full text-xs font-semibold shrink-0"
                style={{ width: "1.5rem", height: "1.5rem", background: row.color, color: "var(--on-ribbon)" }}
              >
                {index + 2}
              </span>
              <span className="truncate-line flex-1">{row.label}</span>
              <span className="num meta shrink-0">{formatCompact(row.credits)}</span>
              <span className="num font-medium shrink-0 text-right" style={{ width: "3rem" }}>
                {row.share.toFixed(row.share < 10 ? 1 : 0)}%
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
