import { useState, useEffect, useCallback } from "react";
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

/**
 * Theme, language and the selected provider, persisted to localStorage and
 * synced live across TokenGauge's separate hover/click windows via the native
 * `storage` event (fires in other same-origin windows automatically — no IPC).
 *
 * Theme defaults to `system`: this is a Windows companion, so it follows
 * Windows unless the user says otherwise.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(readSettings);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;

    const media = window.matchMedia(LIGHT_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(readSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    theme: settings.theme,
    language: settings.language,
    providerId: settings.providerId,
    setTheme: (theme: Theme) => update({ theme }),
    setLanguage: (language: Language) => update({ language }),
    setProviderId: (providerId: string) => update({ providerId }),
  };
}
