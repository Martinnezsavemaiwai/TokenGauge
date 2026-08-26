import { useEffect } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

/**
 * Shrink the native window down to the rendered panel.
 *
 * The tray windows are transparent but still fixed-size, and a transparent
 * region of a window swallows mouse input exactly like an opaque one — that is
 * the "invisible wall" around the panel that made clicks near it do nothing.
 * Sizing the window to its content leaves nothing left to block.
 */
export function useAutoResize(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.getElementById("root");
    if (!root) return;

    // The window can never be taller than the screen, so the panel must not be
    // either: cap `.panel` from the screen (not the window — that would feed
    // back into its own size) and `.panel-scroll` scrolls the overflow.
    const maxHeight = Math.round(window.screen.availHeight * 0.9);
    document.documentElement.style.setProperty("--panel-max-h", `${maxHeight - 16}px`); // #root padding

    let applied = "";
    const apply = () => {
      // getBoundingClientRect keeps the fraction offsetWidth rounds away; one
      // pixel of slack, because a window narrower than its panel clips it.
      const rect = root.getBoundingClientRect();
      const width = Math.ceil(rect.width) + 1;
      const height = Math.min(Math.ceil(rect.height) + 1, maxHeight);
      if (width < 40 || height < 40) return; // mid-teardown / not laid out yet
      const size = `${width}x${height}`;
      if (size === applied) return;
      applied = size;
      getCurrentWindow().setSize(new LogicalSize(width, height)).catch(console.error);
    };

    const observer = new ResizeObserver(apply);
    observer.observe(root);
    apply();
    // Thai and Latin metrics settle after the first paint; re-measure once fonts land.
    document.fonts?.ready.then(apply).catch(() => {});
    return () => observer.disconnect();
  }, [enabled]);
}
