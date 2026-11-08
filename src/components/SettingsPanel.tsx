import { useEffect, useState, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettings, type Theme, type Language } from "../hooks/useSettings";
import { checkForUpdate, type UpdateCheckResult } from "../lib/updates";
import { NOTIFY_THRESHOLDS } from "../lib/usage-state";
import { t, type StringKey } from "../lib/i18n";

const THEMES: Theme[] = ["system", "dark", "light"];
const THEME_KEYS: Record<Theme, StringKey> = { system: "themeSystem", dark: "themeDark", light: "themeLight" };
const LANGUAGES: Language[] = ["en", "th"];
const LANGUAGE_KEYS: Record<Language, StringKey> = { en: "languageEn", th: "languageTh" };

type UpdateState = { status: "idle" } | { status: "checking" } | UpdateCheckResult;

/** Appearance, startup, notifications and the About actions. */
export function SettingsPanel({ onExit }: { onExit: () => void }) {
  const { theme, language, notifications, setTheme, setLanguage, setNotifications } = useSettings();
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autostartFailed, setAutostartFailed] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    isEnabled().then(setAutostart).catch(() => setAutostart(false));
    getVersion().then(setVersion).catch(() => setVersion(null));
  }, []);

  /**
   * The switch shows what Windows actually holds, not what was asked for: it
   * re-reads the registration after writing it.
   */
  const toggleAutostart = async () => {
    if (autostart === null) return;
    const wanted = !autostart;
    try {
      if (autostart) await disable();
      else await enable();
    } catch {
      // The read-back below decides what to show.
    }
    const actual = await isEnabled().catch(() => autostart);
    setAutostart(actual);
    setAutostartFailed(actual !== wanted);
  };

  const check = async () => {
    setUpdate({ status: "checking" });
    setUpdate(await checkForUpdate());
  };

  const toggleThreshold = (threshold: number) => {
    const kept = notifications.thresholds.includes(threshold)
      ? notifications.thresholds.filter((value) => value !== threshold)
      : [...notifications.thresholds, threshold];
    setNotifications({ thresholds: NOTIFY_THRESHOLDS.filter((value) => kept.includes(value)) });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Field label={t(language, "settingsTheme")}>
        {THEMES.map((option) => (
          <Segment key={option} selected={theme === option} onClick={() => setTheme(option)} label={t(language, THEME_KEYS[option])} />
        ))}
      </Field>

      <Field label={t(language, "settingsLanguage")}>
        {LANGUAGES.map((option) => (
          <Segment key={option} selected={language === option} onClick={() => setLanguage(option)} label={t(language, LANGUAGE_KEYS[option])} />
        ))}
      </Field>

      <div className="flex flex-col gap-1">
        <Toggle
          label={t(language, "settingsStartWithWindows")}
          checked={autostart ?? false}
          disabled={autostart === null}
          onChange={toggleAutostart}
        />
        <span className="meta" style={autostartFailed ? { color: "var(--danger)" } : undefined}>
          {t(language, autostartFailed ? "autostartFailed" : "autostartNote")}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[0.8125rem] font-medium">{t(language, "settingsNotifications")}</span>
        <Toggle
          label={t(language, "notifEnabled")}
          checked={notifications.enabled}
          onChange={() => setNotifications({ enabled: !notifications.enabled })}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="meta">{t(language, "notifThresholds")}</span>
          {[...NOTIFY_THRESHOLDS].reverse().map((threshold) => (
            <button
              key={threshold}
              className="btn num"
              aria-pressed={notifications.thresholds.includes(threshold)}
              disabled={!notifications.enabled}
              style={!notifications.enabled ? { opacity: 0.5 } : undefined}
              onClick={() => toggleThreshold(threshold)}
            >
              {threshold}%
            </button>
          ))}
        </div>
        <Toggle
          label={t(language, "notifQuotaBack")}
          checked={notifications.quotaBack}
          disabled={!notifications.enabled}
          onChange={() => setNotifications({ quotaBack: !notifications.quotaBack })}
        />
      </div>

      <Field label={`${t(language, "settingsAbout")}${version ? ` · v${version}` : ""}`}>
        <button className="btn" onClick={check} disabled={update.status === "checking"}>
          {t(language, "navCheckUpdates")}
        </button>
        <button className="btn" onClick={onExit}>
          {t(language, "navExit")}
        </button>
      </Field>

      {update.status !== "idle" && (
        <div className="flex items-center gap-2 flex-wrap" role="status">
          <span className="meta">
            {update.status === "checking"
              ? t(language, "checking")
              : update.status === "available"
                ? t(language, "updateAvailableBody").replace("{version}", update.latestVersion)
                : update.status === "error"
                  ? t(language, "updateCheckErrorBody")
                  : t(language, "upToDateBody")}
          </span>
          {update.status === "available" && (
            <button
              className="btn"
              onClick={() => openUrl("https://github.com/Martinnezsavemaiwai/TokenGauge/releases").catch(console.error)}
            >
              {t(language, "openRelease")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-medium">{label}</span>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[0.8125rem]">{label}</span>
      <button type="button" className="switch" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}>
        <span />
      </button>
    </div>
  );
}

function Segment({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button className="btn flex-1" onClick={onClick} aria-pressed={selected}>
      {label}
    </button>
  );
}
