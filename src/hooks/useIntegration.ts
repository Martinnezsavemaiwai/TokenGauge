import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { LimitKind, UsageSnapshot, UsageState } from "../types/provider";
import {
  crossedThreshold,
  deriveUsageState,
  displayPercent,
  markKey,
  peakPercent,
  quotaReturned,
  rankLimits,
  type ThresholdMark,
} from "../lib/usage-state";
import { formatTimeUntil } from "../lib/format";
import { useSettings } from "./useSettings";
import { t, type StringKey } from "../lib/i18n";
import { LIMIT_LABELS } from "../components/Roster";

const KINDS: LimitKind[] = ["session", "weekly", "weekly_opus"];

/**
 * Announced thresholds live in localStorage, not in a ref: a ref only remembers
 * for as long as this webview does, so every relaunch re-announced the window
 * the user was already sitting in. localStorage is also shared between the two
 * tray windows, which makes the single-notifier rule below belt *and* braces.
 */
const MARKS_KEY = "tokengauge-announced";

function readMarks(): Record<string, ThresholdMark> {
  try {
    const raw = localStorage.getItem(MARKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMarks(marks: Record<string, ThresholdMark>) {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify(marks));
  } catch {
    // Nothing to do — worst case a threshold is announced twice.
  }
}

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
    sendNotification({ title, body });
  }
}

export function useIntegration(
  snapshot: UsageSnapshot | null,
  state: UsageState,
  providerName: string,
) {
  const { language, notifications } = useSettings();

  // The tray icon reflects whichever limit bites first, not just the session.
  const live = state !== "no_access" && state !== "error" && state !== "loading";
  const trayState = live && snapshot
    ? deriveUsageState(peakPercent(snapshot.limits, snapshot.usedPercent))
    : state;

  // Sync Tray Icon
  useEffect(() => {
    if (!isNotifier()) return;
    invoke("set_tray_state", { state: trayState }).catch(console.error);
  }, [trayState]);

  // Tray tooltip: the number, for whoever rests the pointer on the icon.
  useEffect(() => {
    if (!isNotifier()) return;
    const lead = live ? rankLimits(snapshot?.limits)[0] : undefined;
    const text = lead
      ? [
          `${t(language, LIMIT_LABELS[lead.kind])} ${displayPercent(lead.percent)}%`,
          lead.resetAt ? `${t(language, "resetsIn")} ${formatTimeUntil(lead.resetAt, language)}` : null,
        ].filter(Boolean).join(" · ")
      : "TokenGauge";
    invoke("set_tray_tooltip", { text }).catch(console.error);
  }, [snapshot, live, language]);

  // Native Notifications
  useEffect(() => {
    if (!snapshot || !isNotifier()) return;

    // Titles name the provider, bodies never do — one notification engine,
    // whichever instrument is being read.
    const title = (key: StringKey) => t(language, key).replace("{provider}", providerName);
    const send = (heading: string, body: string) => {
      // Marks are still written while muted, so unmuting cannot replay a backlog.
      if (notifications.enabled) notify(heading, body).catch(console.error);
    };

    const percentOf = (kind: LimitKind) => snapshot.limits?.find((limit) => limit.kind === kind)?.percent;

    // Before the thresholds, which would overwrite the spent window's mark.
    for (const kind of KINDS) {
      const key = markKey(snapshot.account, kind);
      const marks = readMarks();
      const mark = marks[key];
      if (!quotaReturned(mark, percentOf(kind))) continue;
      writeMarks({ ...marks, [key]: { window: mark.window, mark: 0 } });
      if (notifications.quotaBack) {
        send(
          title("notifyBackTitle"),
          t(language, "notifyBackBody").replace("{limit}", t(language, LIMIT_LABELS[kind])),
        );
      }
    }

    const check = (kind: LimitKind, percent: number, resetAt: Date | undefined) => {
      const marks = readMarks();
      const window = resetAt?.toISOString() ?? "";
      const key = markKey(snapshot.account, kind);
      const crossed = crossedThreshold(percent, marks[key], window, notifications.thresholds);
      if (crossed === null) return;
      writeMarks({ ...marks, [key]: { window, mark: crossed } });

      // Each window gets its own wording. Sharing one "weekly limit" string
      // across `weekly` and `weekly_opus` made two different limits crossing at
      // once read as the same notification delivered twice.
      if (kind === "weekly" || kind === "weekly_opus") {
        const opus = kind === "weekly_opus";
        send(
          title(opus ? "notifyWeeklyOpusTitle" : "notifyWeeklyTitle"),
          t(language, opus ? "notifyWeeklyOpusBody" : "notifyWeeklyBody")
            .replace("{percent}", String(Math.floor(percent))),
        );
        return;
      }

      if (crossed === 100) {
        send(title("notifyLimitTitle"), t(language, "notifyLimitBody"));
        return;
      }

      const severityTitle =
        crossed === 90
          ? title("notifyCriticalTitle")
          : crossed === 80
            ? title("notifyWarningTitle")
            : title("notifyUpdateTitle");

      send(severityTitle, t(language, "notifyPercentBody").replace("{percent}", String(Math.floor(percent))));
    };

    check("session", snapshot.usedPercent, snapshot.resetAt);
    for (const limit of snapshot.limits ?? []) {
      if (limit.kind !== "session") check(limit.kind, limit.percent, limit.resetAt);
    }
  }, [snapshot, language, providerName, notifications]);
}
