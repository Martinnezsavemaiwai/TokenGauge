import { useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type { UsageSnapshot, UsageState } from "../types/provider";
import { LeadLimit, LimitChip, NoReading, staleLine } from "./Roster";
import { useSettings } from "../hooks/useSettings";
import { isLive, rankLimits } from "../lib/usage-state";
import { t } from "../lib/i18n";

interface HoverPanelProps {
  snapshot: UsageSnapshot;
  state: UsageState;
}

/**
 * Quick Glance. The limit that bites first gets the character, the number and
 * the clock; the others are a chip each. Everything else lives in the dashboard.
 */
export function HoverPanel({ snapshot, state }: HoverPanelProps) {
  const isHovering = useRef(false);
  const { language } = useSettings();
  const [lead, ...rest] = isLive(snapshot) ? rankLimits(snapshot.limits) : [];
  const stale = staleLine(snapshot, language);

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
    <div
      className="panel panel-hover"
      onMouseEnter={() => (isHovering.current = true)}
      onMouseLeave={() => {
        isHovering.current = false;
        getCurrentWindow().hide().catch(console.error);
      }}
    >
      <div className="panel-scroll p-3 flex flex-col gap-2">
        {state === "no_access" ? (
          <NoReading title={t(language, "errorNoAccessTitle")} note={t(language, "errorNoAccessHint")} language={language} />
        ) : state === "error" ? (
          <NoReading title={t(language, "errorTitle")} note={t(language, "errorHint")} language={language} />
        ) : lead ? (
          <LeadLimit limit={lead} language={language} />
        ) : (
          <NoReading title={t(language, "moodAsleep")} tokens={snapshot.used} language={language} />
        )}

        {rest.length > 0 && (
          <div className="chips">
            {rest.map((limit) => (
              <LimitChip key={limit.kind} limit={limit} language={language} />
            ))}
          </div>
        )}

        {lead && stale && (
          <p className="meta px-1" style={{ color: "var(--danger)" }}>
            {stale}. {t(language, "syncHint")}
          </p>
        )}
      </div>
    </div>
  );
}
