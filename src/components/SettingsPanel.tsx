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
  const [autostartFailed, setAutostartFailed] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    isEnabled().then(setAutostart).catch(() => setAutostart(false));
    getVersion().then(setVersion).catch(() => setVersion(null));
  }, []);

  /**
   * The switch shows what Windows actually holds, not what was asked for: it
   * re-reads the registration after writing it. A silent catch here is what let
   * a failed write leave a ticked box and no startup entry.
   */
  const toggleAutostart = async () => {
    if (autostart === null) return;
    const wanted = !autostart;
    try {
      if (autostart) await disable();
      else await enable();
    } catch {
      // The read-back below decides what to show — a thrown error and a write
      // that quietly did nothing are the same failure to the person clicking.
    }
    const actual = await isEnabled().catch(() => autostart);
    setAutostart(actual);
    setAutostartFailed(actual !== wanted);
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

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {t(language, "settingsStartWithWindows")}
          </span>
          <Switch
            checked={autostart ?? false}
            disabled={autostart === null}
            onChange={toggleAutostart}
            label={t(language, "settingsStartWithWindows")}
          />
        </div>
        <span
          className="text-[0.6875rem] max-w-[22rem]"
          style={{ color: autostartFailed ? "var(--color-status-warning)" : "var(--color-text-muted)" }}
        >
          {t(language, autostartFailed ? "autostartFailed" : "autostartNote")}
        </span>
      </div>

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
            // Ghost, not red: a status hue in this system states how much of a
            // limit is spent, and quitting is chrome, not a reading.
            style={{
              background: "transparent",
              color: "var(--color-text-secondary)",
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

/**
 * The one control here that Windows itself would draw. A native checkbox is
 * the browser's, not this system's — it ignores the palette in both themes and
 * has no focus ring drawn from it.
 */
function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative shrink-0 rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        width: "2.25rem",
        height: "1.25rem",
        background: checked ? "var(--color-accent)" : "var(--color-ring-track)",
        border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-border)"}`,
        outlineColor: "var(--color-accent)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          width: "0.75rem",
          height: "0.75rem",
          top: "0.1875rem",
          left: checked ? "1.125rem" : "0.1875rem",
          background: checked ? "var(--color-bg-base)" : "var(--color-text-secondary)",
          transition: "left 0.18s cubic-bezier(0.16, 1, 0.3, 1), background 0.18s ease",
        }}
      />
    </button>
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
