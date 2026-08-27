import type { Provider } from "../types/provider";
import { ClaudeProvider } from "./claude";

export interface ProviderEntry {
  id: string;
  name: string;
  /** Provider's own brand color. Tints its dot in the selector — nothing else. */
  dot: string;
  /** `planned` providers are listed but not selectable: the frame is provider-agnostic, the data is not there yet. */
  status: "available" | "planned";
  create?: () => Provider;
}

/**
 * Every provider TokenGauge knows about. Adding one here is the whole change:
 * the shell, notifications and thresholds are provider-agnostic by contract.
 */
export const PROVIDERS: ProviderEntry[] = [
  { id: "claude", name: "Claude Code", dot: "#D97757", status: "available", create: () => new ClaudeProvider() },
  { id: "codex", name: "Codex", dot: "#8E8E93", status: "planned" },
];

export const DEFAULT_PROVIDER_ID = "claude";

export function providerEntry(id: string): ProviderEntry {
  return PROVIDERS.find((p) => p.id === id && p.status === "available")
    ?? PROVIDERS.find((p) => p.id === DEFAULT_PROVIDER_ID)!;
}
