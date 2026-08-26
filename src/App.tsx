import { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { MockProvider } from "./providers/mock";
import { providerEntry } from "./providers/registry";
import { useUsage } from "./hooks/useUsage";
import { useIntegration } from "./hooks/useIntegration";
import { useSettings } from "./hooks/useSettings";
import { useAutoResize } from "./hooks/useAutoResize";
import { HoverPanel } from "./components/HoverPanel";
import { ClickPanel } from "./components/ClickPanel";
import "./styles/index.css";

import { invoke } from "@tauri-apps/api/core";

/**
 * TokenGauge — Main application.
 *
 * In production, the Rust side controls which view is visible
 * by loading `/?view=hover` or `/?view=click`.
 *
 * For development, we render both panels with controls to switch
 * between them and test different usage states.
 */
function App() {
  const initialView = (new URLSearchParams(window.location.search).get("view") || "dev") as "hover" | "click" | "dev";
  const [view, setView] = useState<"hover" | "click" | "dev">(initialView);
  const [mockPercent, setMockPercent] = useState(80);
  const [showAbsolute, setShowAbsolute] = useState(false);

  const { providerId } = useSettings();
  const entry = providerEntry(providerId);

  const provider = useMemo(() => {
    if (view === "dev") {
      return new MockProvider(mockPercent, showAbsolute);
    }
    return entry.create!();
  }, [view, mockPercent, showAbsolute, entry]);

  if (provider instanceof MockProvider) {
    provider.setPercent(mockPercent);
  }

  // The API windows only move every few minutes and the local scan walks every
  // active session file — polling every 3s bought nothing but I/O.
  const { snapshot, state, lastRefresh, refresh } = useUsage(provider, 30_000);

  useIntegration(snapshot, state, view === "dev" ? "Mock" : entry.name);
  useAutoResize(view !== "dev");

  if (view === "hover") {
    const displaySnapshot = snapshot || { usedPercent: 0, remainingPercent: 100 };
    return state !== "loading" ? (
      <HoverPanel snapshot={displaySnapshot} state={state} lastRefresh={lastRefresh} onRefresh={refresh} />
    ) : null;
  }

  if (view === "click") {
    const displaySnapshot = snapshot || { usedPercent: 0, remainingPercent: 100 };
    return state !== "loading" ? (
      <ClickPanel
        snapshot={displaySnapshot}
        state={state}
        lastRefresh={lastRefresh}
        onRefresh={refresh}
        onClose={() => invoke("close_click_panel").catch(console.error)}
      />
    ) : null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "var(--color-bg-base)" }}
    >
      {/* Dev controls — hidden in production */}
      <div
        className="flex flex-col gap-4 p-6 rounded-2xl w-full max-w-[540px]"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: "var(--color-text-muted)" }}
          >
            Dev Controls
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded font-mono"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
            }}
          >
            {state}
          </span>
        </div>

        {/* Usage slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs w-20" style={{ color: "var(--color-text-secondary)" }}>
            Usage: {mockPercent}%
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={mockPercent}
            onChange={(e) => {
              setMockPercent(Number(e.target.value));
              refresh();
            }}
            className="flex-1 accent-[var(--color-accent)]"
          />
        </div>

        {/* Toggle absolute numbers */}
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
          <input
            type="checkbox"
            checked={showAbsolute}
            onChange={(e) => setShowAbsolute(e.target.checked)}
          />
          Show absolute numbers (used/limit)
        </label>

        {/* View switcher */}
        <div className="flex gap-2">
          {(["hover", "click", "dev"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex-1 text-xs py-1.5 rounded-lg transition-colors cursor-pointer capitalize"
              style={{
                background: view === v ? "var(--color-bg-elevated)" : "transparent",
                color: view === v ? "var(--color-text-primary)" : "var(--color-text-muted)",
                border: `1px solid ${view === v ? "var(--color-border)" : "transparent"}`,
              }}
            >
              {v === "dev" ? "Both" : v}
            </button>
          ))}
        </div>
      </div>

      {/* Dev Panels */}
      {state !== "loading" && (
        <AnimatePresence mode="wait">
          <HoverPanel
            key="hover"
            snapshot={snapshot || { usedPercent: 0, remainingPercent: 100 }}
            state={state}
            lastRefresh={lastRefresh}
            onRefresh={refresh}
          />
          <ClickPanel
            key="click"
            snapshot={snapshot || { usedPercent: 0, remainingPercent: 100 }}
            state={state}
            lastRefresh={lastRefresh}
            onRefresh={refresh}
            onClose={() => setView("hover")}
          />
        </AnimatePresence>
      )}

      {/* Loading state */}
      {!snapshot && state === "loading" && (
        <div
          className="panel p-8 flex items-center justify-center"
          style={{ color: "var(--color-text-muted)" }}
        >
          Loading usage data…
        </div>
      )}
    </div>
  );
}

export default App;
