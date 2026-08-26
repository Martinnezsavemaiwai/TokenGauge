import { useState } from "react";
import { timeAgo } from "../lib/format";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";

interface RefreshIndicatorProps {
  lastRefresh: Date | null;
  onRefresh: () => void;
  language?: Language;
}

function formatTimeAgo(date: Date, language: Language): string {
  const ago = timeAgo(date);
  if (ago.kind === "now") return t(language, "justNow");
  const unitKey = ago.kind === "seconds" ? "secAgo" : ago.kind === "minutes" ? "minAgo" : "hrAgo";
  return `${ago.value} ${t(language, unitKey)}`;
}

/**
 * Shows "Updated X sec ago" with a manual refresh button.
 */
export function RefreshIndicator({ lastRefresh, onRefresh, language = "en" }: RefreshIndicatorProps) {
  const [spinning, setSpinning] = useState(false);

  return (
    <div
      className="flex items-center gap-2 text-xs min-w-0"
      style={{ color: "var(--color-text-muted)" }}
    >
      <span className="truncate">
        {lastRefresh ? `${t(language, "updated")} ${formatTimeAgo(lastRefresh, language)}` : t(language, "notYetUpdated")}
      </span>
      <button
        onClick={() => {
          onRefresh();
          setSpinning(true);
          setTimeout(() => setSpinning(false), 500);
        }}
        className="p-1.5 -m-0.5 rounded-md transition-colors cursor-pointer flex items-center justify-center"
        style={{
          color: "var(--color-text-secondary)",
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-subtle)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-subtle)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
        }}
        title={t(language, "refreshNow")}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: "transform 0.5s ease",
            transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
          }}
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </button>
    </div>
  );
}
