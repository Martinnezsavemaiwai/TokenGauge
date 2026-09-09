import { describe, it, expect } from "vitest";
import capabilities from "../../src-tauri/capabilities/default.json";

/**
 * Every `getCurrentWindow().x()` the frontend calls has to be granted in the
 * capability file, or Tauri's ACL rejects it at runtime — silently, from the
 * UI's point of view, since the rejection only ever reaches a `.catch`.
 *
 * `setSize` was missing this way: the panels kept their built-in size, so the
 * transparent window stayed larger than the panel drawn inside it and went on
 * swallowing clicks around it — the exact thing `useAutoResize` exists to stop.
 */

/** Window methods `core:window:default` already covers — these need no explicit grant. */
const GRANTED_BY_DEFAULT = new Set(["isVisible", "onFocusChanged"]);

/** camelCase JS method to the ACL permission it is gated behind. */
const permissionFor = (method: string) =>
  `core:window:allow-${method.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

const sources = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

describe("window capabilities", () => {
  it("grants every window method the frontend calls", () => {
    const called = new Set<string>();
    for (const [path, source] of Object.entries(sources)) {
      if (path.endsWith(".test.ts")) continue;
      for (const [, method] of (source as string).matchAll(/getCurrentWindow\(\)\s*\.\s*(\w+)/g)) {
        if (!GRANTED_BY_DEFAULT.has(method)) called.add(method);
      }
    }
    // If this is empty the glob or the regex stopped matching, which would
    // leave the test passing without checking anything.
    expect(called.size).toBeGreaterThan(0);

    const missing = [...called]
      .map(permissionFor)
      .filter((permission) => !capabilities.permissions.includes(permission));
    expect(missing).toEqual([]);
  });
});
