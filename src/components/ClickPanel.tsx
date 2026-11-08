import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Provider, UsageSnapshot, UsageState } from "../types/provider";
import { LimitCard, LiveSummary, NoReading, staleLine } from "./Roster";
import { UsageChart } from "./UsageChart";
import { SettingsPanel } from "./SettingsPanel";
import { Mascot } from "./Mascot";
import { ProviderSelector } from "./ProviderSelector";
import { TAB_IDS, TabBar, type TabId } from "./TabBar";
import { ModelBreakdown } from "./ModelBreakdown";
import { HistoryPanel } from "./HistoryPanel";
import { useSettings } from "../hooks/useSettings";
import { isLive, planLabel, rankLimits } from "../lib/usage-state";
import { t } from "../lib/i18n";

interface ClickPanelProps {
  provider: Provider;
  snapshot: UsageSnapshot;
  state: UsageState;
  onClose: () => void;
}

/** The dashboard: who is signed in, the ranked roster, and the drill-downs. */
export function ClickPanel({ provider: dataProvider, snapshot, state, onClose }: ClickPanelProps) {
  const { language, providerId, setProviderId } = useSettings();
  const [tab, setTab] = useState<TabId>("overview");
  const roster = isLive(snapshot) ? rankLimits(snapshot.limits) : [];
  const plan = planLabel(snapshot.plan);
  const stale = staleLine(snapshot, language);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const index = e.ctrlKey ? Number(e.key) - 1 : -1;
      if (TAB_IDS[index]) {
        e.preventDefault();
        setTab(TAB_IDS[index]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="panel panel-dash">
      <LiveSummary limit={roster[0]} language={language} />

      <div
        className="header"
        onPointerDown={(e) => {
          if (e.button === 0) getCurrentWindow().startDragging();
        }}
      >
        <div className="flex items-center gap-2 min-w-0 pointer-events-none">
          <span data-kind="session">
            <Mascot kind="session" mood="happy" size={1.625} />
          </span>
          <span className="wordmark">
            Token<span style={{ color: "var(--session-text)" }}>Gauge</span>
          </span>
          {snapshot.accountLabel && (
            <span className="meta truncate-line" title={snapshot.accountLabel}>
              {snapshot.accountLabel}
            </span>
          )}
          {plan && <span className="pill">{plan}</span>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ProviderSelector providerId={providerId} onSelect={setProviderId} language={language} />
          <button
            className="btn btn-icon"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t(language, "close")}
            title={t(language, "close")}
          >
            <svg width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="panel-scroll flex-1 min-h-0 px-4 pb-2 pt-1 flex flex-col gap-3"
        // Every tab holds the Overview's height, so switching does not resize the window.
        style={{ minHeight: "min(24.5rem, calc(var(--panel-max-h, 32.5rem) - 8rem))" }}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "overview" && (
          <>
            {state === "no_access" ? (
              <NoReading large title={t(language, "errorNoAccessTitle")} note={t(language, "errorNoAccessHint")} language={language} />
            ) : state === "error" ? (
              <NoReading large title={t(language, "errorTitle")} note={t(language, "errorHint")} language={language} />
            ) : roster.length > 0 ? (
              <>
                <p className="meta">{t(language, "rosterHeading")}</p>
                <ol className="roster" data-count={roster.length}>
                  {roster.map((limit, index) => (
                    <LimitCard key={limit.kind} limit={limit} rank={index + 1} snapshot={snapshot} language={language} />
                  ))}
                </ol>
                {stale && (
                  <p className="meta" style={{ color: "var(--danger)" }}>
                    {stale}. {t(language, "syncHint")}
                  </p>
                )}
              </>
            ) : (
              <NoReading large title={t(language, "moodAsleep")} tokens={snapshot.used} language={language} />
            )}

            {state !== "no_access" && state !== "error" && (
              <UsageChart history={snapshot.history} endHour={snapshot.updatedAt?.getHours()} language={language} />
            )}
          </>
        )}

        {tab === "models" && <ModelBreakdown models={snapshot.models ?? []} language={language} />}
        {tab === "history" && <HistoryPanel provider={dataProvider} language={language} />}
        {tab === "settings" && <SettingsPanel onExit={() => invoke("exit_app")} />}
      </div>

      <TabBar active={tab} onSelect={setTab} language={language} />
    </div>
  );
}
