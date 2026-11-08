# Contributing to TokenGauge

Thank you for your interest in contributing to TokenGauge! 

## Adding a New Provider

TokenGauge is designed to be extensible. To add a new AI coding assistant provider:

1. Create a new class implementing the `Provider` interface in `src/providers/your-provider.ts`.
2. Do **not** put API logic in the React UI components. All parsing, fetching, and normalizing must happen inside your provider class.
3. Ensure that your provider gracefully degrades (e.g. throws `FileNotFoundError`) if the user doesn't have the CLI tool installed.
4. Register it in `src/providers/registry.ts` with status `available`. The dashboard's provider selector picks it up from there.

## Development Rules

- **Strict TypeScript**: No `any` types.
- **Design System**: Use the CSS variables defined in `src/styles/index.css`. Do not hardcode new colors unless you are adding a completely new semantic state.
- **No Web Bloat**: This is a tray companion read in a glance. Avoid complex web-only UI patterns. Keep it minimal and fast.
- **Icons**: Regenerate tray and app icons with `node scripts/gen-icons.mjs` rather than editing them by hand.

Please open an issue before submitting large PRs so we can discuss the architectural approach.
