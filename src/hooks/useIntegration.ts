import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { UsageSnapshot, UsageState } from "../types/provider";
import { deriveUsageState, peakPercent } from "../lib/usage-state";
import { useSettings } from "./useSettings";
import { t, type StringKey } from "../lib/i18n";

const THRESHOLDS = [100, 90, 80, 60] as const;

/**
 * TokenGauge runs this same app in two windows (hover + click), so anything with
 * a side effect outside the webview has to be owned by exactly one of them —
 * otherwise every threshold notification fires twice.
 */
function isNotifier(): boolean {
  return new URLSearchParams(window.location.search).get("view") !== "click";
}

async function notify(title: string, body: string) {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    permissionGranted = (await requestPermission()) === "granted";
  }
  if (permissionGranted) {
    sendNotification({ title, body, icon: "icon.ico" });
  }
}

export function useIntegration(
  snapshot: UsageSnapshot | null,
  state: UsageState,
  providerName: string,
) {
  const previousState = useRef<UsageState | null>(null);
  /** Highest threshold already announced, per limit window. */
  const announced = useRef<Record<string, number>>({});
  const { language } = useSettings();

  // The tray icon reflects whichever limit bites first, not just the session.
  const live = state !== "no_access" && state !== "error" && state !== "loading";
  const trayState = live && snapshot
    ? deriveUsageState(peakPercent(snapshot.limits, snapshot.usedPercent))
    : state;

  // Sync Tray Icon
  useEffect(() => {
    if (!isNotifier()) return;
    if (previousState.current !== trayState) {
      invoke("set_tray_state", { state: trayState }).catch(console.error);
      previousState.current = trayState;
    }
  }, [trayState]);

  // Native Notifications
  useEffect(() => {
    if (!snapshot || !isNotifier()) return;

    // Titles name the provider, bodies never do — one notification engine,
    // whichever instrument is being read.
    const title = (key: StringKey) => t(language, key).replace("{provider}", providerName);

    const check = (key: string, percent: number, weekly: boolean) => {
      const mark = announced.current[key] ?? 0;
      // Window rolled over (or usage was recomputed downwards) — re-arm.
      if (percent < mark - 5) announced.current[key] = 0;

      const crossed = THRESHOLDS.find((threshold) => percent >= threshold) ?? 0;
      if (crossed === 0 || crossed <= (announced.current[key] ?? 0)) return;
      announced.current[key] = crossed;

      if (weekly) {
        notify(
          title("notifyWeeklyTitle"),
          t(language, "notifyWeeklyBody").replace("{percent}", String(Math.floor(percent))),
        ).catch(console.error);
        return;
      }

      if (crossed === 100) {
        notify(title("notifyLimitTitle"), t(language, "notifyLimitBody")).catch(console.error);
        return;
      }

      const severityTitle =
        crossed === 90
          ? title("notifyCriticalTitle")
          : crossed === 80
            ? title("notifyWarningTitle")
            : title("notifyUpdateTitle");

      notify(
        severityTitle,
        t(language, "notifyPercentBody").replace("{percent}", String(Math.floor(percent))),
      ).catch(console.error);
    };

    check("session", snapshot.usedPercent, false);
    for (const limit of snapshot.limits ?? []) {
      if (limit.kind !== "session") check(limit.kind, limit.percent, true);
    }
  }, [snapshot, language, providerName]);
}
