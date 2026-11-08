import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PROVIDERS, providerEntry } from "../providers/registry";
import type { Language } from "../hooks/useSettings";
import { t } from "../lib/i18n";

interface ProviderSelectorProps {
  providerId: string;
  onSelect: (id: string) => void;
  language?: Language;
}

/**
 * Names what TokenGauge is pointed at, and renders even with one provider.
 * Planned providers are listed and disabled rather than hidden.
 */
export function ProviderSelector({ providerId, onSelect, language = "en" }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Same resolution the panels use — a stored id for a `planned` provider must
  // not name one provider in the header while the numbers below are another's.
  const active = providerEntry(providerId);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)')];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + step + items.length) % items.length].focus();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        className="btn"
        onClick={() => setOpen((v) => !v)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Dot color={active.dot} />
        <span className="truncate-line max-w-[8rem]">{active.name}</span>
        <svg width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="menu"
          role="menu"
          aria-label={t(language, "chooseProvider")}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={onMenuKey}
        >
          <div className="meta px-2.5 pt-1 pb-1.5">{t(language, "chooseProvider")}</div>
          {PROVIDERS.map((entry) => {
            const isActive = entry.id === active.id;
            const planned = entry.status === "planned";
            return (
              <button
                key={entry.id}
                className="menu-item"
                role="menuitemradio"
                aria-checked={isActive}
                disabled={planned}
                onClick={() => {
                  onSelect(entry.id);
                  setOpen(false);
                }}
              >
                <Dot color={entry.dot} dim={planned} />
                <span className="truncate-line flex-1">{entry.name}</span>
                {planned && <span className="meta shrink-0">{t(language, "providerPlanned")}</span>}
                {isActive && (
                  <svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dot({ color, dim = false }: { color: string; dim?: boolean }) {
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, opacity: dim ? 0.4 : 1 }} />;
}
