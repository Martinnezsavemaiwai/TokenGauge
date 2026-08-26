import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROVIDERS } from "../providers/registry";
import { deriveUsageState, stateColor } from "../lib/usage-state";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";

interface ProviderSelectorProps {
  providerId: string;
  onSelect: (id: string) => void;
  /** Usage percent of the active provider, shown on its row. */
  percent?: number;
  language?: Language;
}

/**
 * The control that keeps TokenGauge from being a Claude viewer: it names what
 * the instrument is currently pointed at, and it renders even with one provider
 * installed. Planned providers are listed and disabled rather than hidden — the
 * frame is provider-agnostic today, the data sources arrive later.
 */
export function ProviderSelector({ providerId, onSelect, percent, language = "en" }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors max-w-[11rem]"
        style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-primary)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-border)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)")}
      >
        <Dot color={active.dot} />
        <span className="truncate">{active.name}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--color-text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-1.5 z-20 rounded-lg py-1.5 min-w-[15rem]"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 pb-1.5 text-[0.6875rem]" style={{ color: "var(--color-text-muted)" }}>
              {t(language, "chooseProvider")}
            </div>
            {PROVIDERS.map((entry) => {
              const isActive = entry.id === active.id;
              const planned = entry.status === "planned";
              return (
                <button
                  key={entry.id}
                  role="option"
                  aria-selected={isActive}
                  disabled={planned}
                  onClick={() => {
                    if (planned) return;
                    onSelect(entry.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors"
                  style={{
                    color: planned ? "var(--color-text-muted)" : "var(--color-text-primary)",
                    cursor: planned ? "default" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!planned) (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                  }}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <Dot color={entry.dot} dim={planned} />
                  <span className="truncate flex-1">{entry.name}</span>
                  {planned ? (
                    <span className="text-[0.6875rem] shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {t(language, "providerPlanned")}
                    </span>
                  ) : (
                    <>
                      {isActive && percent !== undefined && (
                        <span
                          className="text-[0.6875rem] tabular-nums shrink-0"
                          style={{ color: stateColor(deriveUsageState(percent)) }}
                        >
                          {Math.round(percent)}%
                        </span>
                      )}
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Dot({ color, dim = false }: { color: string; dim?: boolean }) {
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: color, opacity: dim ? 0.4 : 1 }}
    />
  );
}
