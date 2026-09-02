# Changelog

## [0.3.0] - 2026-09-02
### Added
- Time to limit: the usage panel projects the session window forward from the tokens burned in the last hour and says how long is left at that pace. The line appears only when that pace runs out before the window resets, and turns amber under an hour.
- History tab: tokens per day over the last 7 days, from the local session files. It runs on its own `get_usage_history` command — the 30s poll keeps skipping files untouched for 24h, and this one walks the archives only when the tab is opened, caching the answer for five minutes. Days are bucketed by *local* date, and a day with no usage is listed at zero rather than dropped.
- Models tab: tokens per model over the same rolling 24 hours the chart covers, biggest first, with each model's share of the day. Read from `message.model` in the local session files during the scan that was already running — the tab now falls back to its empty state only when there really was no usage.

### Security
- The webview shipped with no content security policy (`"csp": null`). It now runs under one that allows scripts and styles only from the bundle, blocks objects and framing, and permits exactly two network destinations: Tauri's own IPC and `api.github.com` for the update check. The Anthropic call is made from Rust and never crosses into the webview, so no policy is needed for it. Verified against the real production bundle — it renders with zero policy violations.

### Fixed
- "Start with Windows" could report itself as on while nothing was registered. The toggle wrote the switch from its own intention and swallowed any failure, so a refused write left a ticked box and no entry under `HKCU\...\CurrentVersion\Run`. It now re-reads the registration after writing it and says so in the panel when Windows refuses.
- The usage chart's axis printed "11 PM" in Thai. Hours are formatted for the active language now — 12-hour with AM/PM in English, 24-hour in Thai — and the chart's accessible name is no longer an English sentence.
- The usage ring's accessible name read "Usage progress: 0%" while the ring itself showed "—" for a missing reading, and it was English-only. The refresh control had a tooltip but no accessible name.

### Changed
- Models and History no longer borrow the limit meter's shape. Per-model usage is one rail split by model, and history is a column per day — a rounded meter track in this app states percent of a metered window, which is a denominator neither of them has.
- The dashboard's "Open Claude Code" button and both panels' manual refresh control are gone. The button opened a page that is not Claude Code and was never pressed; the refresh repeated what the 30-second poll already does. Freshness now shows up only where it means something — a paused sync says how old its numbers are, in the line that already reports the sync state.
- Thai UX copy reviewed string by string: literal calques ("ซิงก์สด"), nominalizations, bureaucratic back-references and recoverable subjects are gone, notification titles read as a plain escalation, and the autostart failure names what Windows itself calls the list.
- "Start with Windows" is a drawn switch instead of the browser's checkbox, with a line explaining that TokenGauge starts hidden in the tray at sign-in.
- Exit TokenGauge dropped its red text: status hues in this app state how much of a limit is spent, and quitting is not a reading.

## [0.2.1] - 2026-08-27
### Fixed
- The tray icon never turned red. `set_tray_state` matched `"critical"` but not `"full"`, so a spent quota fell through to the default arm and kept showing the half-filled orange gauge — the hover panel read 100% while the taskbar still looked like 55%. The states that mean "no reading" (`loading`, `no_access`, `error`) now show the disabled icon instead of the normal one, which is what it was drawn for.
- Threshold notifications were announced again after every relaunch, because the "already announced" marks lived in a React ref that died with the webview. They are now persisted per limit window and keyed to that window's reset timestamp, so each threshold fires once per period and a new period re-arms on its own.
- Nothing stopped a second copy of TokenGauge from starting, and a second copy meant a second tray icon and two of every notification. Only one instance runs now; launching again surfaces the dashboard of the copy already running.
- `weekly` and `weekly_opus` shared one notification title and a body that said "weekly limit" for both, so two different windows crossing a threshold at the same time read as one notification delivered twice. The Opus window has its own wording.
- The flyout broke on a multi-monitor desktop with mixed scaling (e.g. a 1920x1080 screen at 100% next to a 2560x1440 at 150%). Three separate faults: `position_window` converted the tray rect with the scale factor of whichever monitor the *window* was on, and had to bail out — without writing the tray anchor — when that lookup failed, so the flyout opened wherever the window was last left; the computed position was never clamped to a monitor, so it could land on no screen at all; and the resize handler re-snapped the window to the tray anchor on *every* resize, which meant crossing to a differently-scaled monitor fired a DPI change, resized the window, and immediately yanked it back. Position is now clamped to the work area of the monitor the tray is on, and a resize holds the window's own bottom edge instead of re-snapping to the tray.
- "Check for Updates" always answered *Could not check for updates*. It asked GitHub for `/releases/latest`, which ignores pre-releases and 404s when every published release is one. It now reads the releases list, and only reports an update when the published version is actually newer than the running one.

### Changed
- The app is named **TokenGauge**, not `tokengauge` — shortcut, Start Menu entry, installed binary, installer filenames, and the app name Windows prints on every toast.
- The provider list is Claude Code and Codex. OpenCode and Aider were listed as planned with no data source behind them and have been removed from the selector; a stored id for a removed provider falls back to Claude Code.
- Dropped the `icon` option from usage notifications — `tauri-plugin-notification` ignores it on Windows, where the toast icon comes from the registered app id.
- Dropped the unused `walkdir` dependency and replaced the `"A Tauri App"` / `authors = ["you"]` template metadata in `Cargo.toml`.
- Removed the leftover Vite template assets (`public/vite.svg`, `public/tauri.svg`) and the favicon link to them; the tray windows have no browser chrome to show a favicon in.

## [0.2.0] - 2026-08-27
### Added
- Plan limits: session (5 hr), weekly (all models), and weekly Opus windows from the Anthropic usage API, each with its own reset clock and severity color.
- Subscription tier badge (Pro / Max / …) read from the local Claude Code credentials.
- Provider selector in the dashboard header; providers are registered in `src/providers/registry.ts`, and planned ones are listed as unsupported rather than hidden.
- Bottom tab bar: Overview, Models, History, Settings. Models and History ship as designed empty states.
- `System` theme option, now the default, following the Windows light/dark setting live.
- TokenGauge's own gauge mark, replacing the provider-derived glyph in the app frame.
- Weekly-limit notifications, and notification titles that name the active provider.

### Fixed
- A failed usage refresh (expired OAuth token, offline) no longer falls back to the local token estimate and its invented 25M denominator — the last good API numbers are kept and flagged as stale. This is what showed `229,218,999 / 25,000,000` at 100% used with negative remaining.
- Threshold notifications fired twice: both tray windows run the same app, and both were notifying. One window owns notifications and the tray icon now.
- The transparent tray windows swallowed clicks across their whole fixed rectangle; they are now sized to the rendered panel.
- The usage chart labelled rolling-window bucket indices as clock hours, which pinned the axis's right edge to "11 PM" at every hour of the day.
- Muted text failed WCAG AA (2.77:1 dark, 2.81:1 light); the palette now clears 4.5:1 in both themes, and no type ships below 11px.

### Changed
- Usage polling moved from 3s to 30s, and session files untouched for 24h are skipped entirely.
- The right-hand nav rail was replaced by the tab bar; Check for Updates and Exit moved into Settings → About.
- Local-only mode shows a raw token count for the last 5 hours instead of a percentage of a fabricated limit.
- Panels dropped their drop shadow for a single border, and lost the duplicate session meter under the ring.


## [0.1.0] - 2026-08-13
### Added
- Initial scaffolding with Tauri 2, React, TypeScript, and Vite.
- Tailwind CSS v4 and Framer Motion integration.
- Windows 11 style UI tokens and native feeling flyouts.
- System Tray integration with dynamic usage-based icon swapping.
- `HoverPanel` preview with `ProgressRing`.
- `ClickPanel` full flyout with 24-hour `UsageChart`.
- `MockProvider` for UI testing via a dev slider.
- `ClaudeProvider` fallback implementation.
- Windows native notifications with deduplication/cooldown for usage thresholds (60%, 80%, 90%, 100%).
- Brand identity: "Vibrant Orbit" Crab SVG app icons and "Retro Arcade" logotype.
