import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Provider, UsageSnapshot, UsageState } from "../types/provider";
import { deriveUsageState } from "../lib/usage-state";

interface UseUsageResult {
  snapshot: UsageSnapshot | null;
  state: UsageState;
  error: string | null;
  refresh: () => void;
}

/**
 * Poll a Provider for usage data. Auto-refreshes on an interval.
 * Returns the current snapshot, derived state, and a manual refresh function.
 *
 * `pauseWhenHidden` is for the windows that are not the tray notifier: the app
 * runs this hook once per webview, and a hidden flyout re-walking every session
 * file every interval buys nothing. It catches up on focus instead.
 */
export function useUsage(
  provider: Provider,
  intervalMs = 60_000,
  pauseWhenHidden = false,
): UseUsageResult {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null);
  const [state, setState] = useState<UsageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A slower answer from an earlier provider must not overwrite a newer one.
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const usage = await provider.getUsage();
      if (request !== latest.current) return;
      setSnapshot(usage);
      setState(deriveUsageState(usage.usedPercent));
      setError(null);
    } catch (err) {
      if (request !== latest.current) return;
      if (err instanceof Error && err.name === "FileNotFoundError") {
        setState("no_access");
        setError("Provider not logged in or no usage data found");
      } else {
        setState("error");
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }, [provider]);

  // Initial fetch + interval
  useEffect(() => {
    refresh();
    timerRef.current = setInterval(async () => {
      if (pauseWhenHidden && !(await getCurrentWindow().isVisible().catch(() => true))) return;
      refresh();
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh, intervalMs, pauseWhenHidden]);

  // A paused window is shown focused, so this is its "you are visible again" edge.
  useEffect(() => {
    if (!pauseWhenHidden) return;
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) refresh();
    });
    return () => {
      unlisten.then((off) => off()).catch(() => {});
    };
  }, [refresh, pauseWhenHidden]);

  return { snapshot, state, error, refresh };
}
