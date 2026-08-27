import { getVersion } from "@tauri-apps/api/app";

const REPO = "Martinnezsavemaiwai/TokenGauge";

export type UpdateCheckResult =
  | { status: "up-to-date" }
  | { status: "available"; latestVersion: string }
  | { status: "error" };

/** Compare two dotted versions. Returns >0 when `a` is newer than `b`. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Compare the running app version against the newest published GitHub release.
 *
 * Deliberately *not* `/releases/latest`: that endpoint ignores pre-releases and
 * 404s when every published release is one — which is exactly this repo, and is
 * what made "Check for Updates" always answer "could not check". The list
 * endpoint returns pre-releases (and hides drafts from anonymous callers, so a
 * release still sitting in draft is correctly invisible here).
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const [current, res] = await Promise.all([
      getVersion(),
      fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`),
    ]);
    if (!res.ok) return { status: "error" };

    const releases = await res.json();
    if (!Array.isArray(releases)) return { status: "error" };

    const tags = releases
      .filter((r) => !r.draft)
      .map((r) => String(r.tag_name ?? "").replace(/^v/, ""))
      .filter(Boolean);
    // Nothing published yet is not a failure — there is simply nothing newer.
    if (tags.length === 0) return { status: "up-to-date" };

    const latest = tags.reduce((best, tag) => (compareVersions(tag, best) > 0 ? tag : best));
    return compareVersions(latest, current) > 0
      ? { status: "available", latestVersion: latest }
      : { status: "up-to-date" };
  } catch {
    return { status: "error" };
  }
}
