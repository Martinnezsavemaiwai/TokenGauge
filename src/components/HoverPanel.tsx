import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type { UsageSnapshot, UsageState } from "../types/provider";
import { ProgressRing } from "./ProgressRing";
import { UsageStats } from "./UsageStats";
import { LimitBars, PlanBadge } from "./LimitBars";
import { Dot } from "./ProviderSelector";
import { useSettings } from "../hooks/useSettings";
import { providerEntry } from "../providers/registry";
import { isLive } from "../lib/usage-state";

interface HoverPanelProps {
  snapshot: UsageSnapshot;
  state: UsageState;
}

/**
 * Quick Glance — the second distance. Names the provider being measured, then
 * answers "how much is left" in one arc and one clock. Five facts, no more:
 * anything else belongs in the dashboard.
 */
export function HoverPanel({ snapshot, state }: HoverPanelProps) {
  const isHovering = useRef(false);
  const { language, providerId } = useSettings();
  const provider = providerEntry(providerId);
  const live = isLive(snapshot);
  // The ring already is the session window.
  const otherLimits = (snapshot.limits ?? []).filter((limit) => limit.kind !== "session");

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const unlistenEnter = listen("tray-enter", () => {
      clearTimeout(timeout);
    });

    const unlistenLeave = listen("tray-leave", () => {
      timeout = setTimeout(() => {
        if (!isHovering.current) {
          getCurrentWindow().hide().catch(console.error);
        }
      }, 200);
    });

    return () => {
      unlistenEnter.then((f) => f());
      unlistenLeave.then((f) => f());
    };
  }, []);

  return (
    <motion.div
      className="panel w-max flex flex-col"
      style={{ minWidth: "20rem", maxWidth: "26rem", transformOrigin: "bottom center" }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => (isHovering.current = true)}
      onMouseLeave={() => {
        isHovering.current = false;
        // Also close when mouse leaves the panel itself
        getCurrentWindow().hide().catch(console.error);
      }}
    >
      <div className="panel-scroll p-4 flex flex-col gap-4">
        {/* What is being measured */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Dot color={provider.dot} />
            <span
              className="text-xs font-semibold truncate"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {provider.name}
            </span>
          </div>
          <PlanBadge plan={snapshot.plan} language={language} />
        </div>

        <div className="flex items-center gap-4">
          <ProgressRing percent={live ? snapshot.usedPercent : null} state={state} size={88} strokeWidth={6} language={language} />
          <UsageStats snapshot={snapshot} language={language} />
        </div>

        <LimitBars limits={otherLimits} language={language} />
      </div>
    </motion.div>
  );
}
