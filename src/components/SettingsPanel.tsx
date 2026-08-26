import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import type { Theme, Language } from "../hooks/useSettings";
import { t, type StringKey } from "../lib/i18n";

interface SettingsPanelProps {
  theme: Theme;
  language: Language;
  onThemeChange: (theme: Theme) => void;
  onLanguageChange: (language: Language) => void;
  onCheckUpdates: () => void;
  onExit: () => void;
}

const THEMES: Theme[] = ["system", "dark", "light"];
const THEME_KEYS: Record<Theme, StringKey> = { system: "themeSystem", dark: "themeDark", light: "themeLight" };
const LANGUAGES: Language[] = ["en", "th"];
const LANGUAGE_KEYS: Record<Language, StringKey> = { en: "languageEn", th: "languageTh" };

/**
 * The Settings tab: appearance, startup, and the About actions that used to
 * live in the old right-hand nav rail.
 */
export function SettingsPanel({
  theme,
  language,
  onThemeChange,
  onLanguageChange,
  onCheckUpdates,
  onExit,
}: SettingsPanelProps) {
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    isEnabled().then(setAutostart).catch(() => setAutostart(false));
    getVersion().then(setVersion).catch(() => setVersion(null));
  }, []);

  const toggleAutostart = async () => {
    if (autostart === null) return;
    try {
      if (autostart) await disable();
      else await enable();
      setAutostart(!autostart);
    } catch {
      // Leave state unchanged if the OS registration fails
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label={t(language, "settingsTheme")}>
        <div className="flex gap-2">
          {THEMES.map((option) => (
            <Segment
              key={option}
              selected={theme === option}
              onClick={() => onThemeChange(option)}
              label={t(language, THEME_KEYS[option])}
            />
          ))}
        </div>
      </Field>

      <Field label={t(language, "settingsLanguage")}>
        <div className="flex gap-2">
          {LANGUAGES.map((option) => (
            <Segment
              key={option}
              selected={language === option}
              onClick={() => onLanguageChange(option)}
              label={t(language, LANGUAGE_KEYS[option])}
            />
          ))}
        </div>
      </Field>

      <label
        className="flex items-center justify-between text-xs cursor-pointer py-1"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {t(language, "settingsStartWithWindows")}
        <input
          type="checkbox"
          checked={autostart ?? false}
          disabled={autostart === null}
          onChange={toggleAutostart}
          className="accent-[var(--color-accent)]"
        />
      </label>

      <div style={{ borderTop: "1px solid var(--color-border-subtle)" }} />

      <Field label={`${t(language, "settingsAbout")}${version ? ` · v${version}` : ""}`}>
        <div className="flex gap-2">
          <button
            onClick={onCheckUpdates}
            className="flex-1 text-xs py-2 rounded-lg cursor-pointer transition-colors"
            style={{
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border-subtle)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            {t(language, "navCheckUpdates")}
          </button>
          <button
            onClick={onExit}
            className="flex-1 text-xs py-2 rounded-lg cursor-pointer transition-colors"
            style={{
              background: "transparent",
              color: "var(--color-status-critical)",
              border: "1px solid var(--color-border-subtle)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            {t(language, "navExit")}
          </button>
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Segment({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="flex-1 text-xs py-2 rounded-lg transition-colors cursor-pointer"
      style={{
        background: selected ? "var(--color-bg-elevated)" : "transparent",
        color: selected ? "var(--color-accent)" : "var(--color-text-secondary)",
        border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
      }}
    >
      {label}
    </button>
  );
}
