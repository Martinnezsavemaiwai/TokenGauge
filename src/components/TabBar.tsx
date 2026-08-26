import type { Language } from "../hooks/useSettings";
import { t, type StringKey } from "../lib/i18n";

export type TabId = "overview" | "models" | "history" | "settings";

const TABS: { id: TabId; label: StringKey; icon: (props: { size: number }) => React.ReactElement }[] = [
  { id: "overview", label: "tabOverview", icon: OverviewIcon },
  { id: "models", label: "tabModels", icon: ModelsIcon },
  { id: "history", label: "tabHistory", icon: HistoryIcon },
  { id: "settings", label: "tabSettings", icon: SettingsIcon },
];

interface TabBarProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
  language?: Language;
}

/**
 * Bottom-pinned dashboard navigation. Captions stay visible — four unlabeled
 * glyphs is a quiz, not navigation.
 */
export function TabBar({ active, onSelect, language = "en" }: TabBarProps) {
  return (
    <nav
      className="flex shrink-0"
      style={{ borderTop: "1px solid var(--color-border-subtle)" }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className="flex-1 flex flex-col items-center gap-1 py-2 px-1 text-[0.6875rem] font-medium cursor-pointer transition-colors"
            style={{
              color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
              borderTop: `2px solid ${isActive ? "var(--color-accent)" : "transparent"}`,
              marginTop: "-1px",
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
            }}
          >
            <tab.icon size={16} />
            <span className="truncate max-w-full">{t(language, tab.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function OverviewIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l4-3" />
    </svg>
  );
}

function ModelsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <rect x="3" y="13" width="12" height="5" rx="1.5" />
    </svg>
  );
}

function HistoryIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 9a9 9 0 1 1 .5 5" />
      <polyline points="3 4 3 9 8 9" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  );
}

function SettingsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.33.4.6.73.74H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
