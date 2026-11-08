import type { KeyboardEvent } from "react";
import type { Language } from "../hooks/useSettings";
import { t, type StringKey } from "../lib/i18n";

export type TabId = "overview" | "models" | "history" | "settings";

const TABS: { id: TabId; label: StringKey; icon: (props: { size: string }) => React.ReactElement }[] = [
  { id: "overview", label: "tabOverview", icon: OverviewIcon },
  { id: "models", label: "tabModels", icon: ModelsIcon },
  { id: "history", label: "tabHistory", icon: HistoryIcon },
  { id: "settings", label: "tabSettings", icon: SettingsIcon },
];

export const TAB_IDS: TabId[] = TABS.map((tab) => tab.id);

interface TabBarProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
  language?: Language;
}

/** Bottom-pinned navigation. Captions stay visible; arrows move between tabs. */
export function TabBar({ active, onSelect, language = "en" }: TabBarProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TAB_IDS[(TAB_IDS.indexOf(active) + step + TAB_IDS.length) % TAB_IDS.length];
    onSelect(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <div className="tabbar" role="tablist" aria-label={t(language, "tabsLabel")} onKeyDown={onKeyDown}>
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className="tab"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
          >
            <tab.icon size="1rem" />
            <span className="truncate-line max-w-full">{t(language, tab.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

function OverviewIcon({ size }: { size: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l4-3" />
    </svg>
  );
}

function ModelsIcon({ size }: { size: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="5" rx="2" />
      <rect x="3" y="13" width="12" height="5" rx="2" />
    </svg>
  );
}

function HistoryIcon({ size }: { size: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 9a9 9 0 1 1 .5 5" />
      <polyline points="3 4 3 9 8 9" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  );
}

function SettingsIcon({ size }: { size: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </svg>
  );
}
