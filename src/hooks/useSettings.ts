import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_PROVIDER_ID } from "../providers/registry";

export type Theme = "system" | "dark" | "light";
export type Language = "en" | "th";

interface Settings {
  theme: Theme;
  language: Language;
  providerId: string;
}

const STORAGE_KEY = "tokengauge-settings";
const DEFAULT_SETTINGS: Settings = { theme: "system", language: "en", providerId: DEFAULT_PROVIDER_ID };
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : "system",
      language: parsed.language === "th" ? "th" : "en",
      providerId: typeof parsed.providerId === "string" ? parsed.providerId : DEFAULT_PROVIDER_ID,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** The stylesheet's default is dark, so only light needs an attribute. */
function applyTheme(theme: Theme) {
  const resolved = theme === "system"
    ? (window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark")
    : theme;

  if (resolved === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

let current = readSettings();
const listeners = new Set<() => void>();

function publish(next: Settings) {
  current = next;
  listeners.forEach((listener) => listener());
}

function onStorage(e: StorageEvent) {
  if (e.key === STORAGE_KEY) publish(readSettings());
}

/**
 * One copy per window. Every `useSettings` used to hold its own, and the
 * `storage` event never fires in the document that wrote the value, so a change
 * reached the other window but not the other hooks beside it.
 */
export const settingsStore = {
  get: () => current,
  subscribe(listener: () => void) {
    if (listeners.size === 0) window.addEventListener("storage", onStorage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener("storage", onStorage);
    };
  },
  update(patch: Partial<Settings>) {
    const next = { ...current, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Unsaved, but it still applies for this run.
    }
    publish(next);
  },
};

/**
 * Theme, language and the selected provider, persisted to localStorage and
 * synced live across TokenGauge's separate hover/click windows via the native
 * `storage` event (fires in other same-origin windows automatically — no IPC).
 *
 * Theme defaults to `system`: this is a Windows companion, so it follows
 * Windows unless the user says otherwise.
 */
export function useSettings() {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;

    const media = window.matchMedia(LIGHT_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  return {
    theme: settings.theme,
    language: settings.language,
    providerId: settings.providerId,
    setTheme: (theme: Theme) => settingsStore.update({ theme }),
    setLanguage: (language: Language) => settingsStore.update({ language }),
    setProviderId: (providerId: string) => settingsStore.update({ providerId }),
  };
}
