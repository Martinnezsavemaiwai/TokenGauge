import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  note: string;
}

/**
 * What a surface looks like before its data layer exists. It names what will
 * live there and the honest reason it is empty — no spinner, no fake rows.
 */
export function EmptyState({ icon, title, note }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-2 rounded-lg px-4 py-8 h-full"
      style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
    >
      <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
      <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {title}
      </span>
      <span className="text-[0.6875rem] max-w-[18rem]">{note}</span>
    </div>
  );
}

export function ChartGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 4-6" />
    </svg>
  );
}

export function StackGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
      <rect x="3" y="12" width="13" height="4.5" rx="1.5" />
      <rect x="3" y="19" width="7" height="1.5" rx="0.75" />
    </svg>
  );
}
