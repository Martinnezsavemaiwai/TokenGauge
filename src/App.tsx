import { lazy, Suspense, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { providerEntry } from "./providers/registry";
import { useUsage } from "./hooks/useUsage";
import { useIntegration } from "./hooks/useIntegration";
import { useSettings } from "./hooks/useSettings";
import { useAutoResize } from "./hooks/useAutoResize";
import { HoverPanel } from "./components/HoverPanel";
import { ClickPanel } from "./components/ClickPanel";
import { Mascot } from "./components/Mascot";
import { t } from "./lib/i18n";
import "./styles/index.css";

const DevHarness = import.meta.env.DEV ? lazy(() => import("./dev/DevHarness")) : null;
const EMPTY = { usedPercent: 0, remainingPercent: 100 };

function TrayView({ view }: { view: "hover" | "click" }) {
  const { providerId, language } = useSettings();
  const entry = providerEntry(providerId);
  const provider = useMemo(() => entry.create!(), [entry]);

  // The API windows only move every few minutes and the local scan walks every
  // active session file — polling every 3s bought nothing but I/O.
  const { snapshot, state } = useUsage(provider, 30_000, view === "click");

  useIntegration(snapshot, state, entry.name);
  useAutoResize(true);

  if (state === "loading") {
    return (
      <div className={`panel ${view === "hover" ? "panel-hover" : "panel-dash"} flex-row! items-center gap-3 p-4`} data-kind="session" role="status">
        <Mascot kind="session" mood="asleep" size={2.5} />
        <span className="meta">{t(language, "loadingUsageData")}</span>
      </div>
    );
  }

  return view === "hover" ? (
    <HoverPanel snapshot={snapshot ?? EMPTY} state={state} />
  ) : (
    <ClickPanel
      provider={provider}
      snapshot={snapshot ?? EMPTY}
      state={state}
      onClose={() => invoke("close_click_panel").catch(console.error)}
    />
  );
}

/** The Rust side loads each tray window with `?view=hover` or `?view=click`. */
export default function App() {
  const view = new URLSearchParams(window.location.search).get("view");

  if (!view && DevHarness) {
    return (
      <Suspense fallback={null}>
        <DevHarness />
      </Suspense>
    );
  }

  return <TrayView view={view === "click" ? "click" : "hover"} />;
}
