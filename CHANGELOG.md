# Changelog

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
