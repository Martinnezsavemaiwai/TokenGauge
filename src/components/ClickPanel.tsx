import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UsageSnapshot, UsageState } from "../types/provider";
import { ProgressRing } from "./ProgressRing";
import { UsageStats } from "./UsageStats";
import { UsageChart } from "./UsageChart";
import { RefreshIndicator } from "./RefreshIndicator";
import { SettingsPanel } from "./SettingsPanel";
import { LimitBars, PlanBadge } from "./LimitBars";
import { BrandMark } from "./BrandMark";
import { ProviderSelector } from "./ProviderSelector";
import { TabBar, type TabId } from "./TabBar";
import { EmptyState, ChartGlyph, StackGlyph } from "./EmptyState";
import { checkForUpdate } from "../lib/updates";
import { useSettings } from "../hooks/useSettings";
import { providerEntry } from "../providers/registry";
import { isLive } from "../lib/usage-state";
import { t } from "../lib/i18n";

interface ClickPanelProps {
  snapshot: UsageSnapshot;
  state: UsageState;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onClose: () => void;
}

/**
 * The Dashboard — the third distance. TokenGauge owns the frame (mark,
 * wordmark, tabs); the provider selector names what the instrument is pointed
 * at, and every tab below shows that provider's readings.
 */
export function ClickPanel({
  snapshot,
  state,
  lastRefresh,
  onRefresh,
  onClose,
}: ClickPanelProps) {
  const { theme, language, providerId, setTheme, setLanguage, setProviderId } = useSettings();
  const [tab, setTab] = useState<TabId>("overview");
  const provider = providerEntry(providerId);
  const live = isLive(snapshot);
  // The ring is the session window; a "Session 5h" bar under it would just
  // print the same number a second time.
  const otherLimits = (snapshot.limits ?? []).filter((limit) => limit.kind !== "session");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (tab !== "overview") setTab("overview");
      else onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, tab]);

  const notifyUpdateResult = async () => {
    const result = await checkForUpdate();
    const body =
      result.status === "available"
        ? t(language, "updateAvailableBody").replace("{version}", result.latestVersion)
        : result.status === "error"
          ? t(language, "updateCheckErrorBody")
          : t(language, "upToDateBody");

    if (result.status === "available") {
      openUrl("https://github.com/Martinnezsavemaiwai/TokenGauge/releases/latest");
    }

    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      permissionGranted = (await requestPermission()) === "granted";
    }
    if (permissionGranted) sendNotification({ title: "TokenGauge", body });
  };

  return (
    <motion.div
      className="panel w-max flex flex-col"
      // The floor lives on the panel, not the scroll area, so `max-height` can win
      // on a short screen instead of the tab bar being pushed out of the window.
      style={{ minWidth: "28rem", maxWidth: "34rem", minHeight: "min(17rem, var(--panel-max-h, 17rem))", transformOrigin: "bottom center" }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header — TokenGauge's own identity, then what it is pointed at */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-move shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          getCurrentWindow().startDragging();
        }}
      >
        <div className="flex items-center gap-2 pointer-events-none min-w-0">
          <BrandMark size={20} />
          <span
            className="font-display text-base font-bold tracking-tight truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            Token<span style={{ color: "var(--color-accent)" }}>Gauge</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ProviderSelector
            providerId={providerId}
            onSelect={setProviderId}
            percent={live ? snapshot.usedPercent : undefined}
            language={language}
          />
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded-md transition-colors cursor-pointer"
            style={{ color: "var(--color-text-muted)" }}
            aria-label={t(language, "close")}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="panel-scroll flex-1 min-h-0 px-5 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="flex flex-col gap-4 min-h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "overview" && (
              <>
                <div className="flex items-center gap-4">
                  <ProgressRing
                    percent={live ? snapshot.usedPercent : null}
                    state={state}
                    size={92}
                    strokeWidth={7}
                    language={language}
                  />
                  <UsageStats snapshot={snapshot} language={language} />
                  <span className="self-start"><PlanBadge plan={snapshot.plan} language={language} full /></span>
                </div>

                <LimitBars limits={otherLimits} language={language} />

                <div style={{ borderTop: "1px solid var(--color-border-subtle)" }} />

                <UsageChart
                  state={state}
                  history={snapshot.history}
                  endHour={snapshot.updatedAt?.getHours()}
                  language={language}
                />

                <div className="flex items-center justify-between gap-3 mt-auto">
                  <RefreshIndicator lastRefresh={lastRefresh} onRefresh={onRefresh} language={language} />
                  <button
                    onClick={() => openUrl("https://console.anthropic.com/settings/limits")}
                    className="shrink-0 text-xs font-semibold px-4 py-2 rounded-md cursor-pointer transition-colors"
                    style={{ background: "var(--color-accent)", color: "var(--color-bg-base)" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-accent-hover)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-accent)")}
                  >
                    {t(language, "openProvider").replace("{provider}", provider.name)}
                  </button>
                </div>
              </>
            )}

            {tab === "models" && (
              <EmptyState
                icon={<StackGlyph />}
                title={t(language, "emptyModelsTitle")}
                note={t(language, "emptyModelsNote")}
              />
            )}

            {tab === "history" && (
              <EmptyState
                icon={<ChartGlyph />}
                title={t(language, "emptyHistoryTitle")}
                note={t(language, "emptyHistoryNote")}
              />
            )}

            {tab === "settings" && (
              <SettingsPanel
                theme={theme}
                language={language}
                onThemeChange={setTheme}
                onLanguageChange={setLanguage}
                onCheckUpdates={() => notifyUpdateResult().catch(console.error)}
                onExit={() => invoke("exit_app")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <TabBar active={tab} onSelect={setTab} language={language} />
    </motion.div>
  );
}
